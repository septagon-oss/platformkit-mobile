// What a Save sends is what this person wrote, and the record's own address never takes a
// language's words. Three answers are owed here: a create has no reading behind it, so every
// field it asks about is sent; an edit of the record's own copy sends a field nobody edited
// exactly as the read returned it, because the sheet shows the whole record; and a translatable
// field nobody edited on a read that arrived in a language is sent nowhere — its words are a
// translation's, and the record's own address files whatever reaches it as the record's own,
// over the source that translation was made from.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { formControls, saveBody, writeLanguage, type Row } from "../src/core/derive";

const bytes = (name: string) =>
  JSON.parse(readFileSync(new URL(`../testdata/${name}`, import.meta.url).pathname, "utf8"));

/**
 * note is the served catalogue document through the parser a screen uses, with its body
 * declared the way a translated rich text body is: the widget that earns the toolbar, and
 * `translatable`, which is the declaration that a field has more than one language's words.
 */
function noteEntry(): Entry {
  const doc = bytes("catalog.json");
  const fields = doc.resources[0].fields as Record<string, unknown>[];
  fields.find((f) => f.name === "body")!.widget = "richtext";
  fields.find((f) => f.name === "body")!.translatable = true;
  return parseCatalog(doc).resources[0]!;
}

/** readBack is one row as it arrived: the words of one language, and the tag that says so. */
function readBack(body: string): Row {
  return { id: "note-84", title: "Seedling care", status: "open", body };
}

test("a create sends every field the sheet asks about", () => {
  const entry = noteEntry();
  const controls = formControls(entry, undefined, true);
  const held = { title: "Seedling care", body: "Dê água fresca." };
  const sent = saveBody(controls, held, undefined, undefined, "pt");
  assert.deepEqual(Object.keys(sent).sort(), ["body", "pinned", "tags", "title"]);
});

test("the record's own copy keeps a field nobody edited", () => {
  const entry = noteEntry();
  const row = readBack("Provide fresh water.");
  const controls = formControls(entry, row, false);
  const sent = saveBody(
    controls,
    { title: "Seedling care, renamed" },
    row,
    writeLanguage(row, controls, { title: "Seedling care, renamed" }, "pt"),
    "pt",
  );
  assert.equal(sent.title, "Seedling care, renamed");
  assert.equal(
    sent.body,
    "Provide fresh water.",
    "a read that named no language showed the record's own words, and they ride along as they always did",
  );
});

test("an edited source field does not carry a translation nobody edited", () => {
  const entry = noteEntry();
  const row = readBack("Mantenha o caminho livre.");
  const controls = formControls(entry, row, false);
  const held = { title: "Garden access, renamed" };
  const writing = writeLanguage(row, controls, held, "pt", "pt");
  assert.equal(
    writing,
    undefined,
    "a field the catalogue cannot translate has no language address",
  );
  const sent = saveBody(controls, held, row, writing, "pt", "pt");
  assert.equal(sent.title, "Garden access, renamed");
  assert.ok(
    !("body" in sent),
    "the Portuguese in the box belongs to the translation, not to the record",
  );
});
