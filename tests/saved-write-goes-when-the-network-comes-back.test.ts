// Rules this file holds about one person's saved copy.
// A keep is a write like any other: made without a network it joins this phone's queue and goes
// when the network returns, carrying the same document and the same idempotency key it was asked
// to send the first time. A refusal is the server's answer to that write and is never queued, and
// a removal is never queued at all, because the queue cannot tell a 204 from a write whose fate is
// unknowable. `probe` answers kept, absent or nobody-has-said, and a read that failed is never
// read as "this person keeps nothing".
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog, type Catalog, type Entry } from "../src/core/catalog";
import { savable } from "../src/core/saved";
import { commandPath } from "../src/core/derive";
import { createApi } from "../src/effects/api";
import { createOutbox } from "../src/effects/outbox";
import { createSaved } from "../src/effects/saved";
import { fakeOutboxStore, mint } from "./fakes/store";

const ada = { server: "https://acme.test", userId: "ada" };

/**
 * library is a catalogue with a savable source and the entry that holds this person's copies of
 * it, in the shape the kernel prints: `save` about the collection carrying a source, `unsave`
 * about one record quoting a revision, and the saved entry's own field spelling availability.
 */
function library(): Catalog {
  return parseCatalog({
    catalogVersion: 3,
    resources: [
      {
        module: "look",
        entity: "product",
        path: "/api/v1/look/products",
        writable: false,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string" },
          { name: "version", type: "string", readOnly: true },
        ],
        commands: [],
        presentation: {
          filters: [],
          saved: {
            save: "Save",
            saved: "Saved",
            remove: "Remove",
            listTitle: "Saved",
            listEntry: "look/copy",
          },
        },
      },
      {
        module: "look",
        entity: "copy",
        path: "/api/v1/look/copies",
        writable: true,
        fields: [
          { name: "id", type: "uuid", readOnly: true },
          { name: "title", type: "string", readOnly: true },
          { name: "sourceAvailability", type: "string", readOnly: true },
          { name: "revision", type: "int", readOnly: true },
        ],
        commands: [
          {
            verb: "save",
            summary: "Keep a copy",
            collection: true,
            fields: [{ name: "source", type: "string", required: true }],
          },
          {
            verb: "unsave",
            summary: "Take the copy away",
            fields: [
              { name: "id", type: "uuid", required: true },
              { name: "expectedRevision", type: "int", required: true },
            ],
          },
        ],
        presentation: { filters: [], availabilityField: "sourceAvailability" },
      },
    ],
  });
}

function pair(catalog: Catalog): {
  source: Entry;
  savable: NonNullable<ReturnType<typeof savable>>;
} {
  const source = catalog.resources.find((r) => r.entity === "product")!;
  const found = savable(source, catalog.resources);
  assert.ok(found, "a source entry that declares its words and its list is savable");
  return { source, savable: found };
}

interface Wire {
  readonly method: string;
  readonly path: string;
  readonly key: string | null;
  readonly body: unknown;
}

/**
 * phone is one saved port over one real queue and one real transport: `online` flips between calls,
 * `answer` says what the server says to a path, and `sent` records every request that left.
 */
function phone(options: {
  online: { value: boolean };
  answer: (call: Wire) => Response;
  find: () => Promise<unknown>;
}) {
  const sent: Wire[] = [];
  const notices: string[] = [];
  const store = fakeOutboxStore();
  const api = createApi("https://acme.test", (async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    // A device with no network is a transport that will not take the request at
    // all, which is the only shape of "offline" the kit is allowed to read.
    if (!options.online.value) throw new TypeError("Network request failed");
    const call: Wire = {
      method: String(init?.method),
      path: new URL(String(_input)).pathname,
      key: new Headers(init?.headers).get("Idempotency-Key"),
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    };
    sent.push(call);
    return options.answer(call);
  }) as typeof fetch);
  const outbox = createOutbox({
    store: store.store,
    api,
    clock: { now: () => "2026-10-08T10:00:00.000Z" },
    mint: mint(),
    scope: () => ada,
    reached: () => options.online.value,
    notice: (resourceKey) => notices.push(resourceKey),
  });
  const saved = createSaved({
    request: (method, path, validate, body, init) =>
      api.request(method, path, validate, body, init),
    outbox,
    find: options.find,
  });
  return { saved, outbox, store, sent, notices };
}

