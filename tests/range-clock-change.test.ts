import assert from "node:assert/strict";
import test from "node:test";
import { deriveCalendar, deriveSlots, type Result } from "../src/core/derive";
import { presentedRange } from "../src/core/presentation";
import { presentation } from "./fakes/presentation";

const p = {
  ...presentation,
  timeZone: "America/New_York",
  now: "2026-10-31T12:00:00Z",
};
const start = "2026-11-01T05:30:00Z";
const end = "2026-11-01T06:45:00Z";
const ok = <T>(result: Result<T>): T => {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
};

function zone(at: string): string {
  return new Intl.DateTimeFormat(p.locale, {
    timeZone: p.timeZone,
    hour: "numeric",
    timeZoneName: "short",
  })
    .formatToParts(new Date(at))
    .find((part) => part.type === "timeZoneName")!.value;
}

function assertBothZones(label: string) {
  const first = zone(start);
  const last = zone(end);
  assert.notEqual(first, last, "the chosen interval crosses the clock change");
  assert.ok(label.includes(first), `the starting clock must name ${first}: ${label}`);
  assert.ok(label.includes(last), `the ending clock must name ${last}: ${label}`);
}

test("a booking slot crossing the clock change names both endpoint zones", () => {
  const model = ok(
    deriveSlots(
      {
        content: {
          phase: "ready",
          refresh: "idle",
          value: {
            availabilityVersion: "availability-a",
            validUntil: "2026-11-01T04:00:00Z",
            slots: [
              {
                id: "crossing",
                start,
                end,
                state: "open",
                capacity: { kind: "known", total: 4, remaining: 4 },
              },
            ],
          },
        },
        dates: ["2026-11-01"],
        selectedDate: "2026-11-01",
        quantity: 1,
      },
      p,
    ),
  );
  const slot = model.slots.find((row) => row.id === "crossing")!;
  assert.ok(slot.enabled, "a fresh available slot reaches the person's chooser");
  assert.equal((Date.parse(end) - Date.parse(start)) / 60000, 75);
  assertBothZones(slot.label);
  assertBothZones(slot.displayLabel);
});

test("a calendar event crossing the clock change names both endpoint zones", () => {
  const model = ok(
    deriveCalendar(
      {
        content: {
          phase: "ready",
          refresh: "idle",
          value: [{ id: "visit", title: "Visit", kind: "timed", start, end }],
        },
        view: "day",
        anchorDate: "2026-11-01",
        selectedDate: "2026-11-01",
        agendaEndDate: "2026-11-02",
      },
      p,
    ),
  );
  const event = model.calendar.days.flatMap((day) => day.events).find((row) => row.id === "visit")!;
  assert.ok(event, "the supplied event reaches the selected calendar day");
  assertBothZones(event.label);
});

test("a range with unchanged endpoint zones names its zone once", () => {
  const finish = "2026-11-01T05:45:00Z";
  assert.equal(zone(start), zone(finish));
  const label = presentedRange(new Date(start), new Date(finish), p);
  assert.equal(label.split(zone(start)).length - 1, 1, label);
});
