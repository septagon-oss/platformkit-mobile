import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

// The device journey runs on `pkit-ci-android`, the runner whose image carries adb,
// the emulator, Maestro and /dev/kvm, and its probe step refuses by name on a host
// that does not. A label is one string in one workflow, so without this file nothing
// here holds it: one edit could move the job back to a plain Linux runner, where the
// probe is right to refuse and every push to main goes red having walked no flow. The
// same job builds the kernel it serves from the commit this repository's two
// provenance records agree on, so that pin — and whatever stops there being one — is
// held here too.

const checkout = path.join(import.meta.dirname, "..");
const tracked = (at: string): string => readFileSync(path.join(checkout, at), "utf8");
const job = (
  at: string,
  id: string,
): { steps?: Record<string, string>[]; [key: string]: unknown } =>
  (parse(tracked(at)) as { jobs: Record<string, { steps?: Record<string, string>[] }> }).jobs[id]!;

interface Shell {
  status: number;
  out: string;
  err: string;
}

/**
 * runShell runs one script with nothing inherited but the variables the case names,
 * so a tool found below was found by the search under test and not by whatever this
 * machine keeps on PATH.
 */
function runShell(at: string, vars: Record<string, string>, args: string[] = []): Shell {
  const got = spawnSync("/bin/bash", [at, ...args], {
    env: vars as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
  return { status: got.status ?? -1, out: got.stdout, err: got.stderr };
}

/** foundAt reads the path the probe printed for one tool: "found" is a claim about a search scope. */
function foundAt(out: string, name: string): string {
  return new RegExp(`^${name}: (.+)$`, "m").exec(out)?.[1] ?? "";
}

/** tool plants an executable at the layout a real install uses. */
function tool(at: string): void {
  mkdirSync(path.dirname(at), { recursive: true });
  writeFileSync(at, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
}

/** temp gives a case a directory of its own, removed when the case ends. */
function temp(t: { after: (fn: () => void) => void }, prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("the journey job asks for the runner whose image carries a device, and is the only job that does", () => {
  const deviceRunner = "pkit-ci-android";
  const jobs: string[] = [];
  for (const entry of readdirSync(path.join(checkout, ".gitea", "workflows")).sort()) {
    if (!entry.endsWith(".yml")) continue;
    const document = parse(tracked(path.join(".gitea", "workflows", entry))) as {
      jobs?: Record<string, { "runs-on"?: string }>;
    };
    for (const [id, definition] of Object.entries(document.jobs ?? {})) {
      jobs.push(`${entry}/${id}=${String(definition["runs-on"])}`);
    }
  }
  assert.equal(
    job(".gitea/workflows/mobile-e2e.yml", "journey")["runs-on"],
    deviceRunner,
    `the device journey has to ask for the label whose image boots an emulator; every job is ${jobs.join(", ")}`,
  );
  // One device job per host: the concurrency group is named per-workflow, so a second
  // job on this label would boot an emulator beside the first and meet that job's
  // refusal of a host that already has a device attached.
  assert.deepEqual(
    jobs.filter((entry) => entry.endsWith(`=${deviceRunner}`)),
    ["mobile-e2e.yml/journey=pkit-ci-android"],
  );
});

test("the probe is the job's first command, and the only one that asks", () => {
  const steps = job(".gitea/workflows/mobile-e2e.yml", "journey").steps ?? [];
  const first = steps.findIndex((step) => step.run !== undefined);
  assert.ok(first >= 0, "the job has steps that run");
  assert.deepEqual(
    [steps[first]!.name, steps[first]!.run],
    ["Name what this host owes a device journey", "scripts/e2e/mobile_ci.sh --probe"],
    "the probe decides whether the rest of the job can mean anything, so it runs before anything does",
  );
  assert.equal(
    steps[first]!.if,
    undefined,
    "a probe that runs conditionally is a host nobody checked",
  );
  assert.equal(
    steps.filter((step) => (step.run ?? "").includes("--probe")).length,
    1,
    "one step asks the host what it owes; a second would be a different question asked twice",
  );
});

test("the probe finds adb, the emulator and Maestro where the image and a workstation install them", (t) => {
  const search = path.join(checkout, "scripts", "e2e", "tools.sh");
  const ask = (env: Record<string, string>): Shell => {
    const work = temp(t, "pk-tool-search-");
    const home = path.join(work, "home");
    mkdirSync(home, { recursive: true });
    const body = path.join(work, "ask.sh");
    writeFileSync(body, `. '${search}'\npk_tools probe adb emulator maestro\n`);
    return runShell(body, { PATH: "/usr/bin:/bin", HOME: home, ...env });
  };

  // The device image's own layout, with the two roots it exports.
  const image = temp(t, "pk-image-shape-");
  for (const part of [
    "opt/android-sdk/platform-tools/adb",
    "opt/android-sdk/emulator/emulator",
    "opt/maestro/bin/maestro",
  ]) {
    tool(path.join(image, part));
  }
  const exported = ask({
    ANDROID_HOME: path.join(image, "opt/android-sdk"),
    MAESTRO_HOME: path.join(image, "opt/maestro"),
  });
  assert.equal(exported.status, 0, `the image's layout has to resolve: ${exported.err}`);
  for (const name of ["adb", "emulator", "maestro"]) {
    const resolved = foundAt(exported.out, name);
    assert.ok(
      resolved.startsWith(image + path.sep),
      `${name} resolved outside the planted tree, so this case proved nothing: ${resolved}`,
    );
  }

  // Nothing installed anywhere: the refusal names all three and the scope it searched.
  const empty = ask({});
  assert.equal(empty.status, 1);
  assert.match(empty.err, /missing: adb emulator maestro,/);
  assert.equal(empty.err.includes("searched: /usr/bin:/bin"), true, empty.err);

  // The older of the two SDK exports, on its own: a host that has ever set only that
  // one is a host with an SDK on it, and only Maestro is missing there.
  const older = temp(t, "pk-older-export-");
  tool(path.join(older, "platform-tools/adb"));
  tool(path.join(older, "emulator/emulator"));
  const otherName = ask({ ANDROID_SDK_ROOT: older });
  assert.equal(otherName.status, 1, otherName.err);
  assert.match(otherName.err, /missing: maestro,/);
  // A tool the loop added to PATH shows up on the searched line the refusal prints:
  // that is the scope it was found in, stated by the probe rather than by this case.
  for (const part of ["platform-tools", "emulator"]) {
    assert.ok(
      otherName.err.includes(path.join(older, part)),
      `the searched line lost ${part}: ${otherName.err}`,
    );
  }

  // Maestro loose in a home of its own and no SDK: the bare $MAESTRO_HOME entry is
  // what carries the first, and the second is still refused.
  const loose = temp(t, "pk-maestro-loose-");
  tool(path.join(loose, "opt/maestro/maestro"));
  const partial = ask({ MAESTRO_HOME: path.join(loose, "opt/maestro") });
  assert.equal(partial.status, 1);
  assert.match(partial.err, /missing: adb emulator,/);
  assert.doesNotMatch(
    partial.err,
    /missing: [^\n]*maestro/,
    "Maestro was found; a probe that lost the bare home would refuse it",
  );

  // A developer's machine: the SDK where its installer put it, Maestro under XDG,
  // and an exported SDK root that holds nothing.
  const workstation = temp(t, "pk-workstation-");
  tool(path.join(workstation, "Android/Sdk/platform-tools/adb"));
  tool(path.join(workstation, "Android/Sdk/emulator/emulator"));
  tool(path.join(workstation, "xdg/platformkit-tools/maestro/bin/maestro"));
  const theirOwn = ask({
    HOME: workstation,
    ANDROID_HOME: path.join(workstation, "nothing/exported/here"),
    XDG_DATA_HOME: path.join(workstation, "xdg"),
  });
  assert.equal(theirOwn.status, 0, `a workstation layout has to resolve: ${theirOwn.err}`);
});

test("the probe's refusal names the runner the job is on", () => {
  assert.match(tracked("scripts/e2e/mobile_ci.sh"), /echo " {2}Label: pkit-ci-android\./);
  // The half-fix — the workflow moved and the harness kept pointing at the old label —
  // would tell the next reader to fix a host this job is not on.
  for (const at of [
    "scripts/e2e/mobile_ci.sh",
    "scripts/e2e/tools.sh",
    ".gitea/workflows/mobile-e2e.yml",
  ]) {
    assert.doesNotMatch(
      tracked(at),
      /pkit-ci-linux-amd64/,
      `${at} names a runner the journey is not on`,
    );
  }
});

test("the kernel the journeys serve is the commit the two provenance records agree on", (t) => {
  const records = ["testdata/catalog.source.json", "testdata/openapi.source.json"];
  const commits = records.map((at) => {
    const commit = (JSON.parse(tracked(at)) as { upstream?: { commit?: unknown } }).upstream
      ?.commit;
    assert.match(
      typeof commit === "string" ? commit : "",
      /^[0-9a-f]{40}$/,
      `${at} has to pin a full object id, not a ref somebody can move`,
    );
    return commit as string;
  });
  assert.equal(
    commits[0],
    commits[1],
    "the journey serves one build, so two commits means one fixture describes a server nothing builds",
  );

  // The harness's own rule, run against planted records. It works its repository root
  // out from where it stands, so the case copies the two scripts it needs.
  const harness = (root: string): string => {
    mkdirSync(path.join(root, "scripts/e2e"), { recursive: true });
    for (const at of ["scripts/e2e/mobile_ci.sh", "scripts/e2e/tools.sh"]) {
      writeFileSync(path.join(root, at), readFileSync(path.join(checkout, at)));
    }
    return path.join(root, "scripts/e2e/mobile_ci.sh");
  };
  const pin = (write: (root: string) => void): Shell => {
    const root = temp(t, "pk-kernel-pin-");
    const script = harness(root);
    mkdirSync(path.join(root, "testdata"), { recursive: true });
    write(root);
    return runShell(script, { PATH: "/usr/bin:/bin", HOME: root }, ["--kernel-pin"]);
  };
  const record = (commit: string): string => `${JSON.stringify({ upstream: { commit } })}\n`;
  const both =
    (left: string, right: string) =>
    (root: string): void => {
      writeFileSync(path.join(root, records[0]!), record(left));
      writeFileSync(path.join(root, records[1]!), record(right));
    };

  const agreed = pin(both(commits[0]!, commits[1]!));
  assert.equal(agreed.status, 0, agreed.err);
  assert.equal(
    agreed.out.trim(),
    commits[0],
    "--kernel-pin prints the object id and nothing beside it",
  );

  const gone = pin((root) => {
    both(commits[0]!, commits[1]!)(root);
    rmSync(path.join(root, records[0]!));
  });
  assert.equal(gone.status, 1);
  assert.match(gone.err, /testdata\/catalog\.source\.json/);
  assert.doesNotMatch(
    gone.err,
    /testdata\/openapi\.source\.json/,
    "one record is missing; naming both is a lie",
  );

  const truncated = pin(both("7fc4b0a", commits[1]!));
  assert.equal(truncated.status, 1);
  assert.match(truncated.err, /testdata\/catalog\.source\.json names no kernel to serve/);
  assert.match(truncated.err, /forty-character object id/);

  const split = pin(both("7fc4b0abd547f4e30ad4e5b8b87ef6cc34138bb0", commits[1]!));
  assert.equal(split.status, 1);
  for (const at of records) {
    assert.ok(split.err.includes(at), `the refusal names ${at}: ${split.err}`);
  }

  // A run that got as far as serving says which build it could not find rather than
  // serving something it cannot point at.
  const served = temp(t, "pk-kernel-serve-");
  const script = harness(served);
  mkdirSync(path.join(served, "testdata"), { recursive: true });
  both(commits[0]!, commits[1]!)(served);
  const without = runShell(
    script,
    {
      PATH: "/usr/bin:/bin",
      HOME: served,
      PLATFORMKIT_TEST_ADMIN_URL: "postgres://postgres:x@postgres:5432/platformkit",
      PLATFORMKIT_TEST_DATABASE_URL: "postgres://platformkit_app:x@postgres:5432/platformkit",
    },
    ["verification.apk"],
  );
  assert.equal(without.status, 1);
  assert.match(without.err, /PK_KERNEL_BIN names no kernel binary/);
  assert.ok(
    without.err.includes(commits[0]!),
    `the refusal says which commit the job should have built: ${without.err}`,
  );
});
