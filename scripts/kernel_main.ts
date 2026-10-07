// kernel_main.ts asks the one question no pin can ask: can the build in this
// repository's main read the server in kernel main? The two pinned journeys
// answer a different question — does this build work against the build we named
// — and a pin answers it precisely by freezing one side so the other cannot
// move. Catalogue version 2 is what that blindness cost: the server moved the
// document shape on 2026-10-01, every phone built from main went on reading it
// as though nothing had changed, and no check went red (T-0285).
//
// Three GETs, in this order, and the order is the rule:
//
//   GET {server}/api/v1/repos/{repo}/commits?sha=main&limit=1
//   GET {server}/api/v1/repos/{repo}/raw/ui/screens/testdata/catalog.json?ref=<sha>
//   GET {server}/api/v1/repos/{repo}/raw/apps/platformkit/testdata/openapi.json?ref=<sha>
//
// The tip is learned once and both files are fetched at that immutable SHA,
// never at `ref=main`: a commit landing between two reads must not produce a
// reading of two commits, and this forge has no snapshot API, so an object id is
// the only way to get one. The job token is not decoration — an anonymous call
// to this forge's API answers 403 even for a repository it reports public.
//
// The catalogue half is this repository's own rule and nothing else:
// `parseCatalog` from src/core/catalog.ts is handed the fetched bytes, so a
// shape this build was not written for refuses here exactly as it refuses at
// runtime, and a rule added to the parser is enforced by this check for free.
// The OpenAPI half stops at what makes the bytes a document at all — it parses,
// it is a 3.x document, its `paths` is a non-empty object — because nothing in
// this app reads a field of that document yet; the day it does, the same
// `endpoints(d).raw(file)` feeds the generated client and `tsc` becomes the
// field-level check (T-0287). Refusing a field no phone reads would be the
// phone restating a rule nothing consults.
//
// What it never does: fall back to testdata/catalog.json — that copy is a
// different claim with its own green check inside `npm run check`, and reading
// main or saying it could not is the whole point — print the token, write or
// refresh a fixture, retry a call, or store anything. The job log is the
// artefact; the sha256 and commit it prints re-fetch exactly these bytes.
//
// It is not part of `npm run check`, which runs on every PR with no token and
// sometimes no network: a gate that needs a credential refuses every change for
// a reason that is not the change. The nightly workflow runs it, and a nightly's
// red is the point of it — which is also why nothing here continues on error.
import { pathToFileURL } from "node:url";
import { type Catalog, parseCatalog } from "../src/core/catalog";
import { hash, isRecord } from "./catalog";

export const CATALOG_FILE = "ui/screens/testdata/catalog.json";
export const OPENAPI_FILE = "apps/platformkit/testdata/openapi.json";
/** The ref this job reads. Not a pin, deliberately: a pin cannot move, which is precisely what this has to see. */
export const REF = "main";

/** Everything the read needs, all of it injected — the clock is never implicit. */
export interface Deps {
  /** PK_KERNEL_SERVER: the forge whose API answers for the kernel repository. */
  readonly server: string;
  /** PK_KERNEL_REPOSITORY: which server this build is checked against is the job's to name. */
  readonly repository: string;
  /** GITHUB_TOKEN: the job's own credential, read by no other consumer. */
  readonly token: string;
  readonly fetch: typeof fetch;
  readonly now: () => Date;
}

export interface Endpoints {
  readonly commits: string;
  readonly raw: (file: string, commit: string) => string;
}

/**
 * endpoints is the whole transport surface, exported because the generated
 * client (T-0287) has to fetch the same bytes at the same commit and must not
 * grow a second address rule to do it.
 */
export function endpoints(d: Pick<Deps, "server" | "repository">): Endpoints {
  const api = `${d.server}/api/v1/repos/${d.repository}`;
  return {
    commits: `${api}/commits?sha=${REF}&limit=1`,
    raw: (file, commit) => `${api}/raw/${file}?ref=${commit}`,
  };
}

