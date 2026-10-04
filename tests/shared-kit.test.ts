import assert from "node:assert/strict";
import test from "node:test";
import * as d from "../src/core/derive";
import { presentation as p } from "./fakes/presentation";
const ready = <T>(value: T): d.Content<T> => ({ phase: "ready", value, refresh: "idle" });
const ok = <T>(result: d.Result<T>): T => {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
};
const refused = <T>(result: d.Result<T>, code: string) => {
  assert.equal(result.ok, false);
  assert.equal("value" in result, false);
  if (!result.ok) assert.equal(result.issues[0]!.code, code);
};
const action: d.Action = { id: "go", label: "Continue", tone: "primary", state: "ready" };
const currency = { code: "EUR", fractionDigits: 2 };
const money = (minor: string): d.Money => ({ minor, currency });

test("loaded selection is ordered, deduplicated, and lost targets disable bulk actions", () => {
  const row = (id: string, selectable = true): d.DataRow => ({
    id,
    title: id,
    cells: [],
    selectable,
    actions: [],
  });
  const input: d.DataListInput = {
    content: ready([
      {
        id: "a",
        title: "First",
        rows: [row("nine"), row("two", false)],
        collapsible: false,
        total: 8,
      },
      { id: "b", title: "Second", rows: [row("six")], collapsible: false },
    ]),
    order: { sort: "", filters: {} },
    filters: [],
    views: [],
    viewDirty: false,
    selection: "multiple",
    selectedIds: ["six", "nine", "six"],
    collapsedIds: [],
    bulkActions: [action],
    page: { more: false, loading: false },
  };
  const before = JSON.stringify(input),
    model = ok(d.deriveDataList(input, p));
  assert.deepEqual(model.selectedIds, ["nine", "six"]);
  assert.match(model.sections[0]!.count, /2.*8/);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(model.sections[0]!.rows), true);
  const lost = ok(d.deriveDataList({ ...input, selectedIds: ["nine", "removed"] }, p));
  assert.equal(lost.selectionIssue?.code, "unavailable");
  assert.equal(lost.bulk.actions[0]!.enabled, false);
  refused(
    d.deriveDataList(
      {
        ...input,
        content: ready([
          { id: "g", title: "Group", rows: [row("same"), row("same")], collapsible: false },
        ]),
      },
      p,
    ),
    "invalid-input",
  );
});

test("step validation advances once, editing invalidates later completion, required skip refuses", () => {
  const steps: d.Step[] = [
    { id: "a", label: "A", optional: false, completion: "complete", problems: [] },
    { id: "b", label: "B", optional: true, completion: "incomplete", problems: [] },
    { id: "c", label: "C", optional: false, completion: "incomplete", problems: [] },
  ];
  const input: d.StepperInput = {
    steps,
    currentId: "b",
    phase: "validating",
    finish: action,
    dirty: true,
  };
  const fail = ok(
    d.stepTransition(
      input,
      { kind: "validated", problems: [{ fieldId: "field", message: "Required" }] },
      p,
    ),
  );
  assert.equal(fail.currentId, "b");
  assert.equal(fail.steps[1]!.problems.length, 1);
  const pass = ok(d.stepTransition(input, { kind: "validated", problems: [] }, p));
  assert.equal(pass.currentId, "c");
  assert.equal(pass.steps[1]!.completion, "complete");
  const edit = ok(
    d.stepTransition({ ...input, ...pass, phase: "editing" }, { kind: "edited", stepId: "a" }, p),
  );
  assert.ok(edit.steps.every((step) => step.completion === "incomplete"));
  refused(
    d.stepTransition({ ...input, currentId: "a", phase: "editing" }, { kind: "skip" }, p),
    "validation",
  );
  refused(d.stepTransition({ ...input, phase: "write-unknown" }, { kind: "back" }, p), "busy");
  assert.equal(
    ok(
      d.deriveStepper(
        { ...input, steps: [], currentId: undefined } as unknown as d.StepperInput,
        p,
      ),
    ).finish,
    undefined,
  );
});

