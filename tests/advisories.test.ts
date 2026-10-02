import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  auditReport,
  checkAdvisories,
  filings,
  installedVersions,
  RECORD,
  reviews,
} from "../scripts/advisories";

type Entry = Record<string, unknown>;

// What `npm audit --json` answers with (auditReportVersion 2): a filing appears
// as an object on the package it names, and every package that merely depends
// on that one appears as an entry whose `via` holds strings. These fixtures are
// invented examples, chosen so a chain cannot be mistaken for a second finding
// and so one filing under two majors stays one filing.
const filing = (name: string, id: string, severity: string, title = `${name} fails`): Entry => ({
  name,
  severity,
  title,
  url: `https://github.com/advisories/${id}`,
});

// hit is one package carrying one filing: npm repeats the filing as an object
// in that package's `via`, and gives the entry the worst severity it carries.
const hit = (name: string, advisory: Entry): Entry => ({
  name,
  severity: String(advisory.severity),
  via: [advisory],
});

// reached is one package with no filing of its own, only the chains that carry
// another package's: npm writes those as strings, and they add no finding.
const reached = (name: string, ...through: string[]): Entry => ({
  name,
  severity: "high",
  via: through,
});

const audit = (...entries: Entry[]): unknown => ({
  auditReportVersion: 2,
  vulnerabilities: Object.fromEntries(entries.map((entry) => [String(entry.name), entry])),
  metadata: { vulnerabilities: {} },
});

const lock = (...whereAndVersion: [string, string][]): unknown => ({
  lockfileVersion: 3,
  packages: {
    "": { name: "example-mobile", version: "1.0.0" },
    ...Object.fromEntries(
      whereAndVersion.map(([where, version]) => [
        where,
        { version, resolved: `https://registry.npmjs.org/-/${where}` },
      ]),
    ),
  },
});

const review = (over: Entry = {}): Entry => ({
  ghsa: "GHSA-1111-2222-3333",
  package: "tight-queue",
  severity: "high",
  versions: ["2.0.1"],
  reviewedAt: "2026-04-01",
  reviewBy: "2027-01-01",
  reason: "no release fixes it, and the CLI that pulls it in never runs in what this ships",
  ...over,
});

const record = (...entries: Entry[]): unknown => ({ schema: 1, reviews: entries });

const unbounded = filing(
  "tight-queue",
  "GHSA-1111-2222-3333",
  "high",
  "tight-queue: unbounded queue",
);
// The same filing reached from two dependents: a run that counted npm's
// "vulnerabilities" entries would report three findings for this one filing.
const oneHigh = audit(
  hit("tight-queue", unbounded),
  reached("@platformkit/cli", "tight-queue"),
  reached("app-shell", "@platformkit/cli"),
);
const queueAt = (...versions: string[]): unknown =>
  lock(...versions.map((v): [string, string] => [`node_modules/tight-queue`, v]));

test("one filing stays one filing however many chains carry it", () => {
  assert.deepEqual(filings(oneHigh), [
    {
      ghsa: "GHSA-1111-2222-3333",
      name: "tight-queue",
      severity: "high",
      title: "tight-queue: unbounded queue",
    },
  ]);
});

test("a high filing passes on a review that names this lockfile's version", () => {
  assert.equal(
    checkAdvisories({
      audit: oneHigh,
      record: record(review()),
      lock: queueAt("2.0.1"),
      today: "2026-10-02",
    }),
    `${RECORD}: 1 high filing reviewed (tight-queue GHSA-1111-2222-3333 to 2027-01-01), ` +
      "no unreviewed high, no critical; 0 moderate and below, which this gate does not refuse",
  );
});

test("a high filing with no review is refused by its id, its package and its version", () => {
  assert.throws(
    () =>
      checkAdvisories({
        audit: oneHigh,
        record: record(),
        lock: queueAt("2.0.1"),
        today: "2026-10-02",
      }),
    {
      message:
        "GHSA-1111-2222-3333 tight-queue@2.0.1: unreviewed high advisory (tight-queue: unbounded queue); " +
        "take a version that fixes it, or add a dated review to advisories.json",
    },
  );
});

test("a review stops applying the moment the lockfile moves under it", () => {
  assert.throws(
    () =>
      checkAdvisories({
        audit: oneHigh,
        record: record(review()),
        lock: queueAt("2.1.0"),
        today: "2026-10-02",
      }),
    {
      message:
        "advisories.json: GHSA-1111-2222-3333 for tight-queue was reviewed for 2.0.1; " +
        "package-lock.json holds 2.1.0 — read it again and update the record",
    },
  );
});

test("every copy a lockfile holds is a version the review has to have covered", () => {
  const twoCopies = lock(
    ["node_modules/tight-queue", "2.0.1"],
    ["node_modules/@platformkit/cli/node_modules/tight-queue", "1.8.0"],
  );
  assert.deepEqual(installedVersions(twoCopies, "tight-queue"), ["1.8.0", "2.0.1"]);
  assert.throws(
    () =>
      checkAdvisories({
        audit: oneHigh,
        record: record(review()),
        lock: twoCopies,
        today: "2026-10-02",
      }),
    /was reviewed for 2\.0\.1; package-lock\.json holds 1\.8\.0, 2\.0\.1/,
  );
});

test("an expired review is a refusal, not a grace period", () => {
  assert.throws(
    () =>
      checkAdvisories({
        audit: oneHigh,
        record: record(review()),
        lock: queueAt("2.0.1"),
        today: "2027-01-02",
      }),
    /GHSA-1111-2222-3333 for tight-queue expired on 2027-01-01, reviewed 2026-04-01/,
  );
});