/** The three bytes of one commit, already in hand. No network reaches `decide`. */
export interface Read {
  readonly kernelCommit: string;
  readonly checkedAt: string;
  readonly catalog: Buffer;
  readonly openapi: Buffer;
}

/**
 * What one nightly read answers. Every field is printed and none is stored, so
 * none is a field nothing reads: the commit and the instant name the run, `read`
 * names every document that arrived, and `refusal` is the first thing that did
 * not answer — null on a green night.
 */
export interface Verdict {
  readonly kernelCommit: string | null;
  readonly checkedAt: string | null;
  readonly read: readonly string[];
  readonly refusal: string | null;
}

type Parse = (document: unknown) => Catalog;

interface Judged {
  readonly line: string;
  readonly refusal: string | null;
}

const refused = (
  kernelCommit: string | null,
  checkedAt: string | null,
  refusal: string,
): Verdict => ({ kernelCommit, checkedAt, read: [], refusal });

/** stamp is the one line shape: what, which bytes, how many, and what they said. */
const stamp = (what: string, file: string, bytes: Buffer, said: string | null): string =>
  `${what} ${file} sha256=${hash(bytes)} bytes=${bytes.length}${said === null ? "" : `, ${said}`}`;

/** json separates "these bytes are not a document" from every rule after it. */
const json = (bytes: Buffer): { readonly value: unknown } | null => {
  try {
    return { value: JSON.parse(bytes.toString("utf8")) as unknown };
  } catch {
    return null;
  }
};

/**
 * judgeCatalog hands the fetched bytes to parseCatalog and prints its sentence
 * verbatim. The script adds exactly one rule of its own — a body that is not
 * JSON at all has no `resources` to name, so it cannot reach the parser — and
 * invents nothing else, which is the reason to believe this check still means
 * anything the next time the parser grows a rule.
 */
export function judgeCatalog(bytes: Buffer, parse: Parse = parseCatalog): Judged {
  const document = json(bytes);
  if (document === null)
    return {
      line: stamp("catalog", CATALOG_FILE, bytes, null),
      refusal: "catalog: document is not JSON",
    };
  try {
    const catalog = parse(document.value);
    return {
      line: stamp(
        "catalog",
        CATALOG_FILE,
        bytes,
        `version ${catalog.version}, ${catalog.resources.length} entries`,
      ),
      refusal: null,
    };
  } catch (refusal: unknown) {
    return {
      line: stamp("catalog", CATALOG_FILE, bytes, null),
      refusal: refusal instanceof Error ? refusal.message : `catalog: ${String(refusal)}`,
    };
  }
}

/**
 * judgeOpenApi refuses only at the fields that make the bytes a document: it
 * parses, it declares a 3.x contract — a Swagger 2 document is a different
 * contract language, and the generator that is coming reads this one — and its
 * `paths` is a non-empty object. It is deliberately not a JSON-Schema validator;
 * field- and type-level truth belongs to `tsc` over generated types.
 */
export function judgeOpenApi(bytes: Buffer): Judged {
  const line = (said: string | null): string => stamp("openapi", OPENAPI_FILE, bytes, said);
  const document = json(bytes);
  if (document === null) return { line: line(null), refusal: "openapi: document is not JSON" };
  if (!isRecord(document.value))
    return { line: line(null), refusal: "openapi: document is not an object" };
  const version = document.value.openapi;
  const major = typeof version === "string" ? Number.parseInt(version, 10) : Number.NaN;
  if (major !== 3)
    return {
      line: line(null),
      refusal: `openapi: openapi is ${JSON.stringify(version)}, not a 3.x document`,
    };
  const paths = document.value.paths;
  if (!isRecord(paths)) return { line: line(null), refusal: "openapi: paths is not an object" };
  const mounted = Object.keys(paths).length;
  if (mounted === 0) return { line: line(null), refusal: "openapi: paths is empty" };
  return { line: line(`${mounted} paths`), refusal: null };
}

