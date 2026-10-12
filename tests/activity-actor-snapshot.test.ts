// An activity row may name its actor only from the directory snapshot read with it. Once that
// snapshot is withdrawn the row says a name is unavailable — never the id it is stored under —
// and a later lookup cannot rewrite a row another caller already derived: a carried-over name
// would show a person to someone who just lost the right to see them.
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
      [p.copy.kit.nameUnavailable],
      "an unresolved person is named as such, never as the id the store keeps",
    );
    assert.match(withdrawn.value.rows[0]!.accessibleLabel, new RegExp(p.copy.kit.nameUnavailable));
    assert.doesNotMatch(JSON.stringify(withdrawn.value), /Earlier authorized actor/);
    assert.doesNotMatch(
      JSON.stringify(withdrawn.value.rows),
      /actor-217/,
      "and the id reaches no word a person reads",
    );

    const recovered = deriveEventActivity({ ...trail, names: { "actor-217": "Fresh actor" } }, p);
    assert.equal(recovered.ok, true);
    if (!recovered.ok) return;
    assert.equal(recovered.value.rows[0]?.actor, "Fresh actor");
    assert.equal(withdrawn.value.rows[0]?.actor, p.copy.kit.nameUnavailable);
    assert.equal(previous.value.rows[0]?.actor, "Earlier authorized actor");
    assert.equal(trail.names["actor-217"], "Earlier authorized actor");
    assert.equal(Object.isFrozen(trail.names), false);
  });
}
