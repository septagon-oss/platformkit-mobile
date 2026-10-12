import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../src/core/outbox";
import { createReadCache } from "../src/effects/read-cache";
import { clock, fakeReadStore } from "./fakes/store";

for (const changed of ["person", "server"] as const) {
  test(`a read finishing after the ${changed} changes never enters the new scope's cache`, async () => {
    const first: Scope = { server: "https://acme.test", userId: "ada" };
    const second: Scope =
      changed === "person"
        ? { ...first, userId: "bea" }
        : { ...first, server: "https://other.test" };
    let scope = first;
    const store = fakeReadStore();
    const cache = createReadCache({ store: store.store, clock: clock(), scope: () => scope });
    const started = Promise.withResolvers<void>();
    const response = Promise.withResolvers<{ id: string; title: string }>();
    const path = "/api/v1/note/notes/private-note";
    const loading = cache.answer({ kind: "row", resourceKey: "note/note", path }, () => {
      started.resolve();
      return response.promise;
    });
    await started.promise;
    scope = second;
    response.resolve({ id: "private-note", title: "First scope's private note" });
    // Either refusing an obsolete read or completing it for its original scope
    // is acceptable; persisting its data under the new scope is not.
    await loading.catch(() => undefined);
    assert.equal(await store.store.find(second, path), undefined);
  });
}
