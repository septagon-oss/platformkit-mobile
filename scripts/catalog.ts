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
//   drift    (scheduled, reports) fetch the recorded commit and compare; then ask
//            the public module proxy which version an outside `go get` would take
//            and whether its catalog differs. The second question cannot be
//            answered offline, so it reports rather than blocks — see the head of
//            .gitea/workflows/drift.yml.
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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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
        `tsx scripts/catalog.ts refresh and review the diff.`,
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
 * report answers both questions from bytes rather than the network, so each branch
 * is testable instead of awaited: has our copy moved away from the commit it names,
 * and has a newer published version changed the contract underneath it?
 */
export function report(
  source: Source,
  local: Buffer,
  pinned: Buffer,
  latest?: { readonly version: string; readonly bytes: Buffer } | null,
): readonly string[] {
  const lines = [
    hash(local) === hash(pinned)
      ? `ok  ${FIXTURE} still matches ${source.upstream.tag}`
      : `DRIFT ${FIXTURE} differs from ${source.upstream.tag}; run tsx scripts/catalog.ts refresh`,
  ];
  if (!latest || latest.version === source.upstream.tag) {
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
  const [local, pinned, version] = await Promise.all([
    readFile(FIXTURE),
    fetchAt(source, source.upstream.commit),
    latestVersion(source),
  ]);
  const latest =
    version && version !== source.upstream.tag
      ? { version, bytes: await fetchAt(source, version) }
      : null;
  return report(source, local, pinned, latest).join("\n");
}

/** latestVersion asks the public proxy which version an outside `go get` takes. */
async function latestVersion(source: Source): Promise<string> {
  const module = new URL(source.upstream.repository).pathname.replace(/^\/|\/$/g, "");
  const response = await fetch(`https://proxy.golang.org/${module}/@latest`, {
    headers: { "user-agent": "platformkit-mobile" },
  });
  if (!response.ok) return "";
  const parsed = JSON.parse(await response.text()) as unknown;
  return isRecord(parsed) && typeof parsed.Version === "string" ? parsed.Version : "";
}

async function main(): Promise<void> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const command = positionals[0] ?? "check";
  const run = { check, refresh, drift }[command];
  if (!run) throw new Error(`usage: tsx scripts/catalog.ts [check|refresh|drift] (got ${command})`);
  console.log(await run());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
