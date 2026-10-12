// A picture's bytes leave the phone as one multipart form, and the form its caller built is the
// document the transport sends. The generated serializer builds a form out of an object's entries
// and knows nothing of a form that already exists: run over one it prints that form's own internals
// into a text field, and the file module is left a field named after them and no file to store —
// which is a refusal it cannot trace back to the write that caused it. Two answers are owed here:
// the form that arrives at the server is the one that was handed over, part and all, at the address
// the document gives an upload; and an address the document holds no multipart route at is refused
// by name before a byte of anyone's picture is sent.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";

const files = {
  module: "file",
  entity: "files",
  path: "/api/v1/file/files",
  fields: [],
  immutable: [],
  writable: true,
  commands: [],
  singleton: false,
};

const note = { ...files, module: "note", entity: "note", path: "/api/v1/note/notes" };

/**
 * collecting is one connection that answers an upload with the row the file module makes, and
 * keeps what actually left the phone so a test can read the request rather than trust its caller.
 */
function collecting() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        id: "55555555-5555-4555-8555-555555555555",
        name: "herbs.jpg",
        contentType: "image/jpeg",
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  return { api: createApi("https://tenant-one.example.test", fetchImpl, "pk=tenant-one"), calls };
}

/** aPicture is one file described the way a phone describes the bytes it just wrote. */
function aPicture(): FormData {
  const form = new FormData();
  form.append("file", new Blob(["herbs"], { type: "image/jpeg" }), "herbs.jpg");
  return form;
}

test("the form an upload was handed is the form the file module is asked to store", async () => {
  const { api, calls } = collecting();
  const form = aPicture();
  const stored = await api.upload(files, form, "?image=true");

  assert.equal(calls[0]!.url, "https://tenant-one.example.test/api/v1/file/files?image=true");
  assert.equal(calls[0]!.init.method, "POST");
  const sent = calls[0]!.init.body as FormData;
  assert.equal(sent, form, "the form is sent as it was built, not rebuilt from its own internals");
  const parts = [...sent.entries()];
  assert.equal(parts.length, 1, "the file module reads the one part that names a file");
  const [name, part] = parts[0]!;
  assert.equal(name, "file");
  assert.ok(part instanceof Blob);
  assert.equal((part as File).name, "herbs.jpg");
  // The boundary between parts belongs to whatever writes the form out, so a caller that named one
  // here would name a boundary the transport has not chosen.
  assert.equal(new Headers(calls[0]!.init.headers).get("Content-Type"), null);
  assert.equal(new Headers(calls[0]!.init.headers).get("Cookie"), "pk=tenant-one");
  assert.equal(stored.id, "55555555-5555-4555-8555-555555555555");
});

test("an address the document holds no upload route at is refused before a byte is sent", async () => {
  const { api, calls } = collecting();
  await assert.rejects(
    () => api.upload(note, aPicture()),
    (error: unknown) =>
      error instanceof TypeError &&
      /No documented multipart upload at \/api\/v1\/note\/notes\./.test(error.message),
  );
  assert.deepEqual(calls, [], "a write this server has no door for sends nothing");
});
