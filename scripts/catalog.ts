// catalog.ts keeps testdata/catalog.json honest about where it came from.
//
// The fixture is the public repository's own golden file and every screen in this
// app is derived from it. "Copied by hand and believed" is how a fixture becomes a
// fiction: the server changes the contract, the copy stays, and the suites go on
// passing against a document no server serves. So the copy carries a provenance
// record in testdata/catalog.source.json — the same shape
// testdata/design-tokens.source.json uses: schema, fixture, SHA-256 and an upstream
// commit that is 40 characters because a commit, unlike a tag, cannot move under it.
//
//   check    (offline, run by the suite) the bytes here hash to what the record
//            says, so editing the copy to make a test pass is a failure.
//   drift    (by hand, reports) fetch the recorded commit and compare; then ask
//            the public module proxy which version an outside `go get` would take
//            and whether its catalog differs. The proxy is asked up to three times
//            when an attempt says nothing at all — a connect that times out is a
//            moment on this machine, not a fact about the module — and once when it
//            answers about the path. Neither question can be answered
//            offline, so it reports rather than blocks, and no schedule runs even
//            that: .gitea/workflows/drift.yml is the weekly report of what the
//            SDK, the dependency tree, the advisories and the fingerprint say, and
//            holds no catalog step. The nightly .gitea/workflows/kernel-main.yml
//            does not run this command either — it asks the other question: drift
//            asks whether the commit this file recorded has moved, kernel-main
//            reads kernel main's own bytes through parseCatalog and fails when this
//            build cannot read them.
//   refresh  (deliberate) rewrite the fixture from the recorded commit. The pin
//            itself only moves by editing that commit field, which is a diff.
//
// The validator here and the one in scripts/tokens.ts are deliberately parallel for
// now rather than generalised across a working build-input pipeline; the test in
// tests/catalog.test.ts refuses the two records from forking in their field names,
// and sharing the implementation is a separate change.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

export const FIXTURE = "testdata/catalog.json";
export const SOURCE = "testdata/catalog.source.json";
const SOURCE_SCHEMA = "platformkit.catalog-source.v1";

export interface Upstream {
  readonly repository: string;
  readonly commit: string;
  readonly tag: string;
  readonly path: string;
  readonly command: string;
}

export interface Source {
  readonly schema: string;
  readonly fixture: string;
  readonly sha256: string;
  readonly upstream: Upstream;
}

export const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

/** isRecord is the one shape test every document read here has to pass. */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * why names what a transport actually said. undici puts the reason a fetch failed
 * — the unreachable address, the closed socket, the timeout — on `cause`, so a
 * refusal that reads only `message` says "fetch failed" and nothing anyone can act
 * on. The nightly and the drift report read the same kind of transport, so they
 * read it with the one sentence.
 */
export const why = (cause: unknown): string => {
  if (!(cause instanceof Error)) return String(cause);
  const inner = (cause as { cause?: unknown }).cause;
  const detail = inner instanceof Error ? inner.message : inner === undefined ? "" : String(inner);
  return detail === "" ? cause.message : `${cause.message}: ${detail}`;
};

/**
 * provenance reads a record that can vouch for the fixture, refusing one that
 * cannot. The rules are not decoration: a record allowed to name any host, a
 * floating ref or a path outside the repository would make every comparison below
 * fetch whatever it liked and call the answer a contract.
 */
export function provenance(v: unknown): Source {
  if (!isRecord(v) || v.schema !== SOURCE_SCHEMA)
    throw new Error(`catalog source: schema is not ${SOURCE_SCHEMA}`);
  if (v.fixture !== FIXTURE) throw new Error(`catalog source: fixture is not ${FIXTURE}`);
  if (typeof v.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.sha256))
    throw new Error("catalog source: sha256 is not a hex SHA-256");
  const u = v.upstream;
  if (!isRecord(u) || typeof u.repository !== "string" || !/^https:\/\//.test(u.repository))
    throw new Error("catalog source: upstream.repository is not an https URL");
  if (typeof u.commit !== "string" || !/^[0-9a-f]{40}$/.test(u.commit))
    throw new Error("catalog source: upstream.commit is not a full commit ID");
  if (typeof u.path !== "string" || !/^[A-Za-z0-9._/-]+$/.test(u.path) || u.path.includes(".."))
    throw new Error("catalog source: upstream.path is not a plain repository path");
  if (typeof u.command !== "string" || u.command === "")
    throw new Error("catalog source: upstream.command is empty");
  // The command is how a person reproduced this. If it names a different commit or
  // a different file, the record describes bytes nothing produced.
  if (!u.command.includes(u.commit) || !u.command.includes(u.path))
    throw new Error("catalog source: upstream.command does not name the recorded commit and path");
  const tag = typeof u.tag === "string" && /^v\d+\.\d+\.\d+[-\w.]*$/.test(u.tag) ? u.tag : u.commit;
  return {
    schema: SOURCE_SCHEMA,
    fixture: FIXTURE,
    sha256: v.sha256,
    upstream: { repository: u.repository, commit: u.commit, tag, path: u.path, command: u.command },
  };
}

