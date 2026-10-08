// The publish contract, in four refusals. One scoped name and one version, in a
// manifest that can travel; the changelog entry that version's release documents
// itself by; the tag `kit-v<version>` that names exactly it; and a registry that
// already holds that version. Each refusal has to land before the one write, so
// the cases below run the job's own steps rather than a description of them: the
// guard step is the workflow's own `run:` body, and the publish step is that body
// with `npm` as a shell function that records what it was asked for — no
// registry, no credential and no published version is involved anywhere.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { parse } from "yaml";
import { changelogEntry, checkPublish, publishable, tagNamesVersion } from "../scripts/publish";
import { SUPPORTED_CATALOG_VERSION } from "../src/core/catalog";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  name: string;
  version: string;
  private?: unknown;
  publishConfig?: unknown;
  files: string[];
};

interface Step {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}

function workflow(file: string): Record<string, unknown> {
  return parse(readFileSync(path.join(root, file), "utf8"), {
    prettyErrors: true,
  }) as Record<string, unknown>;
}

/** steps returns one job's steps, in the order the runner will take them. */
function steps(file: string, job: string): Step[] {
  const jobs = workflow(file)?.jobs as Record<string, { steps?: Step[] }> | undefined;
  const found = jobs?.[job]?.steps;
  assert.ok(Array.isArray(found), `${file}: no ${job} job with steps to read`);
  return found;
}

function step(file: string, job: string, name: string): Step {
  const found = steps(file, job).find((entry) => entry.name === name);
  assert.ok(found?.run, `${file}: no ${job} step named "${name}" with a shell body`);
  return found;
}

test("every automation file this repository carries is valid YAML", () => {
  const files = [".gitea/workflows", ".github/workflows"].flatMap((dir) =>
    readdirSync(path.join(root, dir)).map((entry) => `${dir}/${entry}`),
  );
  assert.ok(files.includes(".gitea/workflows/publish.yml"), "the kit has a publish workflow");
  for (const file of files) {
    assert.doesNotThrow(() => workflow(file), `${file} must parse as YAML`);
  }
});

test("a publish tag and a build tag are different namespaces", () => {
  const tags = (file: string): unknown =>
    (workflow(file).on as { push: { tags: unknown } }).push.tags;
  assert.deepEqual(
    tags(".gitea/workflows/publish.yml"),
    ["kit-v*"],
    "only a kit-v tag may publish the kit",
  );
  assert.deepEqual(
    tags(".gitea/workflows/release.yml"),
    ["v*"],
    "release.yml keeps the tags it always had",
  );
  // Gitea anchors a ref glob, so these two cannot match one tag. The refusal
  // that keeps them apart is one script's, asserted below with the real name.
  assert.throws(() => tagNamesVersion("v0.2.0", "0.2.0"), /release\.yml/);
  assert.equal(tagNamesVersion("kit-v0.2.0", "0.2.0"), undefined);
});

test("a manifest that cannot be published is refused before the registry is asked", () => {
  const publishableManifest = {
    name: "@septagon-oss/platformkit-mobile",
    version: "0.2.0",
    files: ["src", "CHANGELOG.md"],
  };
  assert.equal(publishable(publishableManifest), undefined);
  // npm's own dry run says nothing about private on npm 12.2.0; this does.
  assert.throws(() => publishable({ ...publishableManifest, private: true }), /private/);
  assert.throws(
    () => publishable({ ...publishableManifest, name: "platformkit-mobile" }),
    /scoped/,
    "an unscoped name lands wherever the job's registry points",
  );
  assert.throws(() => publishable({ ...publishableManifest, version: "0.2" }), /exact version/);
  assert.throws(
    () => publishable({ ...publishableManifest, files: ["src"] }),
    /CHANGELOG\.md/,
    "npm packs only its three mandatory files besides files: a changelog not named there does not travel",
  );

  const entry = `## 0.2.0\n\n- catalogVersion: ${SUPPORTED_CATALOG_VERSION}\n`;
  assert.equal(changelogEntry(entry, "0.2.0", SUPPORTED_CATALOG_VERSION), undefined);
  assert.throws(
    () => changelogEntry(entry, "0.3.0", SUPPORTED_CATALOG_VERSION),
    /no entry for 0\.3\.0/,
  );
  // 0.2.1 has no entry of its own, and a parser that matched a prefix would
  // read the 0.2.10 one as its answer.
  assert.throws(
    () => changelogEntry("## 0.2.10\n\n- catalogVersion: 2\n", "0.2.1", 2),
    /no entry for 0\.2\.1/,
  );
  assert.throws(() => changelogEntry("## 0.2.0\n\n- Expo SDK 57\n", "0.2.0", 2), /catalogVersion/);
  assert.throws(
    () => changelogEntry("## 0.2.0\n\n- catalogVersion: 99\n", "0.2.0", 2),
    /this build renders 2/,
    "an entry that names another catalogue version says something false about the release",
  );
});

test("the tree being checked answers for itself", () => {
  assert.equal(manifest.name, "@septagon-oss/platformkit-mobile");
  assert.ok(
    !("private" in manifest),
    "a kit that publishes no version has no reason to hold a private",
  );
  assert.ok(!("publishConfig" in manifest), "the registry arrives from the job, not the manifest");
  assert.ok(manifest.files.includes("CHANGELOG.md"));
  assert.doesNotThrow(() => checkPublish(root));
  assert.doesNotThrow(() => checkPublish(root, `kit-v${manifest.version}`));
  assert.throws(() => checkPublish(root, "kit-v9.9.9"));
});

test("the workflow's own tag step refuses a tag that names another version", (t) =>
  runTagStep(t, `kit-v${manifest.version}`, 0));

test("the workflow's own tag step refuses a build tag", (t) =>
  runTagStep(t, `v${manifest.version}`, 1));

