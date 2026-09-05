import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CatalogError, parseCatalog } from "../src/core/catalog";

const fixture = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url), "utf8"));

test("the golden catalog parses", () => {
  const c = parseCatalog(fixture());
  assert.equal(c.resources.length, 2);
  const note = c.resources[0]!;
  assert.equal(note.module, "note");
  assert.equal(note.entity, "note");
  assert.equal(note.path, "/api/v1/note/notes");
  assert.equal(note.writable, true);
  assert.deepEqual(note.immutable, ["status"]);
  assert.equal(note.fields[0]!.name, "id");
  assert.equal(note.fields[0]!.readOnly, true);
  const status = note.fields.find((f) => f.name === "status")!;
  assert.deepEqual(status.enum, ["open", "done"]);
  assert.equal(status.default, "open");
  assert.equal(c.resources[1]!.writable, false);
});

test("a malformed document is refused by name", () => {
  assert.throws(
    () => parseCatalog({ resources: [{ module: "x" }] }),
    (e: unknown) => e instanceof CatalogError && /resources\[0\]\.entity/.test(e.message),
  );
  assert.throws(
    () =>
      parseCatalog({
        resources: [
          {
            module: "x",
            entity: "y",
            path: "/p",
            fields: [{ name: "a", type: "money" }],
            writable: true,
          },
        ],
      }),
    (e: unknown) => e instanceof CatalogError && /type/.test(e.message),
  );
  assert.throws(() => parseCatalog(null), CatalogError);
});
