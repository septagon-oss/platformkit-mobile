// Denied calendar content leaves every projection — day, week, agenda — with an explicit
// recovery, and each projection keeps its own bounds: an event that ended before the viewed
// day empties that day without moving the week around it.
import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCalendar,
  deriveCopy,
  deriveState,
  type CalendarEvent,
  type CalendarInput,
  type Result,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function value<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

for (const language of ["en", "pt"] as const) {
  test(`${language} calendar withdrawal clears every projection and preserves independent snapshots`, () => {
    const p = {
      ...presentation,
      copy: deriveCopy(language),
      locale: language === "pt" ? "pt-PT" : "en-GB",
      timeZone: "Europe/Lisbon",
      now: "2026-10-24T12:00:00Z",
    };
    const events: CalendarEvent[] = [
      {
        id: "first-hour",
        title: "Private appointment 31",
        kind: "timed",
        start: "2026-10-25T00:15:00Z",
        end: "2026-10-25T00:45:00Z",
        open: { id: "open-first", label: "Open", state: "ready", tone: "plain" },
      },
      {
        id: "second-hour",
        title: "Private appointment 32",
        kind: "timed",
        start: "2026-10-25T01:15:00Z",
        end: "2026-10-25T01:45:00Z",
        open: { id: "open-second", label: "Open", state: "ready", tone: "plain" },
      },
    ];
    const input: CalendarInput = {
      content: { phase: "ready", refresh: "idle", value: events },
      anchorDate: "2026-10-25",
      selectedDate: "2026-10-25",
      agendaEndDate: "2026-10-26",
      selectedEventId: "first-hour",
      view: "day",
      page: { more: true, loading: false },
    };
    const before = JSON.stringify(input);
    const original = value(deriveCalendar(input, p));
    const day = original.week.days[0]!;
    assert.equal(day.minutes, 1500);
    assert.deepEqual(
      day.events.map((event) => event.id),
      ["first-hour", "second-hour"],
    );
    assert.ok(day.ticks.some((tick) => tick.label === "01:00 +01:00"));
    assert.ok(day.ticks.some((tick) => tick.label === "01:00 +00:00"));
    assert.match(day.events[0]!.label, /01:15/);
    assert.match(day.events[1]!.label, /01:15/);
    assert.equal(day.events[1]!.start - day.events[0]!.start, 3600000);
    assert.notEqual(day.events[0]!.top, day.events[1]!.top);
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(events), false);

    for (const view of ["day", "week", "agenda"] as const) {
      for (const code of ["forbidden", "not-found"] as const) {
        const state = value(
          deriveState(
            {
              kind: "error",
              issue: {
                code,
                path: "events",
                recovery: "immutable",
                message: p.copy.kit.unavailable,
              },
            },
            p,
          ),
        );
        const denied = value(
          deriveCalendar({ ...input, view, content: { phase: "error", state } }, p),
        );
        for (const projection of [denied.calendar, denied.week, denied.agenda]) {
          assert.ok(projection.days.length > 0);
          assert.ok(projection.days.every((date) => date.events.length === 0));
          assert.equal(projection.selectionIssue?.code, "unavailable");
          assert.equal(projection.state?.kind, "error");
          assert.equal(projection.state?.body, p.copy.kit.unavailable);
          assert.deepEqual(projection.state?.actions, []);
        }
        assert.equal(denied.agenda.more?.enabled, false);
        assert.equal(JSON.stringify(denied).includes("Private appointment"), false);
        const recovered = value(deriveCalendar({ ...input, view }, p));
        assert.ok(
          recovered.week.days.some((date) => date.events.some((e) => e.id === "first-hour")),
        );
        assert.equal(recovered.calendar.selectionIssue, undefined);
      }
    }

    const invalid = deriveCalendar(
      {
        ...input,
        content: {
          phase: "ready",
          refresh: "idle",
          value: [events[0]!, { ...events[1]!, id: "first-hour" }],
        },
      },
      p,
    );
    assert.equal(invalid.ok, false);
    assert.equal("value" in invalid, false);
    if (!invalid.ok) {
      assert.equal(invalid.issues[0]!.code, "invalid-input");
      assert.equal(invalid.issues[0]!.recovery, "immutable");
      assert.equal(invalid.issues[0]!.message, p.copy.issue.invalid);
    }
    events[0] = { ...events[0]!, title: "A later caller draft" };
    assert.equal(day.events[0]!.title, "Private appointment 31");
    assert.ok(Object.isFrozen(day.events[0]));
    assert.equal(
      value(deriveCalendar(input, p)).week.days[0]!.events[0]!.title,
      "A later caller draft",
    );
  });
}

test("an event that ended before the viewed day leaves that day empty without moving its bounds", () => {
  const day = value(
    deriveCalendar(
      {
        content: {
          phase: "ready",
          refresh: "idle",
          value: [
            {
              id: "ended",
              title: "Previous day",
              kind: "timed",
              start: "2026-11-01T02:00:00Z",
              end: "2026-11-01T04:00:00Z",
            },
          ],
        },
        view: "day",
        anchorDate: "2026-11-01",
        selectedDate: "2026-11-01",
        agendaEndDate: "2026-11-02",
      },
      { ...presentation, now: "2026-10-31T18:00:00Z", timeZone: "America/New_York" },
    ),
  ).week.days[0]!;
  // The overnight event belongs to the previous civil day, so the viewed day
  // keeps its full length and shows nothing rather than a clipped bar.
  assert.equal(day.minutes, 1500);
  assert.equal(day.events.length, 0);
});
