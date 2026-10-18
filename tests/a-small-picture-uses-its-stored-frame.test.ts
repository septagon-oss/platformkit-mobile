import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { variantWidth } from "../src/core/prose";
import { fileResource } from "../src/effects/files";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.pictures.json", "utf8")));
const id = "03fcde99-d7e5-456e-ab15-8680a4450b13";

for (const frameWidth of [256, 400]) {
  test(`a ${frameWidth}px picture uses the original when no smaller declared variant exists`, () => {
    assert.deepEqual(catalog.pictures?.widths, [480, 960, 1440, 1920]);
    const width = variantWidth(120, frameWidth, catalog.pictures?.widths);
    const resource = fileResource({
      server: "https://workspace.test",
      userId: "reader",
      entry: undefined,
      pictures: catalog.pictures,
      id,
      version: "stored-frame",
      width,
      attempt: 0,
      key: { id: "reader-key", token: "synthetic-token" },
    });
    assert.equal(resource?.uri, `https://workspace.test/api/v1/file/files/${id}/content`);
  });
}
