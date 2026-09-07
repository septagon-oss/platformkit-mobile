import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CatalogError, parseCatalog } from "../src/core/catalog";

const fixture = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"));

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
  // The doors beyond the five: one about a row, with an argument, and one
  // about the collection, without.
  assert.deepEqual(
    note.commands.map((cmd) => cmd.verb),
    ["publish", "archive"],
  );
  const publish = note.commands[0]!;
  assert.equal(publish.summary, "Publish a note");
  assert.equal(publish.collection, undefined);
  assert.deepEqual(
    publish.fields.map((f) => f.name),
    ["at"],
  );
  assert.equal(note.commands[1]!.collection, true);
  assert.deepEqual(note.commands[1]!.fields, []);
  // A resource with none carries none, and so does a server too old to say.
  assert.deepEqual(c.resources[1]!.commands, []);
});

test("a command a server spells wrongly is refused by the name of what is wrong", () => {
  const doc = fixture();
  doc.resources[0].commands[0].verb = 7;
  assert.throws(
    () => parseCatalog(doc),
    (e: unknown) =>
      e instanceof CatalogError && e.message.includes("resources[0].commands[0].verb"),
  );
  const other = fixture();
  other.resources[0].commands = {};
  assert.throws(
    () => parseCatalog(other),
    (e: unknown) => e instanceof CatalogError && e.message.includes("resources[0].commands"),
  );
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
