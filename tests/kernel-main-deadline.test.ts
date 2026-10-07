// These cases hold one rule about the nightly's own failure modes: a read that never
// answers is a red that names itself, not a job that sits until something else kills
// it. A hang is the one failure that answers neither red nor green — the runner would
// end the job after twenty minutes with no sentence in the log, and a hand run would
// simply sit there — so the bound lives in the script and arrives as a refusal. What
// is asserted here: the shipped run ends at the bound and returns 1 (the same
// invocation `npm run check:kernel-main` is, against a forge on loopback that accepts
// the request and never answers it); the refusal names the URL, the budget and the
// commit already learned; and a budget that cannot be parsed is refused by name
// instead of ignored, because a bound nobody parsed is a run with no bound. The bound
// a spawned run is given is sized to the runner rather than to the desk — BOUND_MS
// says why — and the harness's own kill is a multiple of it, so losing the bound shows
// up as a killed child with no exit code rather than a green that waited for nothing.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  budget,
  DEFAULT_TIMEOUT_MS,
  endpoints,
  fromEnv,
  readKernelMain,
  type Deps,
} from "../scripts/kernel_main";

const root = path.resolve(import.meta.dirname, "..");
const COMMIT = "83b496784db2b5f9df3c4164b8049022b0ae8dc5";
const TOKEN = "job-token-sentinel";

/**
 * BOUND_MS is the budget the shipped run is asked to end itself at, and BACKSTOP_MS the
 * harness's own kill of the child. The ratio between them is the rule.
 *
 * A bound is a wall clock, so a case that ends a read at one is only as tight as the
 * slowest machine it runs on, and the runner the ci job gets is not the desk. In that
 * job's log of b4783b6 the child this file spawns took 2.6 s to reach the point where it
 * starts its bound, where the same spawn costs 0.12 s here, and the run went red saying
 * the forge had been asked 0 questions: 250 ms had expired before the request ever left
 * the process, so the case was measuring the harness rather than the rule. Both of that
 * job's failures reproduce on the ci Node with the suite pinned to one core and sixteen
 * CPU burners running beside it, which is also where one loopback GET and its answer
 * measured 212 ms against 12 ms here. 10 s is ten times the read that failed and fifty
 * of the slowest exchange measured there; the backstop is four bounds, so a run that
 * ignored its budget is killed long after it would have refused, and a killed child
 * closes on a signal with no exit code, which `run.status === 1` refuses — while the
 * stderr must still name the number the job set. Those two assertions, not a stopwatch,
 * are what this case holds.
 */
const BOUND_MS = 10_000;
const BACKSTOP_MS = 4 * BOUND_MS;

/**
 * deaf is the forge that never answers: it accepts the connection, reads the request
 * and sends nothing back, which is the shape a hung read actually has. Nothing here
 * waits for it to close — the case is over when the script under test stops waiting.
 */
function deaf(t: TestContext): { listening: Promise<string>; asked: string[] } {
  const asked: string[] = [];
  const server = http.createServer((req) => {
    asked.push(req.url ?? "");
  });
  t.after(() => new Promise<void>((done) => server.close(() => done())));
  const listening = new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${String((server.address() as AddressInfo).port)}`),
    );
  });
  return { listening, asked };
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** shipped runs the workflow's own command with the job's three names and a budget. */
function shipped(server: string, timeoutMs: string): Promise<Spawned> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        createRequire(import.meta.url).resolve("tsx"),
        path.join(root, "scripts/kernel_main.ts"),
      ],
      {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PK_KERNEL_SERVER: server,
          PK_KERNEL_REPOSITORY: "septagon-oss/platformkit",
          GITHUB_TOKEN: TOKEN,
          PK_KERNEL_TIMEOUT_MS: timeoutMs,
        },
      },
    );
    // A child that never closes would take the suite with it; the bound is the thing
    // under test, so this one is only the harness's own backstop, well outside it.
    const kill = setTimeout(() => child.kill("SIGKILL"), BACKSTOP_MS);
    kill.unref();
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (out += chunk));
    child.stderr.on("data", (chunk: string) => (err += chunk));
    child.on("close", (code) => {
      clearTimeout(kill);
      resolve({ status: code ?? -1, out, err });
    });
  });
}

interface Spawned {
  readonly status: number;
  readonly out: string;
  readonly err: string;
}

const deps = (over: Partial<Deps>): Deps => ({
  server: "http://forge.test:3000",
  repository: "septagon-oss/platformkit",
  token: TOKEN,
  fetch: (async () => new Response("", { status: 500 })) as unknown as typeof fetch,
  now: () => new Date("2026-10-07T04:47:02Z"),
  ...over,
});

test("the shipped run ends its read at the bound and returns 1", async (t) => {
  const forge = deaf(t);
  const server = await forge.listening;
  const started = Date.now();
  const run = await shipped(server, String(BOUND_MS));
  const elapsed = Date.now() - started;
  assert.equal(
    run.status,
    1,
    `a hung read that exits 0 is a nightly that never goes red\n${run.out}${run.err}`,
  );
  assert.match(
    run.err,
    new RegExp(
      `^kernel-main: refused fetch: GET ${escapeRegExp(`${server}/api/v1/repos/septagon-oss/platformkit/commits`)}\\?sha=main&limit=1 did not answer within the job's ${String(BOUND_MS)}ms bound`,
      "m",
    ),
  );
  assert.ok(!run.out.includes("this build reads kernel main"), "a hung read prints no agreement");
  assert.ok(
    !run.out.includes(TOKEN) && !run.err.includes(TOKEN),
    "the token never reaches a job log",
  );
  assert.equal(
    forge.asked.length,
    1,
    "and it is the bound that stopped the run, not a fourth question",
  );
  // The harness kills at four bounds; a run that closed inside three of them was ended
  // by its own budget, spawn and tsx start-up included (2.6 s on the runner, measured).
  assert.ok(
    elapsed < BACKSTOP_MS - BOUND_MS,
    `the bound ended the run in ${String(elapsed)}ms; the harness's own kill is ${String(BACKSTOP_MS)}ms`,
  );
});

