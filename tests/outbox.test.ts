// The outbox keeps a write the person made that the server never received, and
// sends held writes in the order they were made. These cases are its contract:
// order, one key per write, a refusal that stops that write alone, a fate that
// is not knowable, and one sign-in's queue never being another's. The double in
// tests/fakes/store.ts carries the same columns and the same scope rule as the
// SQLite adapter, so each decision is made once, above both.
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";
import { createOutbox, outcomeOf, type Outbox } from "../src/effects/outbox";
import { heldWrite, type PendingWrite, type Scope } from "../src/core/outbox";
import { clock, fakeOutboxStore, mint } from "./fakes/store";

const SERVER = "https://acme.test";
const SCOPE: Scope = { server: SERVER, userId: "ada" };
const OTHER: Scope = { server: SERVER, userId: "ada@other.test" };
const PATH = "/api/v1/note/notes";
/** KEY is the credential this connection holds: what a held write leaves with. */
const KEY = { token: "pk_live_shown-on-the-wire-only", id: "00000000-0000-4000-8000-000000000021" };
const AT = "2026-10-06T10:00:00.000Z";

interface Reply {
  readonly status?: number;
  readonly body?: unknown;
  /** offline is the transport refusing before any answer: React Native's fetch rejects with a TypeError. */
  readonly offline?: boolean;
  /** hang is a request that goes and never comes back, which the deadline ends. */
  readonly hang?: boolean;
}

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly key: string | undefined;
  readonly body: string | undefined;
  readonly credential: string | undefined;
}

/** wire answers each request from replies, in order, repeating the last one, and records what left the phone. */
function wire(replies: readonly Reply[]) {
  const sent: Sent[] = [];
  let index = 0;
  const fetchImpl = (async (input, init) => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    sent.push({
      method: String(init?.method ?? "GET"),
      path: `${url.pathname}${url.search}`,
      key: headers["Idempotency-Key"],
      body: init?.body === undefined ? undefined : String(init.body),
      credential: headers.Authorization,
    });
    const reply = replies[Math.min(index, replies.length - 1)] ?? {};
    index += 1;
    if (reply.offline) throw new TypeError("Network request failed");
    if (reply.hang)
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("the socket died")));
      });
    return new Response(reply.body === undefined ? "" : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, sent };
}

function kit(replies: readonly Reply[], reach?: boolean) {
  const store = fakeOutboxStore();
  const network = wire(replies);
  const noticed: string[] = [];
  const outbox = createOutbox({
    store: store.store,
    // The deadline is short so "it went and no answer came back" is a case a
    // suite can run; on a device it is src/effects/api.ts's TIMEOUT.
    api: createApi(SERVER, network.fetchImpl, KEY, 40),
    clock: clock(),
    mint: mint(),
    scope: () => SCOPE,
    notice: (key) => noticed.push(key),
    ...(reach === undefined ? {} : { reached: () => reach }),
  });
  return { outbox, store, network, noticed };
}

/** offlineWrites is what a phone that could not reach the server kept: one row per write, in the order they were made. */
async function offlineWrites(titles: readonly string[], kind: PendingWrite["kind"] = "create") {
  const from = kit([{ offline: true }]);
  const answers = [];
  for (const title of titles)
    answers.push(
      await from.outbox.submit({
        kind,
        resourceKey: "note/note",
        path: `${PATH}${title === "" ? "" : `/${title}`}`,
        body: title === "" ? undefined : { title },
      }),
    );
  return { outbox: from.outbox, answers, items: await from.outbox.list() };
}

/** carried moves a phone's held writes onto one that can reach a server. */
function carried(from: Outbox, replies: readonly Reply[], reach?: boolean) {
  const to = kit(replies, reach);
  return from.list().then((items) => {
    for (const item of items) to.store.raw(item);
    return { ...to, items };
  });
}

