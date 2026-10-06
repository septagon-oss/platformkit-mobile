// A denied activity read withdraws even malformed cached events and pending pagination.
// Clearing the denial restores validation, not permission to display an invalid cached row.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, deriveEventActivity } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

test("denial suppresses malformed cached activity and paging in either loading phase", () => {
  for (const language of ["en", "pt"] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    for (const loading of [false, true]) {
      const cached = {
        events: [
          {
            id: "event-512",
            name: "note.note.updated",
            occurredAt: "invalid-time",
            actor: "actor-512",
            payload: { id: "note-512" },
          },
        ],
        names: { "actor-512": "Cached actor 512" },
        loading,
        loadingMore: !loading,
        more: true,
        error: p.copy.kit.unavailable,
        denied: true,
      };
      const before = JSON.stringify(cached);
      const denied = deriveEventActivity(cached, p);
      assert.ok(denied.ok, denied.ok ? "" : JSON.stringify(denied.issues));
      assert.deepEqual(denied.value.rows, []);
      assert.equal(denied.value.more, undefined);
      assert.equal(denied.value.pageError, undefined);
      assert.equal(denied.value.writable, false);
      assert.equal(denied.value.state?.kind, "error");
      assert.equal(denied.value.state?.body, p.copy.kit.unavailable);
      assert.deepEqual(denied.value.state?.actions, []);
      assert.doesNotMatch(JSON.stringify(denied.value), /Cached actor 512|note-512/);
      assert.equal(JSON.stringify(cached), before);
      assert.equal(Object.isFrozen(cached.events[0]), false);

      const readable = deriveEventActivity({ ...cached, denied: false }, p);
      assert.equal(readable.ok, false);
      assert.equal("value" in readable, false);
      assert.deepEqual(denied.value.rows, []);
    }
  }
});