test("slot eligibility checks exact expiry, quantity, counts and selected snapshot", () => {
  const q = { ...p, now: "2027-01-08T08:00:00Z" };
  const slot: d.Slot = {
    id: "am",
    start: "2027-01-08T09:00:00Z",
    end: "2027-01-08T09:30:00Z",
    state: "open",
    capacity: { kind: "known", total: 4, remaining: 2 },
  };
  const input: d.SlotPickerInput = {
    content: ready({
      slots: [slot],
      availabilityVersion: "revision-seven",
      validUntil: "2027-01-08T08:15:00Z",
    }),
    dates: ["2027-01-08"],
    selectedDate: "2027-01-08",
    selectedSlotId: "am",
    quantity: 2,
  };
  const model = ok(d.deriveSlots(input, q));
  assert.equal(model.slots[0]!.enabled, true);
  assert.deepEqual(model.slots[0]!.target, {
    slotId: "am",
    availabilityVersion: "revision-seven",
    quantity: 2,
  });
  assert.equal(ok(d.deriveSlots({ ...input, quantity: 3 }, q)).selectionIssue?.code, "unavailable");
  assert.equal(
    ok(d.deriveSlots(input, { ...q, now: "2027-01-08T08:15:00Z" })).slots[0]!.enabled,
    false,
  );
  refused(
    d.deriveSlots(
      {
        ...input,
        content: ready({
          slots: [{ ...slot, capacity: { kind: "known", total: 2, remaining: 3 } }],
          availabilityVersion: "v",
          validUntil: "2027-01-08T08:15:00Z",
        }),
      },
      q,
    ),
    "invalid-input",
  );
});

test("calendar follows DST and half-open boundaries; adjacent events share a lane", () => {
  const q = { ...p, timeZone: "Europe/Lisbon" };
  const input = (date: string, events: readonly d.CalendarEvent[] = []): d.CalendarInput => ({
    content: ready(events),
    view: "day",
    anchorDate: date,
    selectedDate: date,
    agendaEndDate: date.slice(0, 8) + "30",
  });
  assert.equal(ok(d.deriveCalendar(input("2026-03-29"), q)).week.days[0]!.minutes, 1380);
  const autumn = ok(d.deriveCalendar(input("2026-10-25"), q)).week.days[0]!;
  assert.equal(autumn.minutes, 1500);
  assert.ok(autumn.ticks.some((t) => t.label === "01:00 +01:00"));
  assert.ok(autumn.ticks.some((t) => t.label === "01:00 +00:00"));
  const e = (id: string, start: string, end: string): d.CalendarEvent => ({
    id,
    title: id,
    kind: "timed",
    start: `2026-03-28T${start}:00Z`,
    end: `2026-03-28T${end}:00Z`,
    open: action,
  });
  const events = ok(
    d.deriveCalendar(
      input("2026-03-28", [
        e("a", "09:00", "10:00"),
        e("b", "10:00", "11:00"),
        e("c", "09:30", "10:30"),
      ]),
      q,
    ),
  ).week.days[0]!.events;
  assert.equal(events[0]!.lane, events[2]!.lane);
  assert.equal(events[1]!.lane, 1);
  assert.ok(events.every((e) => e.lanes === 2));
  const midnight: d.CalendarEvent = {
    id: "midnight",
    title: "M",
    kind: "timed",
    start: "2026-03-28T23:00:00Z",
    end: "2026-03-29T00:00:00Z",
  };
  assert.equal(
    ok(d.deriveCalendar(input("2026-03-29", [midnight]), q)).week.days[0]!.events.length,
    0,
  );
});

