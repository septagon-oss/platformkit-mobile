// A record's words arrive in some language, and the server says which: `_i18n` names the
// translatable fields it served and the language each one's words are in. What a sheet may
// write, and where, follows from that note alone — never from what the text looks like. Four
// answers are owed here: a changed field the server named in the language the sheet reads in
// is written *in that language* (a PATCH that names no language writes the record, so
// Portuguese words sent bare would be filed as the English they were translated from); a
// changed field named in a language the sheet does not read is the record's own copy and is
// written bare, as it always was; a field the server said nothing about is the record's own
// copy too; and a translation changed beside a field that language cannot carry is two writes
// at two addresses, which is a refusal rather than half of one.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { formControls, writeLanguage, type Row } from "../src/core/derive";

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

/** readBack is one row as it arrived: the body's words, and the language the server named. */
function readBack(body: string, said: Record<string, unknown> | undefined): Row {
  return {
    id: "note-46",
    title: "Daily care",
    status: "open",
    body,
    ...(said === undefined ? {} : { _i18n: said }),
  };
}

test("a body served in the language the sheet reads in is written in that language", () => {
  const entry = noteEntry();
  const row = readBack("Dê água fresca.", { body: { locale: "pt", status: "complete" } });
  const controls = formControls(entry, row, false);
  const held = { body: "Dê água fresca. Sempre." };
  const asked = writeLanguage(row, controls, held, "pt");
  assert.ok(asked, "a translated body must not be written as the record's own");
  assert.equal(asked.locale, "pt");
  assert.deepEqual([...asked.translated], ["body"]);
  assert.deepEqual([...asked.other], []);
});

test("a body served in a language nobody reads here is the record's own, and is written bare", () => {
  const entry = noteEntry();
  const row = readBack("Provide fresh water.", { body: { locale: "en", status: "complete" } });
  const held = { body: "Provide fresh water. Sempre." };
  assert.equal(
    writeLanguage(row, formControls(entry, row, false), held, "pt"),
    undefined,
    "the source is written without a language, exactly as it was before translations existed",
  );
});

test("a body the server said nothing about is written without a language", () => {
  const entry = noteEntry();
  const row = readBack("Provide fresh water.", undefined);
  const held = { body: "Provide fresh water. Sempre." };
  assert.equal(writeLanguage(row, formControls(entry, row, false), held, "pt"), undefined);
});

test("a translation changed beside a field that language cannot carry names what it cannot write", () => {
  const entry = noteEntry();
  const row = readBack("Dê água fresca.", { body: { locale: "pt", status: "complete" } });
  const controls = formControls(entry, row, false);
  const asked = writeLanguage(
    row,
    controls,
    { body: "Dê água fresca. Sempre.", title: "Daily care, renamed" },
    "pt",
  );
  assert.ok(asked);
  assert.equal(asked.locale, "pt");
  assert.deepEqual([...asked.translated], ["body"]);
  assert.deepEqual(
    [...asked.other],
    ["title"],
    "the record itself is written without the parameter, so the sheet may not send both at once",
  );
});
