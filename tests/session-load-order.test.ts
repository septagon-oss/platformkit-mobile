// Secure storage holds one session at a time. A load that starts while a save is still
// writing has to answer with the session that replaced it, not the one it began behind.
import assert from "node:assert/strict";
import test from "node:test";
import { createSessionStore, type SecureStorage } from "../src/effects/session";

test("a load queued during session replacement reads the replacement tenant", async () => {
  const values = new Map<string, string>();
  const writing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let hold = false;
  const storage: SecureStorage = {
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      if (hold) {
        writing.resolve();
        await release.promise;
      }
      values.set(key, value);
    },
  };
  const sessions = createSessionStore(storage);
  await sessions.save({ baseURL: "https://first.example.test", cookie: "pk=first" });
  hold = true;
  const save = sessions.save({ baseURL: "https://second.example.test", cookie: "pk=second" });
  await writing.promise;
  const load = sessions.load();
  release.resolve();
  await save;
  assert.deepEqual(await load, { baseURL: "https://second.example.test", cookie: "pk=second" });
});