test("a write made while the network will not take it is kept and is not counted as written", async () => {
  const { outbox, store, noticed, network } = kit([{ offline: true }]);
  const answer = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "Field note" },
  });
  assert.equal(answer.sent, false);
  assert.equal(store.rows.length, 1);
  assert.deepEqual(noticed, [], "a held write is not a write this app has made");
  assert.equal(store.rows[0]!.item.state, "queued");
  assert.equal(
    store.rows[0]!.item.attempt,
    0,
    "the network never took it, so it never went on a wire",
  );
  assert.equal(network.sent.length, 1);
});

test("a held body survives exactly as the form produced it, money untouched", async () => {
  const { outbox, store } = kit([{ offline: true }]);
  const values = { title: "Invoice", amount: 1250, currency: "EUR", note: "café" };
  await outbox.submit({ kind: "create", resourceKey: "note/note", path: PATH, body: values });
  assert.deepEqual(JSON.parse(store.rows[0]!.item.body as string), values);
});

test("every attempt of one held write says the same idempotency key", async () => {
  const { outbox, network } = kit([
    { offline: true },
    { status: 503 },
    { status: 200, body: { id: "7" } },
  ]);
  const answer = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "x" },
  });
  const id = (answer as { item: PendingWrite }).item.id;
  await outbox.drain();
  assert.equal((await outbox.list())[0]!.state, "queued", "an unhappy server is not a refusal");
  assert.equal((await outbox.list())[0]!.attempt, 1);
  await outbox.drain();
  const attempts = network.sent.filter((r) => r.path === PATH);
  assert.equal(attempts.length, 3, "the live attempt and two sends");
  assert.deepEqual(
    attempts.map((r) => r.key),
    [id, id, id],
    "the attempt that may have landed, the send that was told to wait and the send that landed all name the same write, which is the only way a server can spot a repeat",
  );
});

test("a write the server answers goes once, under the key a replay would have carried, and is counted once", async () => {
  const { outbox, store, noticed, network } = kit([{ status: 201, body: { id: "7" } }]);
  assert.deepEqual(
    await outbox.submit({
      kind: "create",
      resourceKey: "note/note",
      path: PATH,
      body: { title: "x" },
    }),
    { sent: true, row: { id: "7" } },
    "the row the server answered with is the answer, which is how a sheet navigates to what it wrote",
  );
  assert.deepEqual(store.rows, []);
  // The screen counts a write it made itself, as it does today; the outbox
  // counts only what it landed from the queue, so one write is never counted twice.
  assert.deepEqual(noticed, []);
  assert.ok(
    typeof network.sent[0]!.key === "string" && network.sent[0]!.key.length > 0,
    "a write that could have been held names itself on the attempt that landed too",
  );
  assert.equal(network.sent.length, 1, "one write, one request");
});

test("a screen's own call is what goes on the wire while the server answers", async () => {
  const { outbox, store } = kit([{ status: 201, body: { id: "9" } }]);
  const made: string[] = [];
  const answer = await outbox.submit(
    { kind: "update", resourceKey: "note/note", path: `${PATH}/3`, body: { title: "x" } },
    async () => {
      made.push("api.update");
      return { id: "3", title: "x" };
    },
  );
  assert.deepEqual(answer, { sent: true, row: { id: "3", title: "x" } });
  assert.deepEqual(made, ["api.update"], "the typed call, not a rebuilt one");
  assert.deepEqual(store.rows, []);
});

test("the queue drains in the order the writes were made, one at a time", async () => {
  const held = await offlineWrites(["first", "second", "third"]);
  assert.deepEqual(
    held.answers.map((answer) => answer.sent),
    [false, false, false],
  );
  const { outbox, network } = await carried(held.outbox, [{ status: 200, body: { id: "1" } }]);
  await outbox.drain();
  assert.deepEqual(
    network.sent.map((r) => r.path),
    [`${PATH}/first`, `${PATH}/second`, `${PATH}/third`],
    "the append order is the queue's order, whatever the device's clock says",
  );
});

