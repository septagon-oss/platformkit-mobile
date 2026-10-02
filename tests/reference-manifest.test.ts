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
  type ReferenceEntry,
  type ReferenceManifest,
} from "../scripts/references";

const row = (over: Partial<ReferenceEntry> = {}): ReferenceEntry => ({
  id: "R25",
  component: "list-row",
  platform: "ios",
  source: "apps/apex/one.png",
  sha256: "0".repeat(64),
  bytes: 3,
  mobbin_url: "https://mobbin.com/screens/one",
  app: "One",
  screen: "One",
  why: "why",
  ours: "ours",
  ...over,
});

const manifest = (entries: readonly ReferenceEntry[]): ReferenceManifest => ({
  schema: "pkit-mobile-references/1",
  source_root_env: "PKIT999_REFS",
  entries,
});

test("the committed manifest is rows all the way down", async () => {
  const committed = JSON.parse(
    await readFile("design/references/refs.json", "utf8"),
  ) as ReferenceManifest;
  assert.deepEqual(shapeIssues(committed), []);
  // One register, not two: the record's own ids run to R24, so this kit starts at R25.
  assert.deepEqual(
    committed.entries.map((e) => e.id),
    ["R25", "R26", "R27"],
  );
  assert.equal(committed.source_root_env, "PKIT999_REFS");
});

test("a row that cannot be looked up or hashed is refused by name", () => {
  const issues = shapeIssues(
    manifest([
      row({ id: "r25", source: "/abs/one.png", sha256: "zz", bytes: 0, why: " ", platform: "" }),
      row({ id: "R25" }),
      row({ id: "R25" }),
    ]),
  );
  for (const want of [
    "r25: id is not R<n>",
    "r25: platform is empty",
    "r25: why is empty",
    "r25: sha256 is not 64 hex digits",
    "r25: bytes is not a positive whole number",
    "R25: id repeated",
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
  const good = manifest([row({ sha256: digest, bytes: 3 })]);
  assert.deepEqual(await verify(good, root), []);

  const drifted = manifest([row({ id: "R26", sha256: "f".repeat(64), bytes: 3 })]);
  const drift = await verify(drifted, root);
  assert.equal(drift.length, 1);
  assert.match(drift[0]!, /^R26: .*one\.png is [0-9a-f]{64}, not the manifest's f{64}$/);

  const missing = manifest([row({ id: "R27", source: "apps/apex/gone.png" })]);
  assert.deepEqual(await verify(missing, root), [
    `R27: ${path.join(root, "apps/apex/gone.png")} is not in the reference store`,
  ]);

  const wrongSize = manifest([row({ id: "R28", sha256: digest, bytes: 4 })]);
  assert.match((await verify(wrongSize, root))[0]!, /is 3 bytes, not the manifest's 4/);
});
