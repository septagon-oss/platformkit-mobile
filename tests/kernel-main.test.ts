// The nightly's whole rule lives in scripts/kernel_main.ts, and every case here
// runs the pair that workflow step runs — `readKernelMain` over a transport
// double, `decide` over bytes — so a case that passes here is the nightly
// refusing or agreeing for the reason it would give on a runner. What the cases
// hold: the two documents are read at one commit learned first; a refusal names
// the field, the file or the status that answered, never the credential; a fetch
// problem reads as a fetch problem and stops before a file is asked for; and the
// catalogue half is `parseCatalog`'s own sentence, which is why no catalogue case
// here is answered by a rule this file wrote.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CATALOG_FILE,
  configRefusal,
  decide,
  endpoints,
  fromEnv,
  judgeCatalog,
  judgeOpenApi,
  kernelMain,
  OPENAPI_FILE,
  readKernelMain,
  report,
  tip,
  type Deps,
} from "../scripts/kernel_main";
import { SUPPORTED_CATALOG_VERSION } from "../src/core/catalog";

const root = path.resolve(import.meta.dirname, "..");
const golden = () =>
  JSON.parse(readFileSync(path.join(root, "testdata/catalog.json"), "utf8")) as Record<
    string,
    unknown
  >;

// One commit, one instant: `checkedAt` comes from the injected clock, so a run
// answers the same way twice and the assertion says which run it is asserting.
const COMMIT = "83b496784db2b5f9df3c4164b8049022b0ae8dc5";
const AT = "2026-10-07T04:47:02Z";
const TOKEN = "job-token-sentinel";

// The OpenAPI document is written here, with path keys chosen independently of
// the catalogue's addresses, so a green `paths` count is not the fixture agreeing
// with itself. Nothing in this repository reads one of these fields yet.
const openapi = {
  openapi: "3.1.0",
  info: { title: "PlatformKit", version: "v1" },
  paths: {
    "/api/v1/widget/widgets": { get: { responses: { "200": { description: "widgets" } } } },
    "/api/v1/gadget/gadgets": { post: { responses: { "201": { description: "created" } } } },
  },
};

/**
 * The transport double is the `fakeFetch` shape of tests/api.test.ts, copied and
 * not shared: that one answers `Response(JSON.stringify(body))` for createApi's
 * JSON transport, and this port answers `text/plain` bytes — the measured shape
 * of a good Gitea raw read — so one double would have to carry both answers and
 * the branch that chooses between them.
 */
