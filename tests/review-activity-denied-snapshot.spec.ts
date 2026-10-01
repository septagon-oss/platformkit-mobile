import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, deriveEventActivity } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

for (const language of ["en", "pt"] as const) {
  test(`T0180: ${language} denial withdraws a cached trail before validating or formatting it`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const cached = {
      events: [
        {
          id: "event-203",
          name: "note.note.updated",
          occurredAt: "not-an-instant",
          actor: "actor-203",
          payload: { id: "note-203" },
        },
      ],
      names: { "actor-203": "Withdrawn actor" },
      loading: true,
      loadingMore: true,
      more: true,
      error: "",
      denied: true,
    };
    const before = JSON.stringify(cached);
    const result = deriveEventActivity(cached, p);
    assert.equal(result.ok, true, "withdrawn cached data is not a new readable snapshot");
    if (!result.ok) return;
    assert.deepEqual(result.value.rows, []);
    assert.equal(result.value.more, undefined);
    assert.equal(result.value.pageError, undefined);
    assert.equal(result.value.state?.body, p.copy.kit.unavailable);
    assert.deepEqual(result.value.state?.actions, []);
    assert.equal(JSON.stringify(result.value).includes("Withdrawn actor"), false);
    assert.equal(JSON.stringify(cached), before);
    assert.equal(Object.isFrozen(cached.events[0]), false);

    const malformed = deriveEventActivity({ ...cached, denied: false }, p);
    assert.equal(malformed.ok, false, "readable timestamps still require validation");
    assert.equal("value" in malformed, false);

    // Only explicit new input can make history readable again. The previously
    // returned denial stays detached after the caller changes its own draft.
    cached.events[0]!.occurredAt = "2026-08-04T11:00:00Z";
    cached.names["actor-203"] = "Fresh actor";
    const recovered = deriveEventActivity(
      { ...cached, denied: false, loading: false, loadingMore: false },
      p,
    );
    assert.equal(recovered.ok, true);
    if (recovered.ok) assert.equal(recovered.value.rows[0]?.actor, "Fresh actor");
    assert.deepEqual(result.value.rows, []);
    assert.equal(result.value.state?.body, p.copy.kit.unavailable);
  });
}
