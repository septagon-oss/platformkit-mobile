import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, deriveEventActivity, type EventTrail } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

for (const language of ["en", "pt"] as const) {
  test(`${language} actor enrichment belongs only to its supplied directory snapshot`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const trail: EventTrail = {
      events: [
        {
          id: "event-217",
          name: "note.note.updated",
          occurredAt: "2026-08-12T09:00:00Z",
          actor: "actor-217",
          payload: { id: "note-217" },
        },
      ],
      names: { "actor-217": "Earlier authorized actor" },
      loading: false,
      loadingMore: false,
      more: false,
      error: "",
    };
    const previous = deriveEventActivity(trail, p);
    assert.equal(previous.ok, true);
    if (!previous.ok) return;
    assert.equal(previous.value.rows[0]?.actor, "Earlier authorized actor");

    const withdrawn = deriveEventActivity(
      { ...trail, names: {}, error: p.copy.kit.unavailable },
      p,
    );
    assert.equal(withdrawn.ok, true);
    if (!withdrawn.ok) return;
    assert.deepEqual(
      withdrawn.value.rows.map((row) => row.actor),
      ["actor-217"],
    );
    assert.match(withdrawn.value.rows[0]!.accessibleLabel, /actor-217/);
    assert.doesNotMatch(JSON.stringify(withdrawn.value), /Earlier authorized actor/);

    const recovered = deriveEventActivity({ ...trail, names: { "actor-217": "Fresh actor" } }, p);
    assert.equal(recovered.ok, true);
    if (!recovered.ok) return;
    assert.equal(recovered.value.rows[0]?.actor, "Fresh actor");
    assert.equal(withdrawn.value.rows[0]?.actor, "actor-217");
    assert.equal(previous.value.rows[0]?.actor, "Earlier authorized actor");
    assert.equal(trail.names["actor-217"], "Earlier authorized actor");
    assert.equal(Object.isFrozen(trail.names), false);
  });
}