type Answer = { status: number; body?: unknown; text?: string };
interface Call {
  url: string;
  init: RequestInit;
}
function fakeFetch(answers: Answer[]) {
  const calls: Call[] = [];
  const respond = async (url: string, init: RequestInit = {}): Promise<Response> => {
    calls.push({ url, init });
    const answer = answers.shift();
    if (answer === undefined) throw new Error(`the read asked a fourth question: ${url}`);
    const body = answer.text ?? (answer.body === undefined ? "" : JSON.stringify(answer.body));
    return new Response(body, {
      status: answer.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  };
  return { fetch: respond as unknown as typeof fetch, calls };
}

const wired = (answers: Answer[]): { d: Deps; calls: Call[] } => {
  const { fetch, calls } = fakeFetch(answers);
  return {
    calls,
    d: {
      server: "http://forge.test:3000",
      repository: "septagon-oss/platformkit",
      token: TOKEN,
      fetch,
      now: () => new Date(AT),
    },
  };
};

const head = (sha: string = COMMIT): Answer => ({ status: 200, body: [{ sha }] });
const green = (catalog: unknown = golden()): Answer[] => [
  head(),
  { status: 200, body: catalog },
  { status: 200, body: openapi },
];

const authorization = (call: Call): string => {
  const headers = new Headers(call.init.headers);
  return headers.get("authorization") ?? "";
};

test("this build reads kernel main as it stands", async () => {
  const { d, calls } = wired(green());
  const verdict = await kernelMain(d);
  assert.equal(verdict.refusal, null);
  assert.equal(verdict.kernelCommit, COMMIT);
  assert.equal(verdict.checkedAt, AT);
  assert.equal(verdict.read.length, 2);
  assert.match(
    verdict.read[0]!,
    new RegExp(
      `^catalog ${CATALOG_FILE.replace(/[/.]/g, "\\$&")} sha256=[0-9a-f]{64} bytes=\\d+, version 2, 3 entries$`,
    ),
  );
  assert.match(
    verdict.read[1]!,
    new RegExp(
      `^openapi ${OPENAPI_FILE.replace(/[/.]/g, "\\$&")} sha256=[0-9a-f]{64} bytes=\\d+, 2 paths$`,
    ),
  );
  assert.equal(calls.length, 3);
  // A good answer is text/plain on this forge, so the port must not read the
  // header at all: the green above is the assertion that it does not.
});

test("a catalogue newer than this build renders is refused by the field that moved", async () => {
  const { d } = wired(green({ ...golden(), catalogVersion: SUPPORTED_CATALOG_VERSION + 1 }));
  const verdict = await kernelMain(d);
  assert.equal(
    verdict.refusal,
    `catalog: catalogVersion is ${SUPPORTED_CATALOG_VERSION + 1}; this build renders up to ${SUPPORTED_CATALOG_VERSION} and would draw screens from fields it cannot see`,
  );
  assert.equal(verdict.kernelCommit, COMMIT);
  assert.equal(verdict.read.length, 2, "both documents are still named on a red night");
});

test("a catalogue that is not a document is refused at the document", async () => {
  const { d } = wired(green([]));
  const verdict = await kernelMain(d);
  assert.equal(verdict.refusal, "catalog: document is not an object");
});

test("a sign-in wall answering 200 is refused where it lands, and the byte count names it", async () => {
  // The body this forge answers an anonymous call with, served at 200 — the one
  // residual of this design: a proxy that answers 200 with the forge's own
  // envelope reaches the parser instead of the fetch layer, so the refusal is
  // the parser's. That is a false red, never a false green, and the printed byte
  // count and sha are what identify it in one line of the log.
  const envelope = '{"message":"Only signed in user is allowed to call APIs."}';
  const { d } = wired([head(), { status: 200, text: envelope }, { status: 200, body: openapi }]);
  const verdict = await kernelMain(d);
  assert.equal(verdict.refusal, "catalog: resources is not a list");
  assert.match(verdict.read[0]!, new RegExp(`bytes=${String(envelope.length)}$`));
});

test("an html page answering 200 is not read as a contract", async () => {
  const { d } = wired([
    head(),
    { status: 200, text: "<html><body>Sign in</body></html>" },
    { status: 200, body: openapi },
  ]);
  const verdict = await kernelMain(d);
  assert.equal(verdict.refusal, "catalog: document is not JSON");
});

test("a refused credential is a credential problem, and nothing else is asked", async () => {
  const { d, calls } = wired([
    { status: 401, text: '{"message":"invalid username, password or token"}' },
  ]);
  const verdict = await kernelMain(d);
  assert.match(
    verdict.refusal!,
    new RegExp(
      `^fetch: GET http://forge\\.test:3000/api/v1/repos/septagon-oss/platformkit/commits\\?sha=main&limit=1 answered 401 —`,
    ),
  );
  assert.match(
    verdict.refusal!,
    /the job's token was refused for a cross-repository read of septagon-oss\/platformkit/,
  );
  assert.equal(verdict.kernelCommit, null);
  assert.equal(verdict.checkedAt, null);
  assert.deepEqual(verdict.read, []);
  assert.equal(calls.length, 1, "with no commit there is nothing to fetch the two files at");
});

test("a tip that is not one commit is not a commit to read at", async () => {
  const empty = wired([{ status: 200, body: [] }]);
  const emptyRun = await readKernelMain(empty.d);
  assert.match(
    emptyRun.refusal!,
    /answered 200 with 0 commits; a branch tip is exactly one 40-character commit/,
  );
  assert.equal(empty.calls.length, 1);

  const envelope = wired([
    { status: 200, text: '{"message":"Only signed in user is allowed to call APIs."}' },
  ]);
  const envelopeRun = await readKernelMain(envelope.d);
  assert.match(envelopeRun.refusal!, /a body that is not a list/);
  assert.equal(envelope.calls.length, 1);
});

test("an abbreviated tip is refused because an abbreviation moves", async () => {
  const { d, calls } = wired([head("83b4967")]);
  const verdict = await readKernelMain(d);
  assert.match(verdict.refusal!, /"83b4967", which is not a 40-character commit object id/);
  assert.match(verdict.refusal!, /not a 40-character commit/);
  assert.equal(calls.length, 1);
});

test("a file no longer on main is refused by its own name, at the commit it was asked for", async () => {
  const { d, calls } = wired([head(), { status: 404, text: '{"message":"not found"}' }]);
  const verdict = await readKernelMain(d);
  assert.match(
    verdict.refusal!,
    new RegExp(
      `^fetch: GET http://forge\\.test:3000/api/v1/repos/septagon-oss/platformkit/raw/${CATALOG_FILE.replace(/[/.]/g, "\\$&")}\\?ref=${COMMIT} answered 404 —`,
    ),
  );
  assert.match(
    verdict.refusal!,
    new RegExp(`${CATALOG_FILE} is not in septagon-oss/platformkit at ${COMMIT}`),
  );
  assert.equal(verdict.kernelCommit, COMMIT, "the commit it asked for is the commit it refused at");
  assert.deepEqual(verdict.read, []);
  assert.equal(calls.length, 2);
});

test("both files are read at the one commit the tip named, never at the moving ref", async () => {
  const { d, calls } = wired(green());
  await kernelMain(d);
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      `http://forge.test:3000/api/v1/repos/septagon-oss/platformkit/commits?sha=main&limit=1`,
      `http://forge.test:3000/api/v1/repos/septagon-oss/platformkit/raw/${CATALOG_FILE}?ref=${COMMIT}`,
      `http://forge.test:3000/api/v1/repos/septagon-oss/platformkit/raw/${OPENAPI_FILE}?ref=${COMMIT}`,
    ],
  );
  for (const call of calls.slice(1)) assert.ok(!call.url.includes("ref=main"));
});