test("a refusal stops that write and the queue continues with the next", async () => {
  const held = await offlineWrites(["one", "two", "three"]);
  const { outbox, network, store } = await carried(held.outbox, [
    { status: 200, body: { id: "8" } },
    {
      status: 400,
      body: { detail: "crud: invalid: title is required", errors: ["body.title: required"] },
    },
    { status: 200, body: { id: "10" } },
  ]);
  await outbox.drain();
  const after = await outbox.list();
  assert.equal(after.length, 1, "only the refused write is left on the phone");
  assert.equal(after[0]!.refusal?.detail, "title is required");
  assert.equal(after[0]!.refusal?.fields.title, "required");
  assert.equal(
    network.sent.filter((r) => r.key === after[0]!.id).length,
    1,
    "the refused write went on a wire exactly once",
  );
  assert.equal(network.sent.length, 3, "the pass went on to the third write");
  assert.equal(store.rows.length, 1);
});

test("a refused write is never sent again by itself", async () => {
  const { outbox, network } = kit([
    { offline: true },
    { status: 400, body: { detail: "title is required" } },
    { status: 200, body: { id: "1" } },
  ]);
  const held = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "x" },
  });
  await outbox.drain();
  await outbox.drain();
  await outbox.drain({ force: true });
  const after = await outbox.list();
  assert.equal(after[0]!.state, "refused");
  assert.equal(
    network.sent.filter((r) => r.key === (held as { item: PendingWrite }).item.id).length,
    2,
    "the attempt that never left the phone and the one send that was refused: no timer, no repeat",
  );
});

test("Retry sends the same key again, clears the row and counts the write once", async () => {
  const { outbox, store, noticed, network } = kit([
    { offline: true },
    { status: 400, body: { detail: "title is required" } },
    { status: 200, body: { id: "7" } },
  ]);
  const answer = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "x" },
  });
  const id = (answer as { item: PendingWrite }).item.id;
  await outbox.drain();
  assert.equal((await outbox.list())[0]!.state, "refused");
  await outbox.retry(id);
  assert.deepEqual(store.rows, [], "a write that landed leaves no row");
  assert.deepEqual(noticed, ["note/note"]);
  assert.deepEqual(
    network.sent.map((r) => r.key),
    [id, id, id],
    "the held attempt, the refusal and the Retry say the same thing, and nothing else went out",
  );
});

test("Discard deletes the write, the queue continues, and a second Discard is a no-op", async () => {
  const from = kit([{ offline: true }]);
  await from.outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "one" },
  });
  await from.outbox.submit({ kind: "delete", resourceKey: "note/note", path: `${PATH}/5` });
  const { outbox, network } = await carried(from.outbox, [{ status: 200, body: { id: "5" } }]);
  const [gone, kept] = (await outbox.list()) as [PendingWrite, PendingWrite];
  assert.equal(await outbox.discard(gone.id), true);
  assert.equal(await outbox.discard(gone.id), false, "it is not there twice");
  // One queue runs one write at a time, so the second Discard is answered behind
  // the send the first one started, and by then that send has carried the write
  // the person kept. The queue went on; it did not wait to be asked again.
  assert.deepEqual(
    (await outbox.list()).map((item) => item.id),
    [],
    "the row the person threw away is off the device, and the one they kept landed",
  );
  await outbox.drain();
  assert.deepEqual(
    network.sent.map((r) => [r.method, r.key]),
    [["DELETE", kept.id]],
    "the kept write went once, as a delete, under its own key, and the discarded create never went on a wire",
  );
});

