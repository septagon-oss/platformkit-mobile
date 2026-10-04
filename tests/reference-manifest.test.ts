// The reference manifest is the bar in version control. These checks are the
// ones that need no store: every row is a row, the ids continue the record's own
// register, and the verifier refuses the two things a store can get wrong — the
// bytes are not there, or they are not the bytes the manifest promised.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  shapeIssues,
  verify,
  verifyLocal,
  type ReferenceEntry,
  type ReferenceManifest,
} from "../scripts/references";

const row = (over: Partial<ReferenceEntry> = {}): ReferenceEntry => ({
  id: "R25",
  component: "list-row",
  platform: "ios",
  source: "apps/apex/one.png",
  store_sha256: "0".repeat(64),
  store_bytes: 3,
  mobbin_url: "https://mobbin.com/screens/one",
  app: "One",
  screen: "One",
  why: "why",
  ours: "ours",
  ours_case: "data-list/grouped",
  ours_file: "R25-list-row.png",
  sha256: "0".repeat(64),
  bytes: 3,
  ...over,
});

const manifest = (entries: readonly ReferenceEntry[]): ReferenceManifest => ({
  schema: "pkit-mobile-references/2",
  source_root_env: "PKIT999_REFS",
  entries,
});

test("the committed manifest is rows all the way down", async () => {
  const committed = JSON.parse(
    await readFile("design/references/refs.json", "utf8"),
  ) as ReferenceManifest;
  assert.deepEqual(shapeIssues(committed), []);
  // One register, not two: the record's own ids run to R24, so this kit starts at
  // R25 and every row takes the next number. The rule is the count of rows away,
  // so it is written as the run it is rather than as a list someone must edit.
  assert.deepEqual(
    committed.entries.map((e) => e.id),
    committed.entries.map((_, i) => `R${25 + i}`),
  );
  // A pattern named twice would be two bars for one component; coverage names which.
  assert.equal(
    new Set(committed.entries.map((e) => e.component)).size,
    committed.entries.length,
    "a component appears in two rows",
  );
  assert.equal(committed.source_root_env, "PKIT999_REFS");
});

test("a row that cannot be looked up or hashed is refused by name", () => {
  const issues = shapeIssues(
    manifest([
      row({
        id: "r25",
        source: "/abs/one.png",
        store_sha256: "zz",
        store_bytes: 0,
        why: " ",
        platform: "",
      }),
      row({ id: "R25" }),
      row({ id: "R25" }),
      row({ id: "R26", sha256: "zz", ours_file: "../elsewhere.png", ours_case: "grouped" }),
      row({ id: "R27", ours_block: "fields/one", ours_file: "R27-empty-state.png" }),
    ]),
  );
  for (const want of [
    "r25: id is not R<n>",
    "r25: platform is empty",
    "r25: why is empty",
    "r25: store_sha256 is not 64 hex digits",
    "r25: store_bytes is not a positive whole number",
    "R25: id repeated",
    "R26: sha256 is not 64 hex digits",
    "R26: ours_case names a kit specimen as family/state (grouped)",
    "R26: ours_file is one png beside this manifest, not a path (../elsewhere.png)",
    "R27: ours_block is one block name, no path (fields/one)",
  ])
    assert.ok(issues.includes(want), `missing "${want}" in ${JSON.stringify(issues)}`);
  assert.ok(
    issues.some((i) => i.startsWith("r25: source must sit inside the store")),
    JSON.stringify(issues),
  );
});

test("verify reads the store's bytes and refuses a manifest that drifts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "refs-"));
  await mkdir(path.join(root, "apps/apex"), { recursive: true });
  const file = path.join(root, "apps/apex/one.png");
  await writeFile(file, "abc");
  const digest = createHash("sha256").update("abc").digest("hex");
  const good = manifest([row({ store_sha256: digest, store_bytes: 3 })]);
  assert.deepEqual(await verify(good, root), []);

  const drifted = manifest([row({ id: "R26", store_sha256: "f".repeat(64), store_bytes: 3 })]);
  const drift = await verify(drifted, root);
  assert.equal(drift.length, 1);
  assert.match(drift[0]!, /^R26: .*one\.png is [0-9a-f]{64}, not the manifest's f{64}$/);

  const missing = manifest([row({ id: "R27", source: "apps/apex/gone.png" })]);
  assert.deepEqual(await verify(missing, root), [
    `R27: ${path.join(root, "apps/apex/gone.png")} is not in the reference store`,
  ]);

  const wrongSize = manifest([row({ id: "R28", store_sha256: digest, store_bytes: 4 })]);
  assert.match((await verify(wrongSize, root))[0]!, /is 3 bytes, not the manifest's 4/);
});

// The kit's own picture is the half of the record a person who cloned this
// repository can actually check, so it is checked without a reference store.
test("verifyLocal refuses a row whose own picture is missing or is not the bytes promised", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ours-"));
  await writeFile(path.join(directory, "R25-list-row.png"), "abc");
  const digest = createHash("sha256").update("abc").digest("hex");
  const good = manifest([row({ sha256: digest, bytes: 3 })]);
  assert.deepEqual(await verifyLocal(good, directory), []);

  const absent = manifest([
    row({ id: "R26", ours_file: "R26-stat-list.png", sha256: digest, bytes: 3 }),
  ]);
  assert.deepEqual(await verifyLocal(absent, directory), [
    `R26: ${path.join(directory, "R26-stat-list.png")} is not committed beside the manifest`,
  ]);

  const stale = manifest([row({ id: "R27", ours_file: "R27-empty-state.png", bytes: 3 })]);
  await writeFile(path.join(directory, "R27-empty-state.png"), "abcd");
  const drift = await verifyLocal(stale, directory);
  assert.equal(drift.length, 2);
  assert.match(
    drift[0]!,
    /^R27: .*R27-empty-state\.png is [0-9a-f]{64}, not the manifest's 0{64}$/,
  );
  assert.match(drift[1]!, /is 4 bytes, not the manifest's 3/);
});
