// Rules this file holds.
// An answer the phone keeps is kept for the person whose request brought it, whoever is signed in
// when it arrives. The offline fallback answers for whoever is asking now, from that scope's own
// rows: nobody reads the last page of the person who was here before them. One window asked twice
// keeps one row, spelled the way the transport spells it, so the page that lands replaces the page
// a person is looking at.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import type { Scope } from "../src/core/outbox";
import { listQuery, rowAddress } from "../src/effects/api";
import { answered, createReadCache } from "../src/effects/read-cache";
import { clock, fakeReadStore } from "./fakes/store";

const note = parseCatalog(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))).resources.find(
  (entry) => entry.entity === "note",
)!;
const offline = new TypeError("Network request failed");
const ada: Scope = { server: "https://acme.test", userId: "ada" };
const bea: Scope = { server: "https://acme.test", userId: "bea" };
const pagePath = note.path;

/** asks is a read cache whose sign-in a test moves between two statements. */
function asks(scope: () => Scope, store: ReturnType<typeof fakeReadStore>) {
  return createReadCache({ store: store.store, clock: clock(), scope });
}

const page = (id: string) => ({ items: [{ id, title: `${id} title` }], total: 1 });

test("an answer that lands after the sign-in changed is kept for the person who asked for it", async () => {
  const store = fakeReadStore();
  let scope = ada;
  await asks(() => scope, store).answer(
    { kind: "page", resourceKey: "note/note", path: pagePath, offset: 0 },
    async () => page("ada-note"),
  );
  scope = bea;

  const kept = await store.store.find(ada, pagePath);
  assert.equal(kept?.resourceKey, "note/note");
  assert.deepEqual(JSON.parse(kept!.payload), page("ada-note"));
  assert.equal(await store.store.find(bea, pagePath), undefined);
});

test("an offline read answers from the rows of whoever is asking now", async () => {
  const store = fakeReadStore();
  const address = rowAddress(note, "shared-note");
  await store.store.save(ada, {
    version: 1,
    kind: "row",
    resourceKey: "note/note",
    path: address,
    payload: JSON.stringify({ id: "shared-note", title: "Ada read this" }),
    savedAt: clock().now(),
  });
  let scope: Scope = ada;

  const asAda = await answered(
    asks(() => scope, store),
    { kind: "row", resourceKey: "note/note", path: address },
    "",
    () => Promise.reject(offline),
  );
  assert.equal(asAda.source, "device");
  assert.deepEqual(asAda.value, { id: "shared-note", title: "Ada read this" });

  // Bea signs in while the network stays dead and asks for the same address. The
  // address is the same; the row she may be answered from is not Ada's.
  scope = bea;
  await assert.rejects(
    () =>
      answered(
        asks(() => scope, store),
        { kind: "row", resourceKey: "note/note", path: address },
        "",
        () => Promise.reject(offline),
      ),
    (error) => error === offline,
    "Bea is not answered from Ada's row",
  );
});

test("one window asked twice keeps one row, spelled as the transport spells it", async () => {
  const store = fakeReadStore();
  const reads = asks(() => ada, store);
  const window = { offset: 0, limit: 20, sort: "-createdAt", filters: ["state:open"] };
  const query = listQuery(window);
  const asked: string[] = [];

  const first = await answered(
    reads,
    { kind: "page", resourceKey: "note/note", path: note.path, offset: window.offset },
    query,
    async () => {
      asked.push(`${note.path}?${listQuery(window)}`);
      return page("one");
    },
  );
  const second = await answered(
    reads,
    { kind: "page", resourceKey: "note/note", path: note.path, offset: window.offset },
    query,
    () => Promise.reject(offline),
  );

  assert.deepEqual(asked, [`${note.path}?limit=20&offset=0&sort=-createdAt&filter=state%3Aopen`]);
  assert.equal(second.source, "device");
  assert.deepEqual(second.value, first.value);
  assert.equal(second.savedAt, clock().now());
  assert.equal(store.rows.length, 1, "the same window asked twice leaves one row, not two");
});