test("money is exact beyond Number, cancelling adjustments are order-independent, malformed money refuses", () => {
  const input = {
    currency,
    lines: [{ id: "a", unitPrice: money("9007199254740993"), quantity: 1 }],
    adjustments: [{ id: "plus", label: "Plus", amount: money("1") }],
  };
  assert.equal(ok(d.cartTotals(input)).total.minor, "9007199254740994");
  const adjustments = [
    { id: "a", label: "A", amount: money("9223372036854775807") },
    { id: "b", label: "B", amount: money("1") },
    { id: "c", label: "C", amount: money("-9223372036854775807") },
  ];
  assert.equal(ok(d.cartTotals({ currency, lines: [], adjustments })).total.minor, "1");
  // An empty cart is a readable cart: its total is "0", not a refusal and not a
  // missing field a renderer would have to invent.
  assert.equal(ok(d.cartTotals({ currency, lines: [], adjustments: [] })).total.minor, "0");
  const priced = ok(
    d.cartTotals({
      currency,
      lines: [
        { id: "first", unitPrice: money("319"), quantity: 2 },
        { id: "second", unitPrice: money("1249"), quantity: 3 },
      ],
      adjustments: [
        { id: "credit", label: "Credit", amount: money("-400") },
        { id: "charge", label: "Charge", amount: money("125") },
      ],
    }),
  );
  assert.equal(priced.subtotal.minor, "4385");
  assert.equal(priced.total.minor, "4110");
  // A line's own multiplication can overflow as well: the whole computation
  // refuses rather than publishing a partial total somebody could charge.
  const lineOverflow = d.cartTotals({
    currency,
    lines: [{ id: "large", unitPrice: money("9223372036854775807"), quantity: 2 }],
    adjustments: [],
  });
  assert.equal(lineOverflow.ok, false);
  assert.equal("value" in lineOverflow, false);
  if (!lineOverflow.ok)
    assert.ok(
      lineOverflow.issues.some(
        (issue) => issue.code === "invalid-input" && issue.recovery === "immutable",
      ),
    );
  assert.deepEqual(
    d.cartTotals({ currency, lines: [], adjustments }),
    d.cartTotals({ currency, lines: [], adjustments: [...adjustments].reverse() }),
  );
  for (const minor of ["-0", "01", "1e3", "1.2"])
    refused(
      d.cartTotals({ ...input, lines: [{ id: "a", unitPrice: money(minor), quantity: 1 }] }),
      "invalid-input",
    );
  assert.match(
    ok(d.derivePrice({ amount: money("9007199254740993"), kind: "price" }, p)).text,
    /90,071,992,547,409\.93/,
  );
  refused(
    d.deriveSummary(
      {
        currency,
        kind: "quote",
        lines: [{ id: "l", label: "L", amount: money("125") }],
        adjustments: [],
        quote: { id: "q", revision: "v", expiresAt: "2030-01-01T00:00:00Z", total: money("126") },
      },
      p,
    ),
    "invalid-input",
  );
});

test("map disambiguates exact coordinates, preserves all points, and refuses invalid coordinates", () => {
  const status: d.Status = { label: "Available", tone: "ok", symbol: "check" };
  const point = (id: string): d.MapPoint => ({
    id,
    title: id,
    longitude: 0,
    latitude: 0,
    status,
    actions: [],
  });
  const input: d.MapInput = {
    content: ready([point("z"), point("a")]),
    mode: "map",
    viewport: { longitude: 1, latitude: 2, zoom: 4 },
    legend: [status],
    capabilities: { latitudeBounds: [-85, 85], zoomBounds: [0, 22] },
    providerState: "ready",
    attribution: "Fixture",
  };
  const model = ok(d.deriveMap(input, p)).map;
  assert.equal(model.rows.length, 2);
  assert.equal(model.markers.length, 1);
  assert.equal(model.markers[0]!.id, "a");
  assert.deepEqual(model.markers[0]!.ids, ["z", "a"]);
  refused(
    d.deriveMap({ ...input, content: ready([{ ...point("bad"), latitude: NaN }]) }, p),
    "invalid-input",
  );
  assert.deepEqual(
    ok(d.deriveMap({ ...input, content: ready([]) }, p)).map.viewport,
    input.viewport,
  );
});

test("media removal never reassigns the viewer and invalid dimensions refuse", () => {
  const item: d.MediaItem = {
    id: "portrait",
    width: 600,
    height: 900,
    description: "Portrait",
    decorative: false,
    state: "ready",
  };
  const input: d.MediaInput = {
    content: ready([item]),
    selectedId: "removed",
    page: { more: false, loading: false },
  };
  const viewer = ok(d.deriveViewer({ ...input, open: true }, p));
  assert.equal(viewer.selected, undefined);
  assert.equal(viewer.selectionIssue?.code, "unavailable");
  assert.equal(
    ok(d.deriveMedia({ ...input, selectedId: "portrait" }, p)).items[0]!.aspectRatio,
    2 / 3,
  );
  refused(d.deriveMedia({ ...input, content: ready([{ ...item, width: 0 }]) }, p), "invalid-input");
});

