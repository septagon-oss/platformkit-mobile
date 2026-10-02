import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCalendar,
  deriveCart,
  deriveChart,
  deriveCopy,
  deriveDataList,
  deriveMap,
  deriveSlots,
  deriveStepper,
  stepTransition,
  type Action,
  type CartInput,
  type Content,
  type DataListInput,
  type Result,
  type SlotPickerInput,
  type StepperInput,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const ready = <T>(value: T): Content<T> => ({ phase: "ready", value, refresh: "idle" });
const action: Action = { id: "confirm", label: "Confirm", tone: "primary", state: "ready" };
const p = { ...presentation, now: "2026-10-31T18:00:00Z", timeZone: "America/New_York" };

function ok<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

test("T0180: repeated civil times retain distinct availability identities and insufficient capacity refuses selection", () => {
  const input: SlotPickerInput = {
    content: ready({
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
    }),
    dates: ["2026-11-01"],
    selectedDate: "2026-11-01",
    selectedSlotId: "late",
    quantity: 3,
  };
  const before = JSON.stringify(input);
  const model = ok(deriveSlots(input, p));
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
  assert.equal(JSON.stringify(input), before);
});

test("T0180: expired and busy quotes cannot expose checkout while a fresh quote echoes its revision", () => {
  const currency = { code: "BRL", fractionDigits: 2 };
  const input: CartInput = {
    currency,
    content: ready([
      {
        id: "line-a",
        productId: "item-a",
        title: "Sample",
        availability: "available",
        unitPrice: { minor: "1703", currency },
        quantity: { label: "Count", value: 3, min: 1, max: 5, step: 1, state: "ready" },
      },
    ]),
    adjustments: [{ id: "discount", label: "Discount", amount: { minor: "-109", currency } }],
    quote: {
      id: "quote-a",
      revision: "rev-8",
      expiresAt: "2026-10-31T18:00:00Z",
      total: { minor: "5000", currency },
    },
    checkout: action,
  };
  const expired = ok(deriveCart(input, p)).cart!;
  assert.equal(expired.checkout.enabled, false);
  assert.equal(expired.target, undefined);
  const fresh = ok(deriveCart(input, { ...p, now: "2026-10-31T17:59:59Z" })).cart!;
  assert.equal(fresh.checkout.enabled, true);
  assert.deepEqual(fresh.target, { quoteId: "quote-a", revision: "rev-8" });
  const busy = ok(
    deriveCart(
      { ...input, checkout: { ...action, state: "busy" } },
      { ...p, now: "2026-10-31T17:59:59Z" },
    ),
  ).cart!;
  assert.equal(busy.checkout.enabled, false);
});

test("T0180: uncertain step writes expose reconciliation and refuse navigation without mutating the draft", () => {
  const input: StepperInput = {
    steps: [
      { id: "a", label: "Identity", optional: false, completion: "complete", problems: [] },
      { id: "b", label: "Details", optional: false, completion: "incomplete", problems: [] },
    ],
    currentId: "b",
    phase: "write-unknown",
    finish: action,
    saveAndExit: { ...action, id: "save" },
    dirty: true,
  };
  const pt = { ...p, copy: deriveCopy("pt"), locale: "pt-BR" };
  const before = JSON.stringify(input);
  const model = ok(deriveStepper(input, pt));
  assert.equal(model.finish?.enabled, false);
  assert.equal(model.saveAndExit?.enabled, false);
  assert.equal(model.reconcile?.enabled, true);
  const result = stepTransition(input, { kind: "back" }, pt);
  assert.equal(result.ok, false);
  assert.equal("value" in result, false);
  if (!result.ok) {
    assert.equal(result.issues[0]!.code, "busy");
    assert.equal(result.issues[0]!.message, pt.copy.kit.unavailable);
  }
  assert.equal(JSON.stringify(input), before);
});

test("T0180: removed loaded rows cannot remain bulk-action targets", () => {
  const input: DataListInput = {
    content: ready([
      {
        id: "group-a",
        title: "Loaded",
        collapsible: false,
        rows: [{ id: "visible", title: "Visible", cells: [], selectable: true, actions: [] }],
      },
    ]),
    order: { sort: "", filters: {} },
    filters: [],
    views: [],
    viewDirty: false,
    selection: "multiple",
    selectedIds: ["removed", "visible"],
    collapsedIds: [],
    bulkActions: [action],
    page: { more: false, loading: false },
  };
  const model = ok(deriveDataList(input, p));
  assert.deepEqual(model.selectedIds, ["visible"]);
  assert.equal(model.bulk.actions[0]!.enabled, false);
  assert.equal(model.selectionIssue?.code, "unavailable");
});

test("T0180: map provider failure retains every authorized list row and permits only explicit recovery", () => {
  const status = { label: "Needs attention", tone: "warning", symbol: "warning" } as const;
  const result = ok(
    deriveMap(
      {
        content: ready([
          { id: "east", title: "East", longitude: 10, latitude: 20, status, actions: [] },
          { id: "west", title: "West", longitude: -10, latitude: -20, status, actions: [] },
        ]),
        mode: "map",
        viewport: { longitude: 0, latitude: 0, zoom: 2 },
        legend: [status],
        capabilities: { latitudeBounds: [-85, 85], zoomBounds: [0, 22] },
        providerState: "error",
        providerMessage: "Map unavailable",
        attribution: "Fixture",
        selectedId: "west",
      },
      p,
    ),
  ).map;
  assert.equal(result.canRender, false);
  assert.equal(result.canRetryProvider, true);
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["east", "west"],
  );
  assert.equal(result.selectedId, "west");
  assert.equal(result.selectionIssue, undefined);
});

test("T0180: adjacent overnight calendar data and chart nulls preserve supplied boundaries", () => {
  const day = ok(
    deriveCalendar(
      {
        content: ready([
          {
            id: "ended",
            title: "Previous day",
            kind: "timed",
            start: "2026-11-01T02:00:00Z",
            end: "2026-11-01T04:00:00Z",
          },
        ]),
        view: "day",
        anchorDate: "2026-11-01",
        selectedDate: "2026-11-01",
        agendaEndDate: "2026-11-02",
      },
      p,
    ),
  ).week.days[0]!;
  assert.equal(day.minutes, 1500);
  assert.equal(day.events.length, 0);
  const chart = ok(
    deriveChart(
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
