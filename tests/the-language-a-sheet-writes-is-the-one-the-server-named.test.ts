// A record's words arrive in some language, and the server says which — in `_i18n`, naming the
// translatable fields it served and the language each one's words are in, and on the answer itself,
// with the tag the whole response was written in. What a sheet may write, and where, follows from
// those two alone — never from what the text looks like. Six answers are owed here: a changed field
// the server named in the language the sheet reads in is written *in that language* (a PATCH that
// names no language writes the record, so Portuguese words sent bare would be filed as the English
// they were translated from); a changed field named in a language the sheet does not read is the
// record's own copy and is written bare, as it always was; a field the server said nothing about is
// the record's own copy too; a translation changed beside a field that language cannot carry is two
// writes at two addresses, which is a refusal rather than half of one; and on a read the server
// answered *in a language*, every translatable field the person changed belongs to it — whether it
// carried no note because it is that language's own text, or carried another language's note because
// that other language is the fallback the translator was shown in order to write this one.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCatalog, type Entry } from "../src/core/catalog";
import { formControls, writeLanguage, type Row } from "../src/core/derive";
import { unresolved } from "./fakes/unresolved";

const bytes = (name: string) =>
  unresolved(
    JSON.parse(readFileSync(new URL(`../testdata/${name}`, import.meta.url).pathname, "utf8")),
  );

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

test("a complete translation the answer named no note for is written in the language the answer was served in", () => {
  const entry = noteEntry();
  // A field that is the reading language's own reviewed text is the one field the server leaves
  // out of `_i18n`: there is nothing to say about it. The answer's own tag is all the sheet has,
  // and the only reading of it that keeps the source is that these words *are* that language's.
  const row = readBack("Dê água fresca.", undefined);
  const held = { body: "Dê água fresca. Sempre." };
  const asked = writeLanguage(row, formControls(entry, row, false), held, "pt", "pt");
  assert.ok(asked, "a body read in Portuguese and edited in Portuguese is Portuguese");
  assert.equal(asked.locale, "pt");
  assert.deepEqual([...asked.translated], ["body"]);
  assert.deepEqual([...asked.other], []);
});

test("a translation written over the source a missing row fell back to is written in the language that was asked for", () => {
  const entry = noteEntry();
  // `_i18n` here names another language precisely because this one has no row yet: the English in
  // the box is the thing a reader of Portuguese was shown in order to write it. Sending what they
  // typed back over that note would file the translation as the source it translates.
  const row = readBack("Provide fresh water.", { body: { locale: "en", status: "missing" } });
  const held = { body: "Dê água fresca." };
  const asked = writeLanguage(row, formControls(entry, row, false), held, "pt", "pt");
  assert.ok(asked, "the fallback is the words shown, not the words written");
  assert.equal(asked.locale, "pt");
  assert.deepEqual([...asked.translated], ["body"]);
});