export async function readSource(): Promise<Source> {
  return provenance(JSON.parse(await readFile(SOURCE, "utf8")) as unknown);
}

/**
 * raw turns the recorded repository and revision into a file fetch. Only GitHub
 * serves raw files today; a second host is added here, in the open, rather than
 * arriving through a fixture record that could name anything.
 */
export function raw(source: Source, revision?: string): string {
  const host = new URL(source.upstream.repository);
  if (host.hostname !== "github.com" || !host.pathname)
    throw new Error(`catalog source: ${source.upstream.repository} has no raw file source here`);
  const repo = host.pathname.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
  return `https://raw.githubusercontent.com/${repo}/${revision ?? source.upstream.commit}/${source.upstream.path}`;
}

/** check compares the bytes on disk with the recorded provenance. No network. */
export async function check(): Promise<string> {
  const source = await readSource();
  const got = hash(await readFile(FIXTURE));
  if (got !== source.sha256)
    throw new Error(
      `${FIXTURE} is not what ${SOURCE} says it is:\n  recorded ${source.sha256}\n  on disk  ${got}\n` +
        `It is copied from ${source.upstream.commit.slice(0, 12)}. Either restore that file or run ` +
        `node --import tsx scripts/catalog.ts refresh and review the diff.`,
    );
  return `${FIXTURE} matches ${source.upstream.tag} (${got.slice(0, 12)}…)`;
}