/**
 * decide is the whole rule, over bytes, with no network and no clock of its own.
 * Both documents are always evaluated once they are in hand and `refusal`
 * carries the first one in the order catalogue, document — so a red night still
 * prints both hashes, which is what makes "when did it change" answerable after.
 */
export function decide(read: Read, parse: Parse = parseCatalog): Verdict {
  const catalog = judgeCatalog(read.catalog, parse);
  const openapi = judgeOpenApi(read.openapi);
  return {
    kernelCommit: read.kernelCommit,
    checkedAt: read.checkedAt,
    read: [catalog.line, openapi.line],
    refusal: catalog.refusal ?? openapi.refusal,
  };
}

/** configRefusal refuses by name before a request, naming the variable that is empty. */
export function configRefusal(d: Deps): string | null {
  const missing = [
    d.server === ""
      ? "PK_KERNEL_SERVER is empty; the job names the forge this build is read against"
      : null,
    d.repository === ""
      ? "PK_KERNEL_REPOSITORY is empty; the job names the kernel repository whose main this build reads"
      : null,
    d.token === ""
      ? "GITHUB_TOKEN is empty; this forge answers an anonymous API call with 403, so the job's own token is what reads the kernel repository"
      : null,
  ].filter((line): line is string => line !== null);
  return missing.length === 0 ? null : `config: ${missing.join("; ")}`;
}

/** tip is the one commit both files will be read at, or the reason they will not. */
export function tip(
  url: string,
  bytes: Buffer,
): { sha: string; refusal: null } | { sha: null; refusal: string } {
  const document = json(bytes);
  const listed = document === null ? undefined : document.value;
  if (!Array.isArray(listed))
    return {
      sha: null,
      refusal: `fetch: GET ${url} answered 200 with a body that is not a list; a branch tip is exactly one 40-character commit`,
    };
  if (listed.length !== 1)
    return {
      sha: null,
      refusal: `fetch: GET ${url} answered 200 with ${String(listed.length)} commits; a branch tip is exactly one 40-character commit`,
    };
  const sha = isRecord(listed[0]) ? listed[0].sha : undefined;
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha))
    return {
      sha: null,
      refusal: `fetch: GET ${url} answered 200 with ${JSON.stringify(sha)}, which is not a 40-character commit object id; an absent or abbreviated id moves as the branch grows`,
    };
  return { sha, refusal: null };
}

interface Bytes {
  readonly bytes: Buffer;
  readonly refusal?: undefined;
}
interface Stop {
  readonly bytes?: undefined;
  readonly refusal: string;
}

const why = (cause: unknown): string => {
  if (!(cause instanceof Error)) return String(cause);
  const inner = (cause as { cause?: unknown }).cause;
  const detail = inner instanceof Error ? inner.message : inner === undefined ? "" : String(inner);
  return detail === "" ? cause.message : `${cause.message}: ${detail}`;
};

/**
 * get is the only place this file touches the network: one attempt, the job's
 * token, and a sentence that names the URL, the status and what the status means
 * for this job. A cause is printed because undici puts the reason there and a
 * refusal naming neither the forge nor the endpoint cannot be acted on.
 */
async function get(
  d: Deps,
  url: string,
  denied: (status: number) => string,
): Promise<Bytes | Stop> {
  let response: Response;
  try {
    response = await d.fetch(url, { headers: { authorization: `token ${d.token}` } });
  } catch (cause: unknown) {
    return { refusal: `fetch: GET ${url} could not be reached: ${why(cause)}` };
  }
  if (!response.ok)
    return {
      refusal: `fetch: GET ${url} answered ${String(response.status)} — ${denied(response.status)}`,
    };
  return { bytes: Buffer.from(await response.arrayBuffer()) };
}

