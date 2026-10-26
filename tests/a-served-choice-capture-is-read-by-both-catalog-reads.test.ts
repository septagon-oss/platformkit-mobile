// The phone reads a catalogue two ways: the shell's own read, which decides the presentation hints by
// hand, and the strict generated read of the pinned HTTP document. A server that resolves a finite
// choice answers both, so the capture that carries one is held to both — and to what the shell's read
// must then say: the field's appearance is the one the server named. The goldens in
// catalog-golden-contract.test.ts carry no resolved section at all, so nothing else in this suite would
// notice a pin move to a document whose strict read refuses the resolved answers a real server prints.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { createApi } from "../src/effects/api";

const body = readFileSync("testdata/catalog.choices.json", "utf8");
const api = createApi(
  "https://choices.test",
  (async () =>
    new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch,
);

test("the choice capture is a catalogue both catalog reads accept", async () => {
  const catalog = await api.catalog();
  assert.equal(catalog.resources.length, 4);
  // The bound operation throws on an invalid answer, so this await is the strict read's verdict.
  const result = await api.operations.appResources({});
  assert.equal(result.data?.resources?.length, 4);
  assert.equal(result.data?.catalogVersion, catalog.version);
});

test("the shell's read keeps the four appearances the server named", async () => {
  const notices: string[] = [];
  const catalog = parseCatalog(JSON.parse(body), (at) => notices.push(at));
  const appearances = catalog.resources.map(
    (entry) => entry.fields.find((f) => f.choice !== undefined)?.choice?.appearance,
  );
  assert.deepEqual(appearances, ["tiles", "chips", "swatch", "figure"]);
  assert.deepEqual(notices, []);
});
