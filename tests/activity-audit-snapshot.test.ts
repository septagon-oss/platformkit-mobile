import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveActivity,
  deriveCopy,
  deriveState,
  type ActivityInput,
  type ActivityItem,
  type Result,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result.issues));
  return result.value;
}

for (const language of ["en", "pt"] as const) {
  test(`${language} audit snapshots distinguish redaction and remove denied history`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const item: ActivityItem = {
      id: "event-73",
      verb: language === "pt" ? "Revisto" : "Reviewed",
      occurredAt: "2026-07-18T08:13:00Z",
      actor: { kind: "person", id: "actor-73", name: "Private actor 73" },
      details: "Private audit detail 73",
      changes: [
        { id: "memo", label: "Memo", before: { kind: "missing" }, after: { kind: "redacted" } },
        {
          id: "title",
          label: "Title",
          before: { kind: "value", text: "" },
          after: { kind: "value", text: "Private title 73" },
        },
      ],
      open: { id: "open", label: "Open event 73", state: "ready", tone: "plain" },
    };
    const input: ActivityInput = {
      content: { phase: "ready", refresh: "idle", value: [item] },
      page: { more: true, loading: false },
      expandedIds: [item.id],
      excluded: false,
    };
    const snapshot = value(deriveActivity(input, p));
    assert.equal(snapshot.rows[0]!.expanded, true);
    assert.equal(snapshot.rows[0]!.changes[0]!.before, p.copy.kit.missing);
    assert.equal(snapshot.rows[0]!.changes[0]!.after, p.copy.kit.redacted);
    assert.equal(snapshot.rows[0]!.changes[1]!.before, "");
    assert.equal(snapshot.rows[0]!.open!.enabled, true);
    assert.equal(Object.isFrozen(item), false);
    assert.equal(Object.isFrozen(snapshot.rows[0]!.changes), true);
    const serialized = JSON.stringify(snapshot);

    for (const code of ["forbidden", "not-found"] as const) {
      const state = value(
        deriveState(
          {
            kind: "error",
            issue: {
              code,
              path: "activity",
              recovery: "immutable",
              message: p.copy.kit.unavailable,
            },
          },
          p,
        ),
      );
      const denied = value(deriveActivity({ ...input, content: { phase: "error", state } }, p));
      assert.deepEqual(denied.rows, []);
      assert.equal(denied.writable, false);
      assert.equal(denied.more!.enabled, false);
      assert.equal(denied.state!.body, p.copy.kit.unavailable);
      for (const privateValue of [
        "Private actor 73",
        "Private audit detail 73",
        "Private title 73",
      ])
        assert.equal(JSON.stringify(denied).includes(privateValue), false);
    }

    const duplicate = deriveActivity(
      { ...input, content: { phase: "ready", refresh: "idle", value: [item, item] } },
      p,
    );
    assert.equal(duplicate.ok, false);
    assert.equal("value" in duplicate, false);
    if (duplicate.ok) throw new Error("Duplicate event ids must be refused");
    assert.equal(duplicate.issues[0]!.code, "invalid-input");
    assert.equal(duplicate.issues[0]!.recovery, "immutable");
    assert.equal(duplicate.issues[0]!.message, p.copy.issue.invalid);

    const excluded = value(deriveActivity({ ...input, excluded: true }, p));
    assert.deepEqual(excluded.rows, []);
    assert.equal(excluded.more, undefined);
    assert.equal(excluded.excluded, p.copy.kit.excluded);
    assert.equal(JSON.stringify(snapshot), serialized);
    assert.equal(value(deriveActivity(input, p)).rows[0]!.id, item.id);
  });
}
