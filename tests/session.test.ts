import assert from "node:assert/strict";
import test from "node:test";
import { createSessionStore, type SecureStorage } from "../src/effects/session";

function memory() {
  const values = new Map<string, string>();
  const storage: SecureStorage = {
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      values.delete(key);
    },
  };
  return { values, storage };
}

const oldSession = { baseURL: "https://first.example.com", cookie: "test_session=first" };
const nextSession = { baseURL: "https://second.example.com", cookie: "test_session=second" };

test("one versioned secure record keeps origin and cookie together across launches", async () => {
  const { values, storage } = memory();
  await createSessionStore(storage).save(nextSession);
  assert.deepEqual([...values.keys()], ["platformkit.session"]);
  assert.deepEqual(JSON.parse(values.get("platformkit.session")!), { version: 1, ...nextSession });
  assert.deepEqual(await createSessionStore(storage).load(), nextSession);
});

test("a failed replacement cannot combine one server with another server's cookie", async () => {
  const { storage } = memory();
  const sessions = createSessionStore(storage);
  await sessions.save(oldSession);
  const write = storage.setItemAsync;
  storage.setItemAsync = async () => {
    throw new Error("storage full");
  };
  await assert.rejects(sessions.save(nextSession), /storage full/);
  storage.setItemAsync = write;
  assert.deepEqual(await createSessionStore(storage).load(), oldSession);
});

test("legacy records preserve the server address but never reuse an unbound cookie", async () => {
  const { values, storage } = memory();
  values.set("platformkit.url", nextSession.baseURL);
  values.set("platformkit.cookie", oldSession.cookie);
  assert.deepEqual(await createSessionStore(storage).load(), { baseURL: nextSession.baseURL });
  assert.equal(values.has("platformkit.url"), false);
  assert.equal(values.has("platformkit.cookie"), false);
  assert.deepEqual(await createSessionStore(storage).load(), { baseURL: nextSession.baseURL });
});

test("sign-out queues after a pending save and prevents restoration", async () => {
  const { storage } = memory();
  const writing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const write = storage.setItemAsync;
  let first = true;
  storage.setItemAsync = async (key, value) => {
    if (first) {
      first = false;
      writing.resolve();
      await release.promise;
    }
    await write(key, value);
  };
  const sessions = createSessionStore(storage);
  const save = sessions.save(nextSession);
  await writing.promise;
  const clear = sessions.clear();
  release.resolve();
  await Promise.all([save, clear]);
  assert.equal(await createSessionStore(storage).load(), undefined);
});

test("a rejected save does not block subsequent clearing, which keeps only the address", async () => {
  const { storage } = memory();
  const sessions = createSessionStore(storage);
  const write = storage.setItemAsync;
  storage.setItemAsync = async () => {
    throw new Error("write failed");
  };
  await assert.rejects(sessions.save(oldSession), /write failed/);
  storage.setItemAsync = write;
  await sessions.clear(nextSession.baseURL);
  assert.deepEqual(await sessions.load(), { baseURL: nextSession.baseURL });
});

test("clearing failure is reported and does not claim the saved session is gone", async () => {
  const { storage } = memory();
  const sessions = createSessionStore(storage);
  await sessions.save(oldSession);
  storage.setItemAsync = async () => {
    throw new Error("store unavailable");
  };
  await assert.rejects(sessions.clear(), /store unavailable/);
  assert.deepEqual(await sessions.load(), oldSession);
});

test("malformed or unsupported records never become authenticated sessions", async () => {
  for (const record of [
    "not json",
    "null",
    '{"version":2}',
    '{"version":1,"cookie":"orphan"}',
    '{"version":1,"baseURL":42}',
    '{"version":1,"baseURL":"https://example.com","cookie":false}',
  ]) {
    const { values, storage } = memory();
    values.set("platformkit.session", record);
    await assert.rejects(createSessionStore(storage).load());
  }
});
