import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCopy,
  deriveDataList,
  deriveState,
  type Content,
  type DataListInput,
  type DataRow,
  type Presentation,
  type Result,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function ok<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}
const refused = (result: Result<unknown>, path: string) => {
  assert.equal(result.ok, false);
  if (!result.ok)
    assert.ok(
      result.issues.some((i) => i.path === path),
      JSON.stringify(result.issues),
    );
};
const row = (id: string): DataRow => ({ id, title: id, cells: [], selectable: false, actions: [] });
const rows = [
  { id: "owned", title: "Owned", rows: [row("adult"), row("child")], collapsible: false },
];
const noRecords = (p: Presentation) =>
  ok(deriveState({ kind: "empty", title: "Nothing here", body: "Nothing arrived." }, p));
const input = (content: Content<unknown>, total?: number): DataListInput => ({
  content: content as DataListInput["content"],
  order: { sort: "", filters: {} },
  filters: [],
  views: [],
  viewDirty: false,
  selection: "none",
  selectedIds: [],
  collapsedIds: [],
  bulkActions: [],
  page: { more: false, loading: false },
  ...(total === undefined ? {} : { total }),
});

test("a list whose records have not arrived draws no count of them", () => {
  for (const language of ["en", "pt"] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    const loading = ok(deriveDataList(input({ phase: "loading" }, 4), p));
    assert.equal(loading.count, undefined);
    // The figure is withheld, not the check on it: a total that contradicts what
    // arrived is still refused by the name of the field that lied.
    refused(deriveDataList(input({ phase: "ready", refresh: "idle", value: rows }, 1), p), "total");
    const empty = ok(deriveDataList(input({ phase: "empty", state: noRecords(p) }, 0), p));
    assert.equal(empty.count, undefined);
  }
});

test("a count says how many are here and, when more exist, of how many", () => {
  for (const [language, expected] of [
    ["en", { some: "2 of 4", group: "2", whole: "1 of 8", both: "3 of 6" }],
    ["pt", { some: "2 de 4", group: "2", whole: "1 de 8", both: "3 de 6" }],
  ] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    const shown = ok(deriveDataList(input({ phase: "ready", refresh: "idle", value: rows }, 4), p));
    assert.equal(shown.count, expected.some);
    // A lone group counts the records the list counts: two figures for one set of
    // rows read as two unrelated measurements, so the group adds nothing here.
    assert.equal(shown.sections[0]!.count, undefined);
    // Where there is more than one group to tell apart, each states its own figure,
    // bare when it names no total and as a fraction when it does. A group holds
    // records; it loaded nothing — the fetch word belongs to the request.
    const grouped = ok(
      deriveDataList(
        input(
          {
            phase: "ready",
            refresh: "idle",
            value: [
              ...rows,
              { id: "more", title: "More", rows: [row("late")], collapsible: false, total: 8 },
            ],
          },
          6,
        ),
        p,
      ),
    );
    assert.equal(grouped.count, expected.both);
    assert.equal(grouped.sections[0]!.count, expected.group);
    assert.equal(grouped.sections[1]!.count, expected.whole);
    const whole = ok(deriveDataList(input({ phase: "ready", refresh: "idle", value: rows }), p));
    assert.equal(whole.count, "2");
  }
});

test("a lone group's total is the list's total, so the fraction is written once", () => {
  for (const [language, expected] of [
    ["en", "2 of 4"],
    ["pt", "2 de 4"],
  ] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    // The record arrives grouped with no list-level total: what the one group names
    // is how many exist, and the list says it in its own header.
    const grouped = ok(
      deriveDataList(
        input(
          {
            phase: "ready",
            refresh: "idle",
            value: [{ ...rows[0]!, total: 4 }],
          },
          undefined,
        ),
        p,
      ),
    );
    assert.equal(grouped.count, expected);
    assert.equal(grouped.sections[0]!.count, undefined);
    // A group that lies about its own total is still refused, drawn or not.
    refused(
      deriveDataList(
        input({ phase: "ready", refresh: "idle", value: [{ ...rows[0]!, total: 1 }] }),
        p,
      ),
      "sections.0.total",
    );
  }
});
