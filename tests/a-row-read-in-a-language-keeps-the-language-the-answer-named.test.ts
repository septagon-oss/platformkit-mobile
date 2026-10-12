// A record with a translatable field is read through a door that names a language, and the tag the
// answer prints is the language the words on the screen are written in. The read keeps that tag
// beside the row rather than inside it: the row stays the server's own document, and a sheet that
// later sends words back has to name the language they are written in, because a write naming no
// language writes the record rather than the language it was read in. Three answers are owed here:
// the tag is kept exactly as it was printed, an answer that named no language leaves the row the
// record's own copy — which is what a row with no language has always been — and a tag no request
// this phone could build would carry counts as nothing said rather than as a guess.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";

const note = {
  module: "note",
  entity: "note",
  path: "/api/v1/note/notes",
  fields: [],
  immutable: [],
  writable: true,
  commands: [],
  singleton: false,
};

/** answering is one connection that answers every read with the same row, headers and all. */
function answering(headers: Record<string, string>) {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ id: "note-73", title: "Herb care", body: "Regue as ervas" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    })) as unknown as typeof fetch;
  return createApi("https://tenant-one.example.test", fetchImpl, "pk=tenant-one");
}

test("a row read from an answer that names its language keeps the tag that answer printed", async () => {
  const read = await answering({ "Content-Language": "pt-BR" }).served(note, "note-73");
  assert.equal(read.language, "pt-BR", "the server's own spelling travels, not the phone's");
  assert.equal(read.row.id, "note-73");
  assert.equal(read.row.body, "Regue as ervas");
});

test("the language an answer was served in is the first tag it printed", async () => {
  const read = await answering({ "Content-Language": "pt, en" }).served(note, "note-73");
  assert.equal(read.language, "pt");
});

test("an answer that names no language leaves the row the record's own copy", async () => {
  assert.equal((await answering({}).served(note, "note-73")).language, "");
});

test("a language an answer named in a form no request could carry back is no language", async () => {
  // An underscore is not a character a language tag is spelled with. Reading it as a language
  // would put the phone's guess about a server's tag into the address of its next write.
  assert.equal(
    (await answering({ "Content-Language": "pt_BR" }).served(note, "note-73")).language,
    "",
  );
});

test("the row a sheet reads is the same row whether or not it asks which language it came in", async () => {
  const api = answering({ "Content-Language": "pt" });
  const asRow = await api.get(note, "note-73");
  const asServed = await api.served(note, "note-73");
  assert.deepEqual(asServed.row, asRow, "there is one read of a row, with or without its language");
});