test("viewer selection survives image load states while thumbnail opening still requires ready media", () => {
  const item: d.MediaItem = {
    id: "arch",
    width: 700,
    height: 1000,
    description: "Stone arch",
    decorative: false,
    state: "ready",
  };
  const input: d.MediaInput = {
    content: ready([item]),
    selectedId: item.id,
    page: { more: false, loading: false },
  };
  for (const state of ["ready", "loading", "error", "unavailable"] as const) {
    const current = { ...input, content: ready([{ ...item, state }]) };
    const thumbnail = ok(d.deriveMedia(current, p)).items[0]!;
    assert.equal(thumbnail.canOpen, state === "ready");
    const viewer = ok(d.deriveViewer({ ...current, open: true }, p));
    assert.equal(viewer.selected?.id, "arch");
    assert.equal(viewer.selected?.state, state);
    assert.equal(viewer.selectionIssue, undefined);
    assert.equal(viewer.selected?.canRetry, state === "error" || state === "unavailable");
  }
});

test("chart gaps remain disconnected, missing is not zero, hidden data domains refuse", () => {
  const input: d.ChartInput = {
    content: ready([
      {
        id: "one",
        label: "One",
        tone: "info",
        points: [
          { id: "a", x: 0, y: 2 },
          { id: "b", x: 1, y: null },
          { id: "c", x: 2, y: 3 },
        ],
      },
    ]),
    xKind: "number",
    xLabel: "Time",
    yLabel: "Count",
    unitLabel: "items",
    fractionDigits: 0,
    ranges: [],
  };
  const result = ok(d.deriveChart(input, p));
  assert.equal(result.series[0]!.segments.length, 2);
  assert.equal(result.series[0]!.points[1]!.py, undefined);
  assert.deepEqual(result.yDomain, [0, 3]);
  refused(d.deriveChart({ ...input, domain: { x: [0, 1], y: [0, 3] } }, p), "invalid-input");
  const stat = ok(
    d.deriveStat(
      { label: "Latency", value: 90, comparison: 120, fractionDigits: 0, preference: "lower" },
      p,
    ),
  );
  assert.equal(stat.delta, "-30");
  assert.equal(stat.percent, "-25.0%");
  assert.equal(stat.tone, "ok");
  assert.equal(
    ok(
      d.deriveStat(
        { label: "Zero", value: 0, comparison: 0, fractionDigits: 0, preference: "neutral" },
        p,
      ),
    ).percent,
    p.copy.kit.noBaseline,
  );
});

test("all literal examples derive in both languages with explicit locale and timezone", () => {
  for (const language of ["en", "pt"] as const)
    for (const id of d.kitCaseIds) {
      const result = d.kitExamples(
        {
          ...p,
          copy: d.deriveCopy(language),
          locale: language === "pt" ? "pt-PT" : "en-GB",
          timeZone: "Europe/Lisbon",
        },
        id,
      );
      assert.ok(result.ok, `${id}: ${result.ok ? "" : JSON.stringify(result.issues)}`);
    }
});

test("comparison preserves feature and plan order, names unknowns, and uses the same offers", () => {
  const plans: d.Plan[] = [
    {
      id: "team",
      title: "Team",
      features: { storage: { kind: "included" }, support: { kind: "text", text: "Weekdays" } },
      offers: [{ periodId: "year", price: { kind: "price", amount: money("2500") }, action }],
    },
    { id: "solo", title: "Solo", features: { storage: { kind: "excluded" } }, offers: [] },
  ];
  const model = ok(
    d.derivePricing(
      {
        content: ready(plans),
        periods: [{ id: "year", label: "Annual" }],
        selectedPeriodId: "year",
        features: [
          { id: "support", label: "Support" },
          { id: "storage", label: "Storage" },
        ],
      },
      p,
    ),
  );
  assert.deepEqual(
    model.comparison.features.map((f) => f.id),
    ["support", "storage"],
  );
  assert.deepEqual(
    model.comparison.features[0]!.values.map((v) => v.accessibleLabel),
    ["Support, Team: Weekdays", "Support, Solo: Unknown"],
  );
  assert.deepEqual(
    model.tiers.plans.map((p) => p.offer),
    model.comparison.plans.map((p) => p.offer),
  );
  assert.equal(model.comparison.plans[1]!.enabled, false);
});

