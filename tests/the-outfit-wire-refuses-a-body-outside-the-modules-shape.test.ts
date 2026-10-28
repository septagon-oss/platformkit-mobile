// The outfit wire is the module's shape and nothing looser: a body outside it is refused there, so a
// screen never draws a look with a member missing. Each case refuses one thing at a time, with an
// example the kit's own fake does not use, and the last two name what a look is addressed by — the
// key the module kept it under, which is the same identity a person's copy is kept against.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { key as entryKey, parseCatalog } from "../src/core/catalog";
import { expectedSourceVersion, sourceRef } from "../src/core/saved";
import { unresolved } from "./fakes/unresolved";
import { lookRow, rowAddress } from "../src/packs/outfit/address";
import { lookWire, suggestionWire } from "../src/packs/outfit/wire";

const composed = (key: string): string => `c1.${Buffer.from(key, "utf8").toString("base64url")}`;

const key = "of1:FIELD-NOTES:C8643F-EFE6D8-5B7DA8";

const look = {
  id: "FIELD-NOTES",
  name: "Field notes",
  style: "Utility",
  seasons: ["Spring"],
  pieces: [
    {
      part: "top",
      garment: "shirt",
      colour: "Ivory",
      line: "Ivory poplin shirt",
      hex: "#EFE6D8",
    },
    {
      part: "bottom",
      garment: "trousers",
      colour: "Denim",
      line: "Denim trousers",
      hex: "#5B7DA8",
    },
  ],
  piecesLine: "Shirt · trousers",
  background: "#F2EFE9",
  picture: composed(key),
  ref: { module: "outfit", kind: "look", key },
  version: "4",
};

const window = {
  looks: [look],
  colours: [{ id: "ivory", name: "Ivory", hex: "#EFE6D8" }],
  season: "Spring",
  style: "Utility",
  skip: 0,
  ended: true,
};

/** refused says whether the wire took the body, and names the member it refused when it did not. */
const refused = (
  wire: { safeParse(value: unknown): { success: boolean } },
  body: unknown,
): string => (wire.safeParse(body).success ? "" : "refused");

test("the module's own look body is read as it arrived", () => {
  assert.deepEqual(lookWire.parse(look), { ...look, seasons: ["Spring"] });
});

test("one member at a time is refused, and only it", () => {
  const cases: readonly (readonly [string, unknown])[] = [
    [
      "the picture as a stored file's id",
      { ...look, picture: "6f1f2a3b-4c5d-6e7f-8a9b-0c1d2e3f4a5b" },
    ],
    ["the picture as a truncated composition", { ...look, picture: "c1.eB" }],
    ["the picture as a padded token", { ...look, picture: "c1.AA==" }],
    ["a colour spelled in lower case", { ...look, background: "#ece8e1" }],
    ["a piece with no colour", { ...look, pieces: [{ ...look.pieces[0]!, hex: "" }] }],
    ["a look with no pieces", { ...look, pieces: [] }],
    ["a look with no address", { ...look, ref: { ...look.ref, key: "" } }],
    ["a look that quotes no version", { ...look, version: "" }],
    ["a window with no position", { ...window, skip: -1 }],
    ["a window that does not say whether it ended", { ...window, ended: undefined }],
    ["a window holding a look it cannot name", { ...window, looks: [{ ...look, name: "" }] }],
  ];
  for (const [says, body] of cases) {
    const wire = "looks" in (body as object) ? suggestionWire : lookWire;
    assert.equal(refused(wire, body), "refused", `the wire accepted ${says}`);
  }
});

test("a window that ended is read as one window that ended", () => {
  const read = suggestionWire.parse(window);
  assert.equal(read.ended, true);
  assert.equal(read.skip, 0);
  assert.deepEqual(read.looks[0]?.ref.key, key);
});

test("a look is opened and kept under the key the read gave it, never its recipe", () => {
  const mounted = parseCatalog(
    unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))),
  );
  const entry = { ...mounted.resources[0]!, module: "outfit", entity: "look" };
  const read = lookWire.parse(look);
  assert.equal(rowAddress(entry, read), "/outfit/look/of1%3AFIELD-NOTES%3AC8643F-EFE6D8-5B7DA8");
  assert.equal(entryKey(entry), "outfit/look");
  assert.deepEqual(sourceRef(entry, read.ref.key), {
    module: "outfit",
    kind: "look",
    key,
  });
  assert.equal(expectedSourceVersion(lookRow(read)), "4");
});