test("the token reaches every request and never reaches the log", async () => {
  const { d, calls } = wired(green({ ...golden(), catalogVersion: SUPPORTED_CATALOG_VERSION + 1 }));
  const verdict = await kernelMain(d);
  assert.equal(calls.length, 3);
  for (const call of calls) assert.equal(authorization(call), `token ${TOKEN}`);
  const printed = report(verdict, d.repository);
  for (const line of [...printed.out, ...printed.err]) assert.ok(!line.includes(TOKEN), line);
  assert.ok(!`${verdict.read.join("\n")}${verdict.refusal}`.includes(TOKEN));
});

test("the job names what it reads, and an empty name is refused before a request", async () => {
  const named: Record<"server" | "repository" | "token", [string, RegExp]> = {
    server: ["PK_KERNEL_SERVER", /PK_KERNEL_SERVER is empty/],
    repository: ["PK_KERNEL_REPOSITORY", /PK_KERNEL_REPOSITORY is empty/],
    token: ["GITHUB_TOKEN", /GITHUB_TOKEN is empty/],
  };
  for (const [field, [variable, expected]] of Object.entries(named) as [
    "server" | "repository" | "token",
    [string, RegExp],
  ][]) {
    const { d, calls } = wired(green());
    const verdict = await kernelMain({ ...d, [field]: "" });
    assert.match(verdict.refusal!, expected, `${variable} is refused by name`);
    assert.match(verdict.refusal!, /^config: /);
    assert.equal(configRefusal({ ...d, [field]: "" }), verdict.refusal);
    assert.deepEqual(
      calls,
      [],
      `an empty ${field} is refused before a request: a default would make the job read somebody else's ${field}`,
    );
    assert.equal(verdict.kernelCommit, null);
    assert.deepEqual(verdict.read, []);
  }
});

test("fromEnv reads exactly the three names the job sets, and nothing else", () => {
  const named = fromEnv({
    PK_KERNEL_SERVER: "http://forge.test:3000",
    PK_KERNEL_REPOSITORY: "septagon-oss/platformkit",
    GITHUB_TOKEN: TOKEN,
    PK_UNRELATED: "ignored",
  });
  assert.equal(named.server, "http://forge.test:3000");
  assert.equal(named.repository, "septagon-oss/platformkit");
  assert.equal(named.token, TOKEN);
  assert.equal(named.fetch, globalThis.fetch, "the default transport is the one the job runs");
  const empty = fromEnv({});
  assert.deepEqual([empty.server, empty.repository, empty.token], ["", "", ""]);
  assert.ok(
    empty.now() instanceof Date,
    "the clock arrives through Deps, never as Date.now at the call site",
  );
});

test("the document half refuses at the fields that make it a document", () => {
  const pathKey = "/api/v1/widget/widgets";
  const cases: [unknown, string][] = [
    [
      { swagger: "2.0", paths: { [pathKey]: {} } },
      "openapi: openapi is undefined, not a 3.x document",
    ],
    [{ openapi: "2.0", paths: { [pathKey]: {} } }, 'openapi: openapi is "2.0", not a 3.x document'],
    [{ openapi: "3.1.0" }, "openapi: paths is not an object"],
    [{ openapi: "3.1.0", paths: {} }, "openapi: paths is empty"],
    [[], "openapi: document is not an object"],
  ];
  for (const [document, refusal] of cases) {
    const judged = judgeOpenApi(Buffer.from(JSON.stringify(document)));
    assert.equal(judged.refusal, refusal);
    assert.match(
      judged.line,
      /^openapi apps\/platformkit\/testdata\/openapi\.json sha256=[0-9a-f]{64} bytes=\d+$/,
    );
  }
  assert.equal(judgeOpenApi(Buffer.from("<html>")).refusal, "openapi: document is not JSON");
  assert.equal(judgeOpenApi(Buffer.from(JSON.stringify(openapi))).refusal, null);
});

