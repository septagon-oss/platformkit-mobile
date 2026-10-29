// A look's key is its address, and the module mints it in its own grammar: the recipe id and the
// three colours its slots wear, each colour spelled with the `#` that makes it a colour. That key is
// what the phone puts in a path, so this checks the case the fake's keys do not exercise — a look
// key carrying three `#` characters — against the kit's own one spelling of a row's route: it stays
// one part of one path, arrives back as the same key, and never becomes a fragment.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../src/core/catalog";
import { expectedSourceVersion, sourceRef } from "../src/core/saved";
import { rowAt } from "../src/core/reentry";
import { unresolved } from "./fakes/unresolved";
import { lookRow, rowAddress } from "../src/packs/outfit/address";
import { lookWire } from "../src/packs/outfit/wire";

/** moduleKey is one key in the grammar `outfit` prints: `of1:<recipe>:` and each worn colour with its `#`. */
const moduleKey = "of1:r01-city-layers:#C8643F-#EFE6D8-#5B7DA8";

const composed = (key: string): string => `c1.${Buffer.from(key, "utf8").toString("base64url")}`;

const body = {
  id: "r01-city-layers",
  name: "City layers",
  style: "Minimal",
  seasons: ["Autumn"],
  pieces: [
    {
      part: "top",
      garment: "coat",
      colour: "Terracotta",
      line: "Terracotta wool coat",
      hex: "#C8643F",
    },
  ],
  piecesLine: "Coat · trousers · boots",
  background: "#ECE8E1",
  picture: composed(moduleKey),
  ref: { module: "outfit", kind: "look", key: moduleKey },
  version: "of1-2f4d0aa1f9c74b0a8e5f2b6c1d3a4e5f",
};

const mounted = parseCatalog(unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))));
const entry = { ...mounted.resources[0]!, module: "outfit", entity: "look" };

test("a key the module printed is read whole, with the colours it wears", () => {
  const look = lookWire.parse(body);
  assert.equal(look.ref.key, moduleKey);
  assert.equal(look.version, body.version);
});

test("a key the module printed opens at one row, and its colours stay data", () => {
  const href = rowAddress(entry, lookWire.parse(body));
  assert.equal(href, rowAt("outfit", "look", moduleKey));
  // One path, three parts, no fragment: the `#` a key carries is encoded, not followed.
  const url = new URL(href, "https://server.test");
  assert.equal(url.hash, "");
  assert.equal(url.search, "");
  assert.deepEqual(
    url.pathname.split("/").filter((part) => part !== ""),
    ["outfit", "look", encodeURIComponent(moduleKey)],
  );
  // And the row the screen opens at is the look that was read: the part decodes back to the key.
  assert.equal(decodeURIComponent(url.pathname.split("/").pop()!), moduleKey);
  assert.deepEqual(sourceRef(entry, moduleKey), {
    module: "outfit",
    kind: "look",
    key: moduleKey,
  });
  // The keep quotes the version that arrived with this key, in whatever spelling the module used.
  assert.equal(expectedSourceVersion(lookRow(lookWire.parse(body))), body.version);
});
