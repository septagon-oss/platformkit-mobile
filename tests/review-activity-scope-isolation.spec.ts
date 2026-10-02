import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, deriveEventActivity, type EventTrail, type Result } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result.issues));
  return result.value;
}

for (const language of ["en", "pt"] as const) {
  test(`T0180: ${language} interleaved callers with equal IDs cannot share actor enrichment`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const otherPresentation = {
      ...presentation,
      copy: deriveCopy(language === "en" ? "pt" : "en"),
      timeZone: "America/Sao_Paulo",
    };
    const trail: EventTrail = {
      events: [
        {
          id: "event-263",
          name: "note.note.updated",
          occurredAt: "2026-08-16T14:03:00Z",
          actor: "actor-263",
          payload: { id: "note-263" },
        },
      ],
      names: { "actor-263": "Caller A actor" },
      loading: false,
      loadingMore: false,
      more: false,
      error: "",
    };
    const a = value(deriveEventActivity(trail, p));
    const bInput = { ...trail, names: { "actor-263": "Caller B actor" } };
    const b = value(deriveEventActivity(bInput, otherPresentation));
    assert.equal(a.rows[0]!.actor, "Caller A actor");
    assert.equal(b.rows[0]!.actor, "Caller B actor");
    assert.equal(a.title, p.copy.kit.activity);
    assert.equal(b.title, otherPresentation.copy.kit.activity);
    assert.notEqual(a.rows[0]!.time, b.rows[0]!.time);
    const heldA = JSON.stringify(a);
    const heldB = JSON.stringify(b);

    const withdrawn = value(deriveEventActivity({ ...trail, denied: true, loading: true }, p));
    assert.deepEqual(withdrawn.rows, []);
    assert.equal(withdrawn.more, undefined);
    assert.equal(withdrawn.state?.body, p.copy.kit.unavailable);
    assert.deepEqual(withdrawn.state?.actions, []);
    assert.doesNotMatch(JSON.stringify(withdrawn), /Caller [AB] actor/);
    assert.equal(JSON.stringify(a), heldA);
    assert.equal(JSON.stringify(b), heldB);
    assert.equal(JSON.stringify(value(deriveEventActivity(bInput, otherPresentation))), heldB);

    bInput.names["actor-263"] = "Caller B fresh actor";
    const freshB = value(deriveEventActivity(bInput, otherPresentation));
    assert.equal(freshB.rows[0]!.actor, "Caller B fresh actor");
    assert.equal(b.rows[0]!.actor, "Caller B actor");
    assert.deepEqual(withdrawn.rows, []);
    assert.equal(JSON.stringify(a), heldA);
    assert.equal(Object.isFrozen(bInput.names), false);
    assert.equal(Object.isFrozen(freshB.rows[0]), true);
  });
}
