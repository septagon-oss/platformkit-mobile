// advisories.ts answers "does this lockfile carry a high advisory nobody has
// looked at?" — the question a required check can answer the same way twice in
// a row. `npm audit` answers a different one: "what does the advisory database
// say about this tree today?" That answer moves when somebody else publishes.
// Three brace-expansion denial-of-service filings were made against a lockfile
// nobody had touched and turned CI red on a commit that changed no dependency,
// the same failure the SDK gate was made offline for (see README). And the
// database has also covered a package in full, with no release to move to, so
// a plain "cannot fix yet" would have left the check red until somebody
// switched it off — which is how a check dies.
//
// So the audit output stays the input and a reviewed record in this repository
// becomes the comparison: a high filing is refused unless advisories.json names
// it, the versions this lockfile actually holds, and a review date that has not
// passed. A critical filing is never exempted. A review whose filing is gone,
// whose versions moved, or that understates what the database now says is
// itself a refusal, so the record is a review log and cannot rot into a
// permanent ignore list. What the database says today, with nothing reviewed,
// is reported weekly in .gitea/workflows/drift.yml.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";

export const RECORD = "advisories.json";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GHSA = /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/;
const ADVISORY_URL = /^https:\/\/github\.com\/advisories\/(GHSA-[0-9a-z-]+)$/;
const SEVERITIES = ["low", "moderate", "high", "critical"];
const REVIEW_FIELDS = [
  "ghsa",
  "package",
  "severity",
  "versions",
  "reviewedAt",
  "reviewBy",
  "reason",
];
type Document = Record<string, unknown>;

/** Filing is one advisory as the audit output attributes it to one package. The packages that merely depend on it do not have it: npm lists those as strings in `via`, and they are the chains, not the findings. */
export interface Filing {
  readonly ghsa: string;
  readonly name: string;
  readonly severity: string;
  readonly title: string;
}

/** Review is one entry of advisories.json: a filing, the versions it was read against, and how long that reading stands for. */
export interface Review {
  readonly ghsa: string;
  readonly name: string;
  readonly versions: readonly string[];
  readonly reviewedAt: string;
  readonly reviewBy: string;
  readonly reason: string;
}

const key = (advisory: { ghsa: string; name: string }): string =>
  `${advisory.ghsa}\u0000${advisory.name}`;

function object(value: unknown, at: string): Document {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${at}: expected an object`);
  return value as Document;
}

function array(value: unknown, at: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${at}: expected an array`);
  return value;
}