const refusedToken = (repository: string): string =>
  `the job's token was refused for a cross-repository read of ${repository}; nothing was asked of the two files`;

/**
 * readKernelMain performs exactly three calls and hands the bytes to decide. A
 * fetch refusal stops the run where it happens — with no commit there is nothing
 * to fetch the files at, and a file that is gone from main is itself the answer.
 */
export async function readKernelMain(d: Deps): Promise<Verdict> {
  const where = endpoints(d);
  const head = await get(d, where.commits, (status) =>
    status === 401 || status === 403
      ? refusedToken(d.repository)
      : status === 404
        ? `${REF} is not a branch of ${d.repository}`
        : `the forge did not answer for ${d.repository} ${REF}`,
  );
  if (head.refusal !== undefined) return refused(null, null, head.refusal);
  const learned = tip(where.commits, head.bytes);
  if (learned.refusal !== null) return refused(null, null, learned.refusal);
  const kernelCommit = learned.sha;
  // To the second, UTC with the Z: the instant names which run this was, and the
  // milliseconds of a job start are nobody's question. The clock is injected, so
  // the assertion in tests/kernel-main.test.ts says which instant it asserts.
  const checkedAt = `${d.now().toISOString().slice(0, 19)}Z`;
  const at = (file: string) => (status: number) =>
    status === 401 || status === 403
      ? refusedToken(d.repository)
      : status === 404
        ? `${file} is not in ${d.repository} at ${kernelCommit}`
        : `${file} could not be read at ${kernelCommit}`;
  const catalog = await get(d, where.raw(CATALOG_FILE, kernelCommit), at(CATALOG_FILE));
  if (catalog.refusal !== undefined) return refused(kernelCommit, checkedAt, catalog.refusal);
  const openapi = await get(d, where.raw(OPENAPI_FILE, kernelCommit), at(OPENAPI_FILE));
  if (openapi.refusal !== undefined) return refused(kernelCommit, checkedAt, openapi.refusal);
  return decide({ kernelCommit, checkedAt, catalog: catalog.bytes, openapi: openapi.bytes });
}

/** kernelMain is the whole nightly: refuse by name, then read. */
export async function kernelMain(d: Deps): Promise<Verdict> {
  const missing = configRefusal(d);
  return missing === null ? readKernelMain(d) : refused(null, null, missing);
}

/**
 * report puts the context first and the verdict last, so the last line of a job
 * log is the answer. A refusal goes to stderr with the kernel commit above it on
 * stdout, which is the pair the brief asks a red night to print: the first
 * refused path, and the commit it was refused at.
 */
export function report(
  v: Verdict,
  repository: string,
): { readonly out: readonly string[]; readonly err: readonly string[] } {
  const out = [
    v.kernelCommit === null || v.checkedAt === null
      ? `kernel-main: kernel main was never read by this job`
      : `kernel-main: kernel ${v.kernelCommit} read at ${v.checkedAt} from ${repository} ${REF}`,
    ...v.read.map((line) => `kernel-main: ${line}`),
  ];
  return v.refusal === null
    ? { out: [...out, "kernel-main: this build reads kernel main"], err: [] }
    : { out, err: [`kernel-main: refused ${v.refusal}`] };
}

/** fromEnv reads the three names the job sets; every one is refused by kernelMain. */
export function fromEnv(env: Record<string, string | undefined> = process.env): Deps {
  return {
    server: env.PK_KERNEL_SERVER ?? "",
    repository: env.PK_KERNEL_REPOSITORY ?? "",
    token: env.GITHUB_TOKEN ?? "",
    fetch,
    now: () => new Date(),
  };
}

async function main(): Promise<void> {
  const d = fromEnv();
  const verdict = await kernelMain(d);
  const { out, err } = report(verdict, d.repository);
  for (const line of out) console.log(line);
  for (const line of err) console.error(line);
  if (verdict.refusal !== null) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