test("the first refused path is the catalogue's, and both documents are still printed", () => {
  const catalog = judgeCatalog(Buffer.from(JSON.stringify({ ...golden(), resources: "none" })));
  const document = judgeOpenApi(Buffer.from(JSON.stringify({ openapi: "2.0" })));
  assert.equal(catalog.refusal, "catalog: resources is not a list");
  assert.equal(document.refusal, 'openapi: openapi is "2.0", not a 3.x document');
  const verdict = decide({
    kernelCommit: COMMIT,
    checkedAt: AT,
    catalog: Buffer.from(JSON.stringify({ ...golden(), resources: "none" })),
    openapi: Buffer.from(JSON.stringify({ openapi: "2.0" })),
  });
  assert.equal(verdict.refusal, catalog.refusal);
  assert.equal(verdict.read.length, 2);
});

test("a green run prints the commit first and the answer last", async () => {
  const { d } = wired(green());
  const verdict = await kernelMain(d);
  const printed = report(verdict, d.repository);
  assert.deepEqual(printed.err, []);
  assert.equal(
    printed.out[0],
    `kernel-main: kernel ${COMMIT} read at ${AT} from septagon-oss/platformkit main`,
  );
  assert.equal(printed.out.at(-1), "kernel-main: this build reads kernel main");
});

test("a red run prints the kernel commit and the first refused path", async () => {
  const { d } = wired(green({ ...golden(), catalogVersion: SUPPORTED_CATALOG_VERSION + 1 }));
  const verdict = await kernelMain(d);
  const printed = report(verdict, d.repository);
  assert.match(printed.out[0]!, new RegExp(`^kernel-main: kernel ${COMMIT} read at ${AT} from `));
  assert.deepEqual(printed.err, [
    `kernel-main: refused catalog: catalogVersion is ${SUPPORTED_CATALOG_VERSION + 1}; this build renders up to ${SUPPORTED_CATALOG_VERSION} and would draw screens from fields it cannot see`,
  ]);
});

test("a server that cannot be reached is named with the URL and the cause", async () => {
  const { d } = wired([]);
  const unreachable = {
    ...d,
    fetch: (async () => {
      throw new TypeError("fetch failed", { cause: new Error("bad port") });
    }) as unknown as typeof fetch,
  };
  const verdict = await readKernelMain(unreachable);
  assert.equal(
    verdict.refusal,
    `fetch: GET ${endpoints(d).commits} could not be reached: fetch failed: bad port`,
  );
});

test("the nightly's gate is a script line, and it stays out of the merge gate", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.equal(manifest.scripts["check:kernel-main"], "node --import tsx scripts/kernel_main.ts");
  assert.ok(
    !manifest.scripts.check!.includes("kernel-main"),
    "npm run check runs with no token and sometimes no network; a gate that needs a credential refuses every change for a reason that is not the change",
  );
});

test("the workflow is scheduled, blocking, and asks for nothing but a read", () => {
  const text = readFileSync(path.join(root, ".gitea/workflows/kernel-main.yml"), "utf8");
  assert.match(text, /^ {2}schedule:/m);
  assert.match(text, /^ {4}- cron: '\d+ \d+ \* \* \*'$/m);
  assert.match(text, /^ {4}runs-on: pkit-ci-linux-amd64$/m);
  assert.match(text, /^permissions:\n {2}contents: read$/m);
  assert.match(text, /^ {2}cancel-in-progress: false$/m);
  assert.match(text, /^ {6}PK_KERNEL_SERVER: \$\{\{ github\.server_url \}\}$/m);
  assert.match(text, /^ {6}PK_KERNEL_REPOSITORY: septagon-oss\/platformkit$/m);
  assert.match(text, /^ {6}GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}$/m);
  assert.match(text, /^ {8}run: npm run check:kernel-main$/m);
  // The loop's own probe, as a case: what the metric measures is what the suite
  // protects. A comment that says the words would fail here too, which is the
  // point — the file states the rule as `mobile-e2e.yml` states it instead.
  assert.doesNotMatch(text, /continue-on-error/);
});

test("the tip's own shape is the guard, so a 200 cannot answer for two commits", () => {
  assert.deepEqual(tip("u", Buffer.from(JSON.stringify([{ sha: COMMIT }]))), {
    sha: COMMIT,
    refusal: null,
  });
  assert.match(tip("u", Buffer.from("[{}]")).refusal!, /not a 40-character commit/);
  assert.match(tip("u", Buffer.from("[]")).refusal!, /0 commits/);
  assert.match(
    tip("u", Buffer.from(`[{"sha":"${COMMIT.toUpperCase()}"}]`)).refusal!,
    /not a 40-character commit/,
  );
});