test("a budget that cannot be read is refused by name, and an absent one is the default", () => {
  for (const raw of ["0", "-1000", "12s", "  "]) {
    // A value that is not a number of milliseconds must not become "no bound": the
    // whole point of the budget is that every run has one.
    assert.throws(
      () =>
        fromEnv({
          PK_KERNEL_SERVER: "http://forge.test:3000",
          PK_KERNEL_REPOSITORY: "septagon-oss/platformkit",
          GITHUB_TOKEN: TOKEN,
          PK_KERNEL_TIMEOUT_MS: raw,
        }),
      /PK_KERNEL_TIMEOUT_MS is not a positive whole number of milliseconds/,
      `"${raw}" cannot be read as a bound`,
    );
  }
  // An empty line means the job set nothing, which is the same answer as no line: the
  // default, not an unbounded run.
  assert.equal(budget(""), DEFAULT_TIMEOUT_MS);
  assert.equal(budget(undefined), DEFAULT_TIMEOUT_MS);
  assert.equal(fromEnv({}).timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(fromEnv({ PK_KERNEL_TIMEOUT_MS: "45000" }).timeoutMs, 45_000);
  // The bound is inside the job's own ceiling: 20 minutes of runner, two minutes here.
  assert.ok(DEFAULT_TIMEOUT_MS < 20 * 60_000);
});

test("a first read that never answers is refused with the URL and the budget", async () => {
  const d = deps({
    timeoutMs: 25,
    fetch: (async (_url: string | URL | Request, init?: RequestInit) =>
      // The signal the script started is the only thing that ends this: the double
      // answers nothing until it is aborted, which is a hang without a timer of its
      // own. The five seconds below is the harness's own backstop, so a build that
      // lost the bound fails this case instead of hanging the suite forever.
      new Promise<Response>((resolve, reject) => {
        (init?.signal as AbortSignal | null)?.addEventListener("abort", () =>
          reject(new DOMException("This operation was aborted", "AbortError")),
        );
        setTimeout(() => resolve(new Response("", { status: 500 })), 5_000).unref();
      })) as unknown as typeof fetch,
  });
  const verdict = await readKernelMain(d);
  assert.match(verdict.refusal!, /did not answer within the job's 25ms bound/);
  assert.match(
    verdict.refusal!,
    new RegExp(`GET ${escapeRegExp(endpoints(d).commits)} did not answer`),
  );
  assert.equal(verdict.kernelCommit, null, "there was no commit to name");
});

test("a body that stops arriving is refused at the file, and still names its commit", async () => {
  // The second await of a read is the body. A bound on the response alone would not
  // have seen this one: what a real fetch does when its signal aborts is error the
  // body stream, which is what the double below does rather than pretending.
  const head = async (): Promise<Response> =>
    new Response(JSON.stringify([{ sha: COMMIT }]), { status: 200 });
  let calls = 0;
  const d = deps({
    timeoutMs: 25,
    fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) return head();
      return new Response(stopsOnAbort(init?.signal), { status: 200 });
    }) as unknown as typeof fetch,
  });
  const verdict = await readKernelMain(d);
  assert.equal(calls, 2, "the tip was answered and the catalogue was not");
  assert.match(verdict.refusal!, /did not answer within the job's 25ms bound/);
  assert.match(
    verdict.refusal!,
    new RegExp(`raw/${escapeRegExp("ui/screens/testdata/catalog.json")}`),
  );
  assert.equal(
    verdict.kernelCommit,
    COMMIT,
    "the commit it learned is still the commit it refused at",
  );
});

test("a body that breaks for a reason of its own is refused at the file too", async () => {
  // Before this branch existed, a body that died threw out of the read: the run
  // printed the bare exception and no URL, no file and no commit.
  let calls = 0;
  const d = deps({
    timeoutMs: 10_000,
    fetch: (async () => {
      calls += 1;
      if (calls === 1) return new Response(JSON.stringify([{ sha: COMMIT }]), { status: 200 });
      return new Response(
        new ReadableStream<Uint8Array>({
          start: (c) => c.error(new Error("socket hang up")),
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch,
  });
  const verdict = await readKernelMain(d);
  assert.match(verdict.refusal!, /answered 200 and then stopped sending: socket hang up/);
  assert.match(verdict.refusal!, /raw\/ui\/screens\/testdata\/catalog\.json/);
  assert.equal(verdict.kernelCommit, COMMIT);
});

/** stopsOnAbort is a body that stops the way undici's does when the read is ended. */
function stopsOnAbort(signal: AbortSignal | null | undefined): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start: (controller) => {
      signal?.addEventListener("abort", () =>
        controller.error(new DOMException("This operation was aborted", "AbortError")),
      );
      // The harness's backstop again: bytes that never arrive must become a failed
      // case, not a suite that waits for nothing.
      setTimeout(
        () => controller.error(new Error("the double answered after five seconds")),
        5_000,
      ).unref();
    },
    // No push and no close: the bytes stop arriving until the read is ended.
  });
}