function text(value: unknown, at: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${at}: expected a non-empty string`);
  return value.trim();
}

function dateString(value: unknown, at: string): string {
  const found = text(value, at);
  if (!DATE.test(found) || Number.isNaN(Date.parse(found)))
    throw new Error(`${at}: expected a YYYY-MM-DD date, found ${found}`);
  return found;
}

function ghsaId(value: unknown, at: string): string {
  const found = text(value, at);
  if (!GHSA.test(found))
    throw new Error(`${at}: ${found} is not a GitHub advisory id (GHSA-xxxx-xxxx-xxxx)`);
  return found;
}

/** filings returns every filing the audit output names, at any severity, once per filing and package. */
export function filings(audit: unknown): Filing[] {
  const report = object(audit, "npm audit output");
  if (report.auditReportVersion !== 2)
    throw new Error(
      `npm audit output: expected auditReportVersion 2, found ${String(report.auditReportVersion)}`,
    );
  const named = (entry: string, rest: string): string => `npm audit output ${entry} ${rest}`;
  const found = new Map<string, Filing>();
  for (const [entry, value] of Object.entries(
    object(report.vulnerabilities, "npm audit output vulnerabilities"),
  )) {
    for (const via of array(object(value, named(entry, "via")).via, named(entry, "via"))) {
      if (typeof via === "string") continue;
      const filing = object(via, named(entry, "via"));
      const name = text(filing.name, named(entry, "via name"));
      const severity = text(filing.severity, named(entry, `${name} severity`));
      if (!SEVERITIES.includes(severity))
        throw new Error(`${named(entry, `${name} severity`)}: unknown severity ${severity}`);
      const url = text(filing.url, named(entry, `${name} url`));
      const ghsa = ADVISORY_URL.exec(url)?.[1];
      if (!ghsa)
        throw new Error(`${named(entry, `${name} url`)}: ${url} is not a GitHub advisory URL`);
      found.set(key({ ghsa, name }), {
        ghsa: ghsaId(ghsa, named(entry, `${name} url`)),
        name,
        severity,
        title: text(filing.title, named(entry, `${name} title`)),
      });
    }
  }
  return [...found.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.ghsa.localeCompare(b.ghsa),
  );
}

/** installedVersions lists the exact versions this lockfile holds for one package, wherever they sit in the tree. */
export function installedVersions(lock: unknown, name: string): string[] {
  const packages = object(object(lock, "package-lock.json").packages, "package-lock.json packages");
  const at = `node_modules/${name}`;
  const versions = Object.entries(packages)
    .filter(([where]) => where === at || where.endsWith(`/${at}`))
    .map(([where, value]) => text(object(value, where).version, `${where} version`));
  return [...new Set(versions)].sort();
}

/** reviews reads the record, refusing a field the gate never consults, a date it cannot compare, and any severity that would let a review exempt a critical filing. */
export function reviews(record: unknown): Review[] {
  const document = object(record, RECORD);
  for (const field of Object.keys(document))
    if (field !== "schema" && field !== "reviews")
      throw new Error(`${RECORD}: unknown field ${field}`);
  if (document.schema !== 1) throw new Error(`${RECORD}: expected schema 1`);
  const seen = new Set<string>();
  return array(document.reviews, `${RECORD} reviews`).map((value, index) => {
    const at = `${RECORD} reviews[${String(index)}]`;
    const entry = object(value, at);
    for (const field of Object.keys(entry))
      if (!REVIEW_FIELDS.includes(field)) throw new Error(`${at}: unknown field ${field}`);
    if (entry.severity !== "high")
      throw new Error(`${at}: severity must be "high"; a critical advisory is never exempted`);
    const listed = array(entry.versions, `${at} versions`).map((v) => text(v, `${at} versions`));
    if (listed.length === 0) throw new Error(`${at} versions: expected at least one version`);
    const review: Review = {
      ghsa: ghsaId(entry.ghsa, `${at} ghsa`),
      name: text(entry.package, `${at} package`),
      versions: [...new Set(listed)].sort(),
      reviewedAt: dateString(entry.reviewedAt, `${at} reviewedAt`),
      reviewBy: dateString(entry.reviewBy, `${at} reviewBy`),
      reason: text(entry.reason, `${at} reason`),
    };
    if (review.reviewedAt > review.reviewBy)
      throw new Error(
        `${at}: reviewedAt ${review.reviewedAt} falls after reviewBy ${review.reviewBy}`,
      );
    if (seen.has(key(review)))
      throw new Error(`${at}: ${review.ghsa} for ${review.name} is listed twice`);
    seen.add(key(review));
    return review;
  });
}

/**
 * checkAdvisories is the gate: every high filing needs a review that still
 * applies to this lockfile and has not expired, a critical filing needs a fixed
 * version, and every review needs a filing that is still reported. It returns
 * the one line a passing run prints.
 */
export function checkAdvisories(input: {
  audit: unknown;
  record: unknown;
  lock: unknown;
  today: string;
}): string {
  const today = dateString(input.today, "today");
  const all = filings(input.audit);
  const listed = reviews(input.record);
  const blocking = all.filter((filing) => filing.severity === "high");
  const critical = all.filter((filing) => filing.severity === "critical");
  if (critical.length > 0)
    throw new Error(
      critical
        .map((a) => `${a.ghsa} ${a.name}: critical advisory, which is never exempted (${a.title})`)
        .join("; "),
    );

  const byKey = new Map(listed.map((review) => [key(review), review]));
  const reviewed: string[] = [];
  for (const filing of blocking) {
    const installed = installedVersions(input.lock, filing.name);
    if (installed.length === 0)
      throw new Error(
        `${filing.ghsa} ${filing.name}: the audit names this package, package-lock.json holds no version of it`,
      );
    const review = byKey.get(key(filing));
    if (!review)
      throw new Error(
        `${filing.ghsa} ${filing.name}@${installed.join(", ")}: unreviewed high advisory (${filing.title}); take a version that fixes it, or add a dated review to ${RECORD}`,
      );
    if (!isDeepStrictEqual([...review.versions], installed))
      throw new Error(
        `${RECORD}: ${review.ghsa} for ${review.name} was reviewed for ${review.versions.join(", ")}; package-lock.json holds ${installed.join(", ")} — read it again and update the record`,
      );
    if (review.reviewBy < today)
      throw new Error(
        `${RECORD}: ${review.ghsa} for ${review.name} expired on ${review.reviewBy}, reviewed ${review.reviewedAt}; re-review it or take the fix`,
      );
    reviewed.push(`${review.name} ${review.ghsa} to ${review.reviewBy}`);
  }
  const current = new Set(blocking.map(key));
  for (const review of listed)
    if (!current.has(key(review)))
      throw new Error(
        `${RECORD}: ${review.ghsa} for ${review.name} reviews a filing this audit output no longer reports; remove the entry`,
      );

  const high = blocking.length;
  const below = all.length - high - critical.length;
  return (
    `${RECORD}: ${String(high)} high filing${high === 1 ? "" : "s"} reviewed` +
    (reviewed.length > 0 ? ` (${reviewed.join("; ")})` : "") +
    ", no unreviewed high, no critical" +
    `; ${String(below)} moderate and below, which this gate does not refuse`
  );
}

/** auditReport is what `npm audit --json` printed, read as a report. An npm error object or anything unparseable is the check's own failure: neither is ever taken for "no advisories". */
export function auditReport(out: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(out);
  } catch {
    throw new Error("npm audit: output is not JSON");
  }
  const error = (parsed as { error?: Document }).error;
  if (error)
    throw new Error(
      `npm audit: ${text(error.code, "npm audit error code")}${
        typeof error.summary === "string" ? `: ${error.summary}` : ""
      }`,
    );
  return parsed;
}

/** auditJson runs the audit of what this checkout installs and returns its report. Exit 1 means "there are findings", which is the input; any other failure is the gate's own. */
export function auditJson(root: string): unknown {
  let out: string;
  try {
    out = execFileSync("npm", ["audit", "--json"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failed = error as { status?: unknown; code?: unknown; stdout?: unknown };
    const status = failed.status ?? failed.code;
    const stdout = failed.stdout;
    if (status !== 1 || typeof stdout !== "string" || stdout.trim() === "")
      throw new Error(`npm audit: exited ${String(status)}`);
    out = stdout;
  }
  return auditReport(out);
}

/** check is the gate over a checkout: the audit of what is installed, the record and lockfile as they are here, today in UTC. */
export function check(root: string, today: string): string {
  const read = (name: string): unknown => JSON.parse(readFileSync(path.join(root, name), "utf8"));
  return checkAdvisories({
    audit: auditJson(root),
    record: read(RECORD),
    lock: read("package-lock.json"),
    today,
  });
}

if (process.argv[1]?.endsWith("advisories.ts")) {
  try {
    const { values } = parseArgs({ options: { check: { type: "boolean", default: false } } });
    if (!values.check) throw new Error("Usage: npm run check:advisories");
    console.log(check(process.cwd(), new Date().toISOString().slice(0, 10)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
