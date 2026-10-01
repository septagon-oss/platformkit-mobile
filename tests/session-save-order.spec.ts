import assert from "node:assert/strict";
import test from "node:test";
import { createSessionStore, type SecureStorage } from "../src/effects/session";

const first = { baseURL: "https://first.example.com", cookie: "test_session=first" };
const second = { baseURL: "https://second.example.com", cookie: "test_session=second" };

test("a later save queued behind a slow one is the session a relaunch restores", async () => {
  const values = new Map<string, string>();
  const writing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let held = false;
  const storage: SecureStorage = {
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      if (!held) {
        held = true;
        writing.resolve();
        await release.promise;
      }
      values.set(key, value);
    },
  };
  const sessions = createSessionStore(storage);
  const slow = sessions.save(first);
  await writing.promise;
  const later = sessions.save(second);
  release.resolve();
  await Promise.all([slow, later]);
  assert.deepEqual(await createSessionStore(storage).load(), second);
});