test("short adjacent calendar events share a reachable group without overlapping targets", () => {
  const model = ok(
    d.deriveCalendar(
      {
        content: ready([
          {
            id: "first",
            title: "First",
            kind: "timed",
            start: "2027-01-08T09:00:00Z",
            end: "2027-01-08T09:01:00Z",
            open: action,
          },
          {
            id: "next",
            title: "Next",
            kind: "timed",
            start: "2027-01-08T09:02:00Z",
            end: "2027-01-08T09:03:00Z",
            open: action,
          },
          {
            id: "later",
            title: "Later",
            kind: "timed",
            start: "2027-01-08T15:00:00Z",
            end: "2027-01-08T16:00:00Z",
            open: action,
          },
        ]),
        view: "day",
        anchorDate: "2027-01-08",
        selectedDate: "2027-01-08",
        agendaEndDate: "2027-01-09",
      },
      { ...p, timeZone: "UTC" },
    ),
  );
  const groups = d.calendarTargets(model.week.days[0]!, 1440, 44);
  assert.deepEqual(
    groups.map((g) => g.eventIds),
    [["first", "next"], ["later"]],
  );
  assert.equal(groups[0]!.grouped, true);
  assert.equal(groups[1]!.grouped, false);
  assert.equal(model.strip.navigation.next.target.selectedDate, "2027-01-15");
  assert.equal(model.calendar.navigation.next.target.selectedDate, "2027-01-09");
});

test("chart refresh retains values but blocks range changes and rejects empty invalid domains", () => {
  const input: d.ChartInput = {
    content: {
      phase: "ready",
      value: [{ id: "s", label: "Measured", tone: "info", points: [{ id: "p", x: 1, y: 8 }] }],
      refresh: "loading",
    },
    xKind: "number",
    xLabel: "Sample",
    yLabel: "Count",
    unitLabel: "items",
    fractionDigits: 0,
    ranges: [{ id: "all", label: "All" }],
    selectedRangeId: "all",
  };
  const model = ok(d.deriveChart(input, p));
  assert.equal(model.series[0]!.points[0]!.text, "8 items");
  assert.equal(model.ranges.choices[0]!.enabled, false);
  refused(
    d.deriveChart({ ...input, content: ready([]), domain: { x: [2, 1], y: [0, 10] } }, p),
    "invalid-input",
  );
});

test("calendar retains parallel lanes while they fit, and groups them when the columns are too narrow", () => {
  const model = ok(
    d.deriveCalendar(
      {
        content: ready([
          {
            id: "a",
            title: "A",
            kind: "timed",
            start: "2027-01-08T09:00:00Z",
            end: "2027-01-08T12:00:00Z",
            open: action,
          },
          {
            id: "b",
            title: "B",
            kind: "timed",
            start: "2027-01-08T10:00:00Z",
            end: "2027-01-08T13:00:00Z",
            open: action,
          },
        ]),
        view: "day",
        anchorDate: "2027-01-08",
        selectedDate: "2027-01-08",
        agendaEndDate: "2027-01-09",
      },
      { ...p, timeZone: "UTC" },
    ),
  );
  assert.equal(d.calendarTargets(model.week.days[0]!, 1440, 44, 240)[0]!.grouped, false);
  assert.equal(d.calendarTargets(model.week.days[0]!, 1440, 44, 60)[0]!.grouped, true);
});

test("a series with no values in the domain and gaps keeps its bounds and splits its segments", () => {
  // A negative minimum is what a chart of changes needs: rescaling to zero would
  // draw a fall as a rise. A null is a missing sample, so the line breaks there
  // instead of drawing a straight segment through the gap.
  const chart = ok(
    d.deriveChart(
      {
        content: ready([
          {
            id: "visits",
            label: "Visits",
            tone: "info",
            points: [
              { id: "one", x: 11, y: -7 },
              { id: "two", x: 13, y: null },
              { id: "three", x: 19, y: 4 },
            ],
          },
        ]),
        xKind: "number",
        xLabel: "Sample",
        yLabel: "Change",
        unitLabel: "items",
        fractionDigits: 0,
        ranges: [],
      },
      p,
    ),
  );
  assert.deepEqual(chart.yDomain, [-7, 4]);
  assert.equal(chart.series[0]!.segments.length, 2);
  assert.equal(chart.series[0]!.points[1]!.py, undefined);
});
