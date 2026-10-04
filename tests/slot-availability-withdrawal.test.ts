import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCopy,
  deriveSlots,
  deriveState,
  type Availability,
  type Content,
  type Result,
  type SlotPickerInput,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function ok<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

test("withdrawn availability never reuses a selected snapshot, and recovery echoes its new version", () => {
  for (const language of ["en", "pt"] as const) {
    const p = {
      ...presentation,
      copy: deriveCopy(language),
      now: "2027-02-11T08:45:00Z",
    };
    const snapshot: Availability = {
      availabilityVersion: "availability-27",
      validUntil: "2027-02-11T09:00:00Z",
      slots: [
        {
          id: "morning",
          start: "2027-02-11T10:15:00Z",
          end: "2027-02-11T10:45:00Z",
          state: "open",
          capacity: { kind: "known", total: 8, remaining: 3 },
        },
      ],
    };
    const input: SlotPickerInput = {
      content: { phase: "ready", refresh: "idle", value: snapshot },
      dates: ["2027-02-11"],
      selectedDate: "2027-02-11",
      selectedSlotId: "morning",
      quantity: 3,
    };
    const original = JSON.stringify(input);
    const selected = ok(deriveSlots(input, p));
    assert.equal(selected.slots[0]!.id, "morning");
    assert.equal(selected.slots[0]!.enabled, true);
    assert.equal(selected.selectionIssue, undefined);
    assert.deepEqual(selected.slots[0]!.target, {
      slotId: "morning",
      availabilityVersion: "availability-27",
      quantity: 3,
    });

    for (const code of ["forbidden", "not-found"] as const) {
      const state = ok(
        deriveState(
          {
            kind: "error",
            issue: { code, path: "slots", recovery: "immutable", message: p.copy.kit.unavailable },
          },
          p,
        ),
      );
      const withdrawn = ok(deriveSlots({ ...input, content: { phase: "error", state } }, p));
      assert.deepEqual(withdrawn.slots, []);
      assert.equal(withdrawn.writable, false);
      assert.equal(withdrawn.selectionIssue?.code, "unavailable");
      assert.equal(withdrawn.selectionIssue?.message, p.copy.kit.unavailable);
    }

    const exhausted: Content<Availability> = {
      phase: "ready",
      refresh: "idle",
      value: {
        ...snapshot,
        availabilityVersion: "availability-28",
        slots: snapshot.slots.map((slot) => ({
          ...slot,
          capacity: { kind: "known", total: 8, remaining: 2 },
        })),
      },
    };
    const unavailable = ok(deriveSlots({ ...input, content: exhausted }, p));
    assert.equal(unavailable.slots[0]!.id, "morning");
    assert.equal(unavailable.slots[0]!.enabled, false);
    assert.equal(unavailable.slots[0]!.reason, p.copy.kit.full);
    assert.equal(unavailable.selectionIssue?.code, "unavailable");
    const expired = ok(deriveSlots(input, { ...p, now: snapshot.validUntil }));
    assert.equal(expired.slots[0]!.enabled, false);
    assert.equal(expired.slots[0]!.reason, p.copy.kit.expired);

    const recovered = ok(deriveSlots({ ...input, content: exhausted, quantity: 2 }, p));
    assert.equal(recovered.slots[0]!.enabled, true);
    assert.equal(recovered.selectionIssue, undefined);
    assert.deepEqual(recovered.slots[0]!.target, {
      slotId: "morning",
      availabilityVersion: "availability-28",
      quantity: 2,
    });
    assert.equal(selected.slots[0]!.enabled, true);
    assert.equal(selected.slots[0]!.target.availabilityVersion, "availability-27");
    assert.ok(Object.isFrozen(recovered.slots[0]!.target));
    assert.equal(Object.isFrozen(snapshot.slots[0]), false);
    assert.equal(JSON.stringify(input), original);
  }
});

test("a repeated civil time keeps its own offset and a slot over capacity cannot be selected", () => {
  const input: SlotPickerInput = {
    content: {
      phase: "ready",
      refresh: "idle",
      value: {
        availabilityVersion: "read-17",
        validUntil: "2026-11-01T04:00:00Z",
        slots: [
          {
            id: "early",
            start: "2026-11-01T05:15:00Z",
            end: "2026-11-01T05:45:00Z",
            state: "open",
            capacity: { kind: "known", total: 7, remaining: 3 },
          },
          {
            id: "late",
            start: "2026-11-01T06:15:00Z",
            end: "2026-11-01T06:45:00Z",
            state: "open",
            capacity: { kind: "known", total: 7, remaining: 2 },
          },
        ],
      },
    },
    dates: ["2026-11-01"],
    selectedDate: "2026-11-01",
    selectedSlotId: "late",
    quantity: 3,
  };
  // The two slots are the same civil hour either side of a DST change; the label
  // and the target must say which one the caller picked, so the zone offset of
  // each row is part of what the model returns, not something a renderer infers.
  // Each row reads in the caller's zone, so both offsets come from the same
  // civil hour across a DST change rather than from the device's own zone.
  const model = ok(deriveSlots(input, { ...presentation, timeZone: "America/New_York" }));
  assert.deepEqual(
    model.slots.map((slot) => slot.offset),
    ["-04:00", "-05:00"],
  );
  assert.deepEqual(
    model.slots.map((slot) => slot.enabled),
    [true, false],
  );
  assert.equal(model.selectionIssue?.code, "unavailable");
  assert.deepEqual(model.slots[0]!.target, {
    slotId: "early",
    availabilityVersion: "read-17",
    quantity: 3,
  });
});
