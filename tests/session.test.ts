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
  };
  return { values, storage };
}

const oldSession = {
  baseURL: "https://first.example.com",
  token: "pk_live_first",
  tokenId: "00000000-0000-4000-8000-000000000001",
};
const nextSession = {
  baseURL: "https://second.example.com",
  token: "pk_live_second",
  tokenId: "00000000-0000-4000-8000-000000000002",
};

test("one versioned secure record keeps origin and key together across launches", async () => {
  const { values, storage } = memory();
  await createSessionStore(storage).save(nextSession);
  assert.deepEqual([...values.keys()], ["platformkit.session"]);
  assert.deepEqual(JSON.parse(values.get("platformkit.session")!), { version: 2, ...nextSession });
  assert.deepEqual(await createSessionStore(storage).load(), nextSession);
});

test("a failed replacement cannot combine one server with another server's key", async () => {
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

test("loading an empty store does not create a saved session", async () => {
  const { storage, values } = memory();
  assert.equal(await createSessionStore(storage).load(), undefined);
  assert.equal(values.size, 0);
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
    // A future version is not this one, whatever else it holds.
    '{"version":3}',
    '{"version":2,"baseURL":42}',
    // Half a key is no key: one with no id cannot be revoked, an id with no key
    // opens nothing, and neither is a state the app should try to be in.
    '{"version":2,"baseURL":"https://example.com","token":"pk_live"}',
    '{"version":2,"baseURL":"https://example.com","tokenId":"00000000-0000-4000-8000-000000000001"}',
    '{"version":2,"baseURL":"https://example.com","token":"","tokenId":"00000000-0000-4000-8000-000000000001"}',
  ]) {
    const { values, storage } = memory();
    values.set("platformkit.session", record);
    await assert.rejects(createSessionStore(storage).load());
  }
});

test("the record a sign-out leaves keeps the server and holds no key", async () => {
  const { values, storage } = memory();
  values.set("platformkit.session", '{"version":2}');
  assert.equal(await createSessionStore(storage).load(), undefined);
});

test("a saved cookie from the record format this client no longer sends is the server, not a fault", async () => {
  // Version 1 held the auth module's session cookie. It parsed perfectly, the
  // server is real, and nothing this client sends could present it: the person
  // who upgrades is asked for their password, not shown a broken record.
  for (const record of [
    '{"version":1,"baseURL":"https://example.com","cookie":"platformkit_session=abc"}',
    '{"version":1,"baseURL":"https://example.com"}',
  ]) {
    const { values, storage } = memory();
    values.set("platformkit.session", record);
    assert.deepEqual(await createSessionStore(storage).load(), { baseURL: "https://example.com" });
  }
});

test("a cookie member in a version 2 record names nothing this client reads", async () => {
  const { values, storage } = memory();
  values.set(
    "platformkit.session",
    '{"version":2,"baseURL":"https://example.com","token":"pk_live","tokenId":"00000000-0000-4000-8000-000000000001","cookie":"platformkit_session=abc"}',
  );
  assert.deepEqual(await createSessionStore(storage).load(), {
    baseURL: "https://example.com",
    token: "pk_live",
    tokenId: "00000000-0000-4000-8000-000000000001",
  });
});
