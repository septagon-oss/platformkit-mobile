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
    ["en", { some: "2 of 4", group: "2" }],
    ["pt", { some: "2 de 4", group: "2" }],
  ] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    const shown = ok(deriveDataList(input({ phase: "ready", refresh: "idle", value: rows }, 4), p));
    assert.equal(shown.count, expected.some);
    // A group holds records; it did not load anything. The fetch word belongs to
    // the request, and a second count wearing it reads as a second, unrelated figure.
    assert.equal(shown.sections[0]!.count, expected.group);
    const whole = ok(deriveDataList(input({ phase: "ready", refresh: "idle", value: rows }), p));
    assert.equal(whole.count, "2");
  }
});