const kept = (status = 200) =>
  new Response(JSON.stringify({ id: "copy-1", revision: 1 }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const refusal = (detail: string, status = 403) =>
  new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("a declared source names the entry that holds its copies and the two verbs that move one", () => {
  const { savable: found } = pair(library());
  assert.equal(found.list.entity, "copy");
  assert.deepEqual(
    { save: found.words.save, kept: found.words.saved, remove: found.words.remove },
    { save: "Save", kept: "Saved", remove: "Remove" },
    "the heart prints the declaration's own words",
  );
  assert.equal(found.saveVerb, "save");
  assert.equal(found.unsaveVerb, "unsave");
});

test("a keep with no network waits on this phone and goes with its own body and key when it returns", async () => {
  const online = { value: false };
  const { saved, outbox, store, sent, notices } = phone({
    online,
    find: async () => undefined,
    answer: () => kept(),
  });
  const { savable: found } = pair(library());
  const at = commandPath(found.list, "save");

  const answer = await saved.keep(found, { module: "look", kind: "product", key: "p-1" }, "7");
  assert.deepEqual(answer, { kept: false, held: true }, "a save the network never took is held");
  assert.deepEqual(sent, [], "a phone that is not reaching anything puts nothing on a wire");
  const held = (await store.store.list(ada))[0]!;
  assert.equal(held.resourceKey, "look/copy", "the queue knows which list this write belongs to");
  assert.equal(held.path, at);

  online.value = true;
  await outbox.drain();
  assert.deepEqual(sent, [
    {
      method: "POST",
      path: at,
      key: held.id,
      body: { source: { module: "look", kind: "product", key: "p-1" }, expectedSourceVersion: "7" },
    },
  ]);
  assert.deepEqual(await outbox.list(), [], "the row went when the server answered it");
  assert.deepEqual(notices, ["look/copy"], "the list of copies is told to read again");
});

test("a keep the server refuses is the answer to this write: it is said and never queued", async () => {
  const online = { value: true };
  const { saved, outbox, sent } = phone({
    online,
    find: async () => undefined,
    answer: () => refusal("You may not keep this record."),
  });
  const { savable: found } = pair(library());

  await assert.rejects(
    saved.keep(found, { module: "look", kind: "product", key: "p-1" }, "7"),
    /may not keep/,
  );
  assert.equal(sent.length, 1, "the refusal was answered once, not retried");
  assert.deepEqual(await outbox.list(), [], "a refused write is never queued for resend");
});

test("a removal is never queued: with no answer to take it, this phone keeps the copy", async () => {
  const online = { value: false };
  const { saved, outbox, sent } = phone({
    online,
    find: async () => ({ id: "copy-1", revision: 1 }),
    answer: () => kept(),
  });
  const { savable: found } = pair(library());

  await assert.rejects(saved.remove(found, "copy-1", 1));
  assert.deepEqual(sent, [], "a phone that is not reaching anything sent no removal");
  assert.deepEqual(await outbox.list(), [], "a removal never joins the queue");

  online.value = true;
  await saved.remove(found, "copy-1", 1);
  assert.deepEqual(sent, [
    {
      method: "POST",
      path: commandPath(found.list, "unsave", "copy-1"),
      key: null,
      body: { id: "copy-1", expectedRevision: 1 },
    },
  ]);
});

test("probe tells a kept copy from an absent one from nobody having said", async () => {
  const { savable: found } = pair(library());
  const ref = { module: "look", kind: "product", key: "p-1" };
  const asking = (find: () => Promise<unknown>) =>
    phone({ online: { value: true }, find, answer: () => kept() }).saved.probe(found, ref);

  assert.deepEqual(await asking(async () => ({ id: "copy-1", revision: 4 })), {
    state: "kept",
    id: "copy-1",
    revision: 4,
  });
  assert.deepEqual(await asking(async () => null), { state: "absent" });
  assert.deepEqual(await asking(async () => undefined), { state: "absent" });
  assert.deepEqual(await asking(async () => ({ id: "copy-1" })), { state: "unknown" });
  assert.deepEqual(
    await asking(async () => {
      throw new Error("the read refused");
    }),
    { state: "unknown" },
    "a refusal is nobody having said, never this person keeping nothing",
  );
});