test("a network that never took the request returns the write to queued and ends the pass", async () => {
  const held = await offlineWrites(["one", "two", "three"]);
  const { outbox, network } = await carried(held.outbox, [
    { offline: true },
    { status: 200, body: { id: "2" } },
  ]);
  await outbox.drain();
  const after = await outbox.list();
  assert.equal(after.length, 3);
  assert.deepEqual(
    after.map((item) => [item.state, item.attempt]),
    [
      ["queued", 0],
      ["queued", 0],
      ["queued", 0],
    ],
  );
  assert.equal(
    network.sent.filter((r) => r.key !== undefined).length,
    1,
    "the pass spent nothing on the rest",
  );
});

test("one sign-in's queue is not another's", async () => {
  const store = fakeOutboxStore();
  // Their phone cannot reach the server, so its write is kept; this one can,
  // and must neither see the row nor send it.
  const theirs = wire([{ offline: true }]);
  const mine = wire([{ status: 200, body: { id: "1" } }]);
  const theirsOutbox = createOutbox({
    store: store.store,
    api: createApi(SERVER, theirs.fetchImpl),
    clock: clock(),
    mint: mint(),
    scope: () => OTHER,
  });
  const mineOutbox = createOutbox({
    store: store.store,
    api: createApi(SERVER, mine.fetchImpl),
    clock: clock(),
    mint: mint(),
    scope: () => SCOPE,
  });
  const answer = await theirsOutbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "x" },
  });
  const id = (answer as { item: PendingWrite }).item.id;
  assert.deepEqual(
    await mineOutbox.list(),
    [],
    "a list says nothing about another person's writes",
  );
  await assert.rejects(() => mineOutbox.retry(id), /another sign-in/);
  assert.equal(await mineOutbox.discard(id), false);
  assert.equal(store.rows[0]!.item.state, "queued");
  assert.equal(store.rows[0]!.item.attempt, 0, "nothing of theirs moved");
  assert.deepEqual(mine.sent, [], "nothing of theirs left this phone");
  await assert.rejects(
    () => store.store.list(undefined as never),
    RangeError,
    "a call without a scope is refused by the store, in the method it names",
  );
  assert.equal((await theirsOutbox.list()).length, 1);
});

test("a write left sending is answered from its row, not from memory", async () => {
  const store = fakeOutboxStore();
  store.raw({
    ...heldWrite({ kind: "create", resourceKey: "note/note", path: PATH }, "never-left", AT),
    state: "sending",
    attempt: 0,
  });
  store.raw({
    ...heldWrite({ kind: "create", resourceKey: "note/note", path: PATH }, "went-out", AT),
    state: "sending",
    attempt: 1,
  });
  const reopened = createOutbox({
    store: store.store,
    api: createApi(SERVER, wire([{ status: 200, body: { id: "1" } }]).fetchImpl),
    clock: clock(),
    mint: mint(),
    scope: () => SCOPE,
  });
  await reopened.open();
  assert.deepEqual(
    (await reopened.list()).map((item) => [item.id, item.state]),
    [
      ["never-left", "queued"],
      ["went-out", "unknown"],
    ],
  );
});

test("a second claim of a sending write moves nothing", async () => {
  const store = fakeOutboxStore();
  store.raw(heldWrite({ kind: "create", resourceKey: "note/note", path: PATH }, "one", AT));
  const first = await store.store.claim(SCOPE, "one", "2026-10-06T10:00:01.000Z");
  assert.equal(first?.attempt, 1);
  assert.equal(await store.store.claim(SCOPE, "one", "2026-10-06T10:00:02.000Z"), undefined);
  assert.equal(store.rows[0]!.item.attempt, 1);
});

test("a deadline after a send leaves the write unknown and never sends it again", async () => {
  const { outbox, network } = kit([
    { offline: true },
    { hang: true },
    { status: 200, body: { id: "1" } },
  ]);
  await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "x" },
  });
  await outbox.drain();
  const after = await outbox.list();
  assert.equal(after[0]!.state, "unknown");
  assert.equal(after[0]!.attempt, 1);
  await outbox.drain();
  await outbox.drain({ force: true });
  assert.equal((await outbox.list())[0]!.state, "unknown");
  assert.deepEqual(
    network.sent.map((r) => r.key),
    [after[0]!.id, after[0]!.id],
    "the attempt that never left and the one that was cut off, both naming this write; nothing already sent is resent",
  );
});