test("a review of a filing that is gone is removed, not kept in reserve", () => {
  assert.throws(
    () =>
      checkAdvisories({
        audit: audit(hit("tight-queue", filing("tight-queue", "GHSA-1111-2222-3333", "moderate"))),
        record: record(review()),
        lock: queueAt("2.0.1"),
        today: "2026-10-02",
      }),
    {
      message:
        "advisories.json: GHSA-1111-2222-3333 for tight-queue reviews a filing this audit output " +
        "no longer reports; remove the entry",
    },
  );
});

test("a critical filing is never exempted, reviewed or not", () => {
  assert.throws(
    () =>
      checkAdvisories({
        audit: audit(hit("tight-queue", filing("tight-queue", "GHSA-1111-2222-3333", "critical"))),
        record: record(review()),
        lock: queueAt("2.0.1"),
        today: "2026-10-02",
      }),
    {
      message:
        "GHSA-1111-2222-3333 tight-queue: critical advisory, which is never exempted (tight-queue fails)",
    },
  );
});

test("moderate and below need no review, and the run says what it looked past", () => {
  assert.equal(
    checkAdvisories({
      audit: audit(
        hit("tight-queue", filing("tight-queue", "GHSA-1111-2222-3333", "moderate")),
        hit("loose-ends", filing("loose-ends", "GHSA-4444-5555-6666", "low")),
      ),
      record: record(),
      lock: lock(),
      today: "2026-10-02",
    }),
    `${RECORD}: 0 high filings reviewed, no unreviewed high, no critical; ` +
      "2 moderate and below, which this gate does not refuse",
  );
});

test("the record refuses what the gate would never consult", () => {
  const refuses = (over: Entry, expected: RegExp) =>
    assert.throws(() => reviews(record(review(over))), { message: expected });
  refuses(
    { severity: "critical" },
    /severity must be "high"; a critical advisory is never exempted/,
  );
  refuses({ reason: "   " }, /reason: expected a non-empty string/);
  refuses({ reviewBy: "01-01-2027" }, /reviewBy: expected a YYYY-MM-DD date, found 01-01-2027/);
  refuses({ reviewBy: "2026-03-01" }, /reviewedAt 2026-04-01 falls after reviewBy 2026-03-01/);
  refuses({ versions: [] }, /versions: expected at least one version/);
  refuses({ ghsa: "CVE-1111-2222" }, /CVE-1111-2222 is not a GitHub advisory id/);
  refuses({ decidedBy: "whoever" }, /unknown field decidedBy/);
  assert.throws(() => reviews({ schema: 1, reviews: [], owner: "whoever" }), {
    message: "advisories.json: unknown field owner",
  });
  assert.throws(() => reviews({ schema: 2, reviews: [] }), {
    message: "advisories.json: expected schema 1",
  });
  assert.throws(() => reviews(record(review(), review())), {
    message: "advisories.json reviews[1]: GHSA-1111-2222-3333 for tight-queue is listed twice",
  });
});

test("what npm answers instead of a report is a failure, never an empty tree", () => {
  assert.throws(() => auditReport("not json at all"), { message: "npm audit: output is not JSON" });
  assert.throws(
    () => auditReport(JSON.stringify({ error: { code: "EUSAGE", summary: "no lockfile here" } })),
    { message: "npm audit: EUSAGE: no lockfile here" },
  );
  assert.throws(() => filings({ auditReportVersion: 1, vulnerabilities: {} }), {
    message: /npm audit output: expected auditReportVersion 2, found 1/,
  });
  assert.throws(() => filings({ auditReportVersion: 2 }), {
    message: "npm audit output vulnerabilities: expected an object",
  });
  assert.throws(
    () =>
      filings(
        audit({
          name: "tight-queue",
          severity: "high",
          via: [
            {
              ...filing("tight-queue", "CVE-1111-2222", "high"),
              url: "https://example.com/advisories/CVE-1111-2222",
            },
          ],
        }),
      ),
    { message: /https:\/\/example\.com\/advisories\/CVE-1111-2222 is not a GitHub advisory URL/ },
  );
});

test("the advisory rule is what the workflows run", () => {
  const workflow = (name: string): string =>
    readFileSync(path.join(import.meta.dirname, "..", ".gitea", "workflows", name), "utf8");
  const ci = workflow("ci.yml");
  assert.match(ci, /run: npm run check:advisories/);
  assert.doesNotMatch(ci, /npm audit/, "ci still asks the advisory database directly");
  assert.doesNotMatch(workflow("release.yml"), /npm audit/, "a release skips the advisory gate");
  assert.match(
    workflow("drift.yml"),
    /name: What the advisory database now says\n\s*continue-on-error: true\n\s*run: npm audit --audit-level=high \|\| true/,
  );
});

test("this lockfile's own record is one the gate can read", () => {
  const listed = reviews(
    JSON.parse(readFileSync(path.join(import.meta.dirname, "..", RECORD), "utf8")) as unknown,
  );
  assert.ok(listed.length > 0, `${RECORD} holds at least one reviewed filing`);
  const lockfile = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "..", "package-lock.json"), "utf8"),
  ) as unknown;
  for (const entry of listed)
    assert.deepEqual(
      installedVersions(lockfile, entry.name),
      [...entry.versions],
      `${entry.ghsa} for ${entry.name} must name the versions this lockfile holds`,
    );
});