/**
 * runTagStep runs the publish job's tag step as the job runs it, in the
 * repository it checked out. The step is one line and one script; the point is
 * that the job asks the same script `npm run check:publish` asks, so the two can
 * not drift into two opinions of what a tag has to name.
 */
function runTagStep(t: TestContext, tag: string, expected: number): void {
  const body = step(".gitea/workflows/publish.yml", "publish", "The tag names this version").run!;
  const result = spawnSync("bash", ["-c", body], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TAG: tag },
    timeout: 60_000,
  });
  assert.equal(result.status, expected, `${tag}: ${result.stdout}${result.stderr}`);
}

/**
 * publish runs the job's one write step with `npm` as a shell function: the
 * stub records each call, answers `view` from whether the version is meant to
 * exist, and lets nothing reach a registry. `TMPDIR` is a directory of the
 * case's own, so what the step leaves behind — the private directory holding the
 * credential — is visible from outside it.
 */
function publish(
  t: TestContext,
  given: { token?: string; registry?: string; published?: boolean },
): { status: number | null; calls: string; log: string; left: string[] } {
  const temp = mkdtempSync(path.join(os.tmpdir(), "pk-publish-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const body = step(
    ".gitea/workflows/publish.yml",
    "publish",
    "Publish the kit to the forge registry",
  ).run!;
  const result = spawnSync(
    "bash",
    [
      "-c",
      `npm() {
  printf '%s\\n' "$*" >> "$STUB"
  case "$*" in
    *view*)
      if [ "$PUBLISHED" = 1 ]; then return 0; else return 1; fi ;;
    *publish*)
      if [ -f "\${NPM_CONFIG_USERCONFIG:-}" ]; then printf 'userconfig\\n' >> "$STUB"; fi
      return 0 ;;
  esac
}
${body}`,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        TMPDIR: temp,
        STUB: path.join(temp, "calls"),
        PUBLISHED: given.published ? "1" : "0",
        NPM_PUBLISH_TOKEN: given.token ?? "",
        NPM_REGISTRY: given.registry ?? "https://forge.example/api/packages/septagon-oss/npm/",
      },
      timeout: 60_000,
    },
  );
  const calls = existsSync(path.join(temp, "calls"))
    ? readFileSync(path.join(temp, "calls"), "utf8")
    : "";
  return {
    status: result.status,
    calls,
    log: `${result.stdout}${result.stderr}`,
    left: readdirSync(temp).filter((entry) => entry !== "calls"),
  };
}

const TOKEN = "npm_publish_secret_5f2b8d";

test("a publish without the credential refuses on its first line and writes nothing", (t) => {
  // A secret the repository never created expands to the empty string, which is
  // why the refusal is a test the step runs and not an assumption about npm.
  const run = publish(t, {});
  assert.notEqual(run.status, 0, `an unset secret must refuse the publish; logged ${run.log}`);
  assert.match(run.log, /NPM_PUBLISH_TOKEN/, "the refusal names the secret to create");
  assert.doesNotMatch(run.calls, /publish/, "nothing reached a registry");
  assert.equal(run.calls, "", "the step refuses before it asks the registry anything");
});

test("a version the registry already holds is never written again", (t) => {
  // The immutability the registry enforces, said before the attempt: the fix is
  // a new version and a new tag, never this write.
  const run = publish(t, { token: TOKEN, published: true });
  assert.notEqual(run.status, 0, "an existing version refuses the publish");
  assert.match(run.log, /already published/);
  assert.match(run.calls, /view/, "the step did ask, which is what made the refusal say a version");
  assert.doesNotMatch(run.calls, /publish/, "the refusal writes nothing");
  assert.deepEqual(run.left, [], "the private directory the step made is gone with it");
});

test("a version nobody holds publishes to the registry the forge named, with its own credential file", (t) => {
  const run = publish(t, { token: TOKEN });
  assert.equal(run.status, 0, run.log);
  assert.match(
    run.calls,
    /--registry https:\/\/forge\.example\/api\/packages\/septagon-oss\/npm\/ publish/,
    `the write goes where the forge pointed: ${run.calls}`,
  );
  assert.match(run.calls, /^userconfig$/m, "npm is pointed at the file the step generated");
  assert.doesNotMatch(
    `${run.calls}${run.log}`,
    /npm_publish_secret/,
    "the credential is never echoed",
  );
  assert.deepEqual(run.left, [], "the file holding the credential leaves with the step");
});

test("a job the forge gave no registry to is refused rather than pointed at npmjs.org", (t) => {
  const run = publish(t, { token: TOKEN, registry: "/api/packages//npm/" });
  assert.notEqual(run.status, 0, "an empty forge context must not become a default registry");
  assert.doesNotMatch(run.calls, /publish|view/, "nothing is asked of any registry");
});

test("the publish comes after every check, and reads exactly one secret", () => {
  const ordered = steps(".gitea/workflows/publish.yml", "publish");
  const index = (match: (step: Step) => boolean): number => ordered.findIndex(match);
  const checks = index((entry) => entry.run === "npm run check");
  const writes = index((entry) => entry.name === "Publish the kit to the forge registry");
  assert.ok(checks >= 0, "a tag never publishes an unchecked tree");
  assert.ok(writes > checks, "the one write comes after the checks");
  assert.ok(index((entry) => entry.run === "npm ci --no-audit --no-fund") < checks);
  const read = ordered.filter((entry) => JSON.stringify(entry.env ?? {}).includes("secrets."));
  assert.equal(read.length, 1, "only the step that publishes holds a credential");
  assert.equal(read[0]!.name, "Publish the kit to the forge registry");
  assert.ok(!existsSync(path.join(root, ".npmrc")), "no committed npm configuration");
});
