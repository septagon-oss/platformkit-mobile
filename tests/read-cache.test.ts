// The read cache answers a screen from the last response this phone received for
// one read address when the server cannot be reached. These cases hold which
// response earns a row, which address a stored one may answer for, and that a
// server that answered is never overwritten by the phone's own memory.
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../src/effects/api";
import { createReadCache } from "../src/effects/read-cache";
import { worthKeeping } from "../src/core/read-cache";
import type { Scope } from "../src/core/outbox";
import { clock, fakeReadStore } from "./fakes/store";
import type { ReadStore } from "../src/effects/read-cache";

const SERVER = "https://acme.test";
const SCOPE: Scope = { server: SERVER, userId: "ada" };
const PATH = "/api/v1/note/notes?limit=20";
const PAGE = { items: [{ id: "1", title: "Field note" }], total: 1 };

/** offline answers one read however the case needs, and says whether it was asked at all. */
function readOnce(
  result: { page?: unknown; refused?: number; unreachable?: boolean; silent?: boolean } = {},
) {
  let asked = 0;
  const read = async () => {
    asked += 1;
    // A deadline is api.ts's ApiError with status 0: the server was there and
    // said nothing, which is the same silence a screen shows a cached page for.
    if (result.silent) throw new ApiError(0, `${SERVER} did not answer within 15 seconds.`);
    if (result.unreachable) throw new TypeError("Network request failed");
    if (result.refused) throw new ApiError(result.refused, "you may not read that");
    return (result.page ?? PAGE) as typeof PAGE;
  };
  return { read, asked: () => asked };
}

function cache(scope: () => Scope | undefined = () => SCOPE) {
  const store = fakeReadStore();
  const at = clock();
  const reads = createReadCache({ store: store.store, clock: at, scope });
  return { store, at, reads };
}

test("a read the phone could not reach is answered from the last page it got", async () => {
  const { reads } = cache();
  const first = await reads.answer(
    { path: PATH, kind: "page", resourceKey: "note/note" },
    readOnce().read,
  );
  assert.equal(first.source, "server");
  assert.equal(first.savedAt, undefined);
  const later = await reads.answer(
    { path: PATH, kind: "page", resourceKey: "note/note" },
    readOnce({ unreachable: true }).read,
  );
  assert.equal(later.source, "device");
  assert.deepEqual(later.value, PAGE);
  assert.equal(
    later.savedAt,
    "2026-10-06T10:00:00.000Z",
    "the offline line has a real instant to name",
  );
});

test("the answer is for the address it was read at, and for that one only", async () => {
  const { reads } = cache();
  await reads.answer({ path: PATH, kind: "page", resourceKey: "note/note" }, readOnce().read);
  const other = readOnce({ unreachable: true });
  await assert.rejects(
    () =>
      reads.answer(
        { path: `${PATH}&sort=title`, kind: "page", resourceKey: "note/note" },
        other.read,
      ),
    TypeError,
    "a different order is a different question, so the phone does not answer it with an old page",
  );
  assert.equal(other.asked(), 1);
});

test("a read the server refused is what the server said, not the cache", async () => {
  const { reads, store } = cache();
  await reads.answer({ path: PATH, kind: "page", resourceKey: "note/note" }, readOnce().read);
  await assert.rejects(
    () =>
      reads.answer(
        { path: PATH, kind: "page", resourceKey: "note/note" },
        readOnce({ refused: 403 }).read,
      ),
    ApiError,
  );
  assert.equal(store.rows.length, 1, "a refusal neither writes nor wipes");
});

test("a page beyond the first window is never kept, and a second first page replaces the one kept", async () => {
  const { reads, store } = cache();
  assert.equal(worthKeeping(0), true);
  assert.equal(worthKeeping(20), false);
  await reads.answer(
    { path: `${PATH}&offset=20`, kind: "page", resourceKey: "note/note", offset: 20 },
    readOnce({ page: { items: [{ id: "9" }], total: 9 } }).read,
  );
  assert.deepEqual(store.rows, [], "a window nobody is looking at cannot mislead later");
  await reads.answer(
    { path: PATH, kind: "page", resourceKey: "note/note" },
    readOnce({ page: { items: [], total: 0 } }).read,
  );
  assert.equal(store.rows.length, 1);
  await reads.answer(
    { path: PATH, kind: "page", resourceKey: "note/note" },
    readOnce({ page: { items: [{ id: "5" }], total: 1 } }).read,
  );
  assert.equal(store.rows.length, 1, "one row per read address");
  const offline = await reads.answer(
    { path: PATH, kind: "page", resourceKey: "note/note" },
    readOnce({ unreachable: true }).read,
  );
  assert.deepEqual(offline.value, { items: [{ id: "5" }], total: 1 });
});

test("a read made before anyone is signed in is neither cached nor answered from the cache", async () => {
  const { reads, store } = cache(() => undefined);
  const answer = await reads.answer(
    { path: PATH, kind: "page", resourceKey: "note/note" },
    readOnce().read,
  );
  assert.deepEqual(answer, { value: PAGE, source: "server" });
  assert.deepEqual(store.rows, [], "nothing is kept that belongs to nobody");
  await assert.rejects(
    () =>
      reads.answer(
        { path: PATH, kind: "page", resourceKey: "note/note" },
        readOnce({ unreachable: true }).read,
      ),
    TypeError,
  );
});

test("one person's cached page never answers for another", async () => {
  const store = fakeReadStore();
  const other: Scope = { server: SERVER, userId: "ada@other.test" };
  const mine = createReadCache({ store: store.store, clock: clock(), scope: () => SCOPE });
  await mine.answer({ path: PATH, kind: "page", resourceKey: "note/note" }, readOnce().read);
  const theirs = createReadCache({ store: store.store, clock: clock(), scope: () => other });
  await assert.rejects(
    () =>
      theirs.answer(
        { path: PATH, kind: "page", resourceKey: "note/note" },
        readOnce({ unreachable: true }).read,
      ),
    TypeError,
    "the phone has the page, but not for this person",
  );
  await theirs.clear();
  assert.equal(store.rows.length, 1, "clearing one person's cache leaves the other's alone");
});

test("a cached answer this version cannot read is lost, not guessed at", async () => {
  const { reads, store } = cache();
  await reads.answer({ path: PATH, kind: "page", resourceKey: "note/note" }, readOnce().read);
  store.unreadable(PATH);
  // The row's version is now one this kit never wrote: a cache may be lost, so
  // the screen gets the ordinary error and nothing is invented for it.
  await assert.rejects(
    () =>
      reads.answer(
        { path: PATH, kind: "page", resourceKey: "note/note" },
        readOnce({ unreachable: true }).read,
      ),
    TypeError,
  );
});

test("a store call that names no sign-in is refused in the method it names", async () => {
  const store: ReadStore = fakeReadStore().store;
  await assert.rejects(() => store.find(undefined as never, PATH), RangeError);
  await assert.rejects(() => store.clear(undefined as never), RangeError);
});

test("a deadline is silence too, so the cache answers it as it answers no network", async () => {
  const { reads } = cache();
  await reads.answer({ path: PATH, kind: "page", resourceKey: "note/note" }, readOnce().read);
  const quiet = await reads.answer(
    { path: PATH, kind: "page", resourceKey: "note/note" },
    readOnce({ silent: true }).read,
  );
  assert.equal(quiet.source, "device");
  assert.deepEqual(quiet.value, PAGE);
});