async function fetchAt(source: Source, revision: string): Promise<Buffer> {
  const response = await fetch(raw(source, revision), {
    headers: { "user-agent": "platformkit-mobile" },
  });
  if (!response.ok) throw new Error(`${raw(source, revision)} answered ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** refresh rewrites the fixture and its hash from the recorded commit. Deliberate. */
export async function refresh(): Promise<string> {
  const source = await readSource();
  const bytes = await fetchAt(source, source.upstream.commit);
  const got = hash(bytes);
  if (got === source.sha256)
    return `${FIXTURE} is already what ${source.upstream.commit.slice(0, 12)} has (${got.slice(0, 12)}…)`;
  const updated: Source = { ...source, sha256: got };
  await writeFile(FIXTURE, bytes);
  await writeFile(SOURCE, `${JSON.stringify(updated, null, 2)}\n`);
  return `refreshed ${FIXTURE} from ${source.upstream.commit.slice(0, 12)}: ${source.sha256.slice(0, 12)}… -> ${got.slice(0, 12)}…`;
}

/**
 * What the public module proxy told us. Three states, not two: a lookup that
 * failed is not agreement that nothing new was published. The first version of
 * this file asked the proxy for `septagon-oss/platformkit` instead of
 * `github.com/septagon-oss/platformkit`, got a 404, returned "" and printed
 * "ok, this is the latest version" — a check reporting green because it never
 * asked the question. `unreachable` exists so that mistake is a distinct answer.
 */
export type LatestLookup =
  | { state: "latest"; version: string }
  | { state: "ahead"; version: string; bytes: Buffer }
  | { state: "unreachable"; detail: string };

/**
 * report answers both questions from bytes rather than the network, so each branch
 * is testable instead of awaited: has our copy moved away from the commit it names,
 * and has a newer published version changed the contract underneath it?
 */
export function report(
  source: Source,
  local: Buffer,
  pinned: Buffer,
  latest: LatestLookup = { state: "latest", version: source.upstream.tag },
): readonly string[] {
  const lines = [
    hash(local) === hash(pinned)
      ? `ok  ${FIXTURE} still matches ${source.upstream.tag}`
      : `DRIFT ${FIXTURE} differs from ${source.upstream.tag}; run node --import tsx scripts/catalog.ts refresh`,
  ];
  if (latest.state === "unreachable") {
    lines.push(`note  cannot tell whether a newer version is published: ${latest.detail}`);
    return lines;
  }
  if (latest.state === "latest") {
    lines.push(`ok  ${source.upstream.tag} is the version the public module resolves as latest`);
    return lines;
  }
  lines.push(
    hash(latest.bytes) === hash(pinned)
      ? `note  ${latest.version} is published; its catalog is the same shape we track`
      : `DRIFT ${latest.version} is published and its catalog differs from the ${source.upstream.tag} copy this app is tested against`,
  );
  return lines;
}

/** drift is report's thin effectful shell. */
export async function drift(): Promise<string> {
  const source = await readSource();
  const [local, pinned, latest] = await Promise.all([
    readFile(FIXTURE),
    fetchAt(source, source.upstream.commit),
    lookupLatest(source),
  ]);
  const answered =
    latest.state === "unreachable" || latest.version === source.upstream.tag
      ? latest
      : {
          state: "ahead" as const,
          version: latest.version,
          bytes: await fetchAt(source, latest.version),
        };
  return report(source, local, pinned, answered).join("\n");
}

/**
 * proxyPath turns the recorded repository URL into the Go module path the public
 * proxy indexes. The host is part of the path — `proxy.golang.org/github.com/…`,
 * not `proxy.golang.org/…` — which is the mistake this comment exists to keep
 * somebody from repeating, and lowercase because the proxy escapes by case.
 */
export function proxyPath(source: Source): string {
  const url = new URL(source.upstream.repository);
  return `${url.hostname}${url.pathname}`
    .replace(/^\/|\/$/g, "")
    .replace(/\.git$/, "")
    .toLowerCase();
}

/**
 * Deps is what the proxy question needs from outside itself: a transport and a
 * way to wait between attempts. Both arrive from the caller so the asking below
 * is a case in tests/catalog-drift.test.ts rather than a wait for one.
 */
export interface Deps {
  readonly fetch: typeof fetch;
  readonly wait: (ms: number) => Promise<void>;
}

const live: Deps = {
  fetch,
  wait: (ms) => new Promise<void>((done) => setTimeout(done, ms)),
};

/**
 * An attempt ends three ways: the version, an answer about the path, and silence.
 * Only silence is asked again — a connect that times out, a socket that closes,
 * a 5xx from a cache and a 408 or 429 that say "later" all say nothing about
 * whether a newer version is published. A status that does answer — a 404 above
 * all, which is what a wrong module path looks like — is returned at once, so
 * asking twice cannot turn the one failure this lookup exists to report into a
 * note three attempts late.
 */
type Answer =
  | { kind: "version"; version: string }
  | { kind: "answered"; detail: string }
  | { kind: "silence"; detail: string };

/**
 * silence is what a host running many suites at once does to a public cache: the
 * measured shape of the failure is undici giving up on the connect after ten
 * seconds — `fetch failed: Connect Timeout Error (…, timeout: 10000ms)` — which
 * is a moment on this machine, not a fact about the module. ATTEMPTS asks a
 * second and third time for that reason; the pause is small because the failed
 * attempt has already waited the ten seconds the transport allows.
 */
const ATTEMPTS = 3;
const PAUSE_MS = 500;
const later = (status: number): boolean => status >= 500 || status === 408 || status === 429;

async function ask(deps: Deps, target: string): Promise<Answer> {
  let response: Response;
  try {
    response = await deps.fetch(target, { headers: { "user-agent": "platformkit-mobile" } });
  } catch (cause: unknown) {
    return { kind: "silence", detail: `${target}: ${why(cause)}` };
  }
  if (!response.ok)
    return {
      kind: later(response.status) ? "silence" : "answered",
      detail: `${target} answered ${String(response.status)}`,
    };
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // A 200 that is not JSON — a captive portal, an error page wearing a green
    // status — says nothing either, and is not the proxy's answer about the path.
    return { kind: "silence", detail: `${target} answered 200 with a body that is not JSON` };
  }
  const version = isRecord(parsed) && typeof parsed.Version === "string" ? parsed.Version : "";
  return version
    ? { kind: "version", version }
    : { kind: "answered", detail: `${target} returned no version` };
}

/**
 * lookupLatest asks the proxy which version an outside `go get` would take, and
 * only stops asking when it has an answer or has run out of attempts. Every
 * attempt that was ignored goes into the detail, because `unreachable` is read as
 * "nothing newer was published" by whoever skims the report, and three sentences
 * naming the host, the path and the transport error are what make it checkable.
 */
export async function lookupLatest(source: Source, deps: Deps = live): Promise<LatestLookup> {
  const target = `https://proxy.golang.org/${proxyPath(source)}/@latest`;
  const ignored: string[] = [];
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (attempt > 1) await deps.wait(PAUSE_MS);
    const answer = await ask(deps, target);
    if (answer.kind === "version") return { state: "latest", version: answer.version };
    if (answer.kind === "answered") return { state: "unreachable", detail: answer.detail };
    ignored.push(`attempt ${String(attempt)}: ${answer.detail}`);
  }
  return { state: "unreachable", detail: ignored.join("; ") };
}

async function main(): Promise<void> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const command = positionals[0] ?? "check";
  const run = { check, refresh, drift }[command];
  if (!run)
    throw new Error(
      `usage: node --import tsx scripts/catalog.ts [check|refresh|drift] (got ${command})`,
    );
  console.log(await run());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