test("an answer that fails its validator keeps the write on the phone", async () => {
  const held = await offlineWrites(["one"]);
  const { outbox, network } = await carried(held.outbox, [{ status: 200, body: "not a record" }]);
  await outbox.drain();
  const after = await outbox.list();
  assert.equal(after.length, 1, "a lost write wearing a success is the one thing this must not do");
  assert.equal(after[0]!.state, "unknown");
  assert.equal(network.sent.length, 1);
});

test("signing out clears this person's held writes and nobody else's", async () => {
  const store = fakeOutboxStore();
  store.raw(heldWrite({ kind: "create", resourceKey: "note/note", path: PATH }, "mine", AT));
  store.raw(
    heldWrite({ kind: "create", resourceKey: "note/note", path: PATH }, "theirs", AT),
    OTHER.server,
    OTHER.userId,
  );
  const outbox = createOutbox({
    store: store.store,
    api: createApi(SERVER, wire([{ status: 200, body: { id: "1" } }]).fetchImpl),
    clock: clock(),
    mint: mint(),
    scope: () => SCOPE,
  });
  await outbox.clear();
  assert.deepEqual(
    store.rows.map((row) => row.item.id),
    ["theirs"],
  );
  assert.equal(store.calls.filter((call) => call === "clear").length, 1);
  await outbox.clear();
  assert.deepEqual(
    store.rows.map((row) => row.item.id),
    ["theirs"],
    "clearing twice is the same nothing",
  );
});

test("nothing that signs in is written to the device store", async () => {
  const { outbox, store, network } = kit([{ offline: true }]);
  await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "x" },
  });
  await outbox.drain();
  assert.ok(
    network.sent.some((r) => r.credential === `Bearer ${KEY.token}`),
    "the wire carries the key this connection holds",
  );
  assert.equal(JSON.stringify(store.rows).includes(KEY.token), false);
  assert.equal(JSON.stringify(store.rows).toLowerCase().includes("pk_live"), false);
});

test("outcomeOf names the server being unhappy, the network, and a fate nobody knows", () => {
  assert.equal(outcomeOf(new TypeError("Network request failed")), "unreachable");
  assert.equal(
    outcomeOf(new ApiError(0, "https://acme.test did not answer within 15 seconds.")),
    "timeout",
  );
  assert.equal(outcomeOf(new ApiError(503, "unavailable")), "waiting");
  assert.equal(outcomeOf(new ApiError(429, "slow down")), "waiting");
  assert.equal(outcomeOf(new ApiError(408, "slow down")), "waiting");
  assert.equal(outcomeOf(new ApiError(403, "you may not")), "refused");
  assert.equal(outcomeOf(new ApiError(402, "your plan")), "refused");
  assert.equal(
    outcomeOf(new ApiError(200, "Invalid response at /api/v1/note/notes.")),
    "unreadable",
  );
});

test("a phone that hears no network holds the write without trying the wire", async () => {
  const { outbox, store, network } = kit([{ status: 200, body: { id: "1" } }], false);
  const answer = await outbox.submit({
    kind: "create",
    resourceKey: "note/note",
    path: PATH,
    body: { title: "x" },
  });
  assert.equal(answer.sent, false);
  assert.equal(store.rows.length, 1);
  assert.deepEqual(
    network.sent,
    [],
    "the hint decided nothing about a wire, it only saved the wait",
  );
  await outbox.drain();
  assert.deepEqual(network.sent, [], "and the same hint held the pass back");
  await outbox.drain({ force: true });
  assert.equal(network.sent.length, 1, "Retry does not ask the hint");
});
