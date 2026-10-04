import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCopy,
  deriveDataList,
  deriveState,
  type DataListInput,
  type Result,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function ok<T>(result: Result<T>): T {
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value;
}

test("refreshed list eligibility cannot carry removed or disabled rows into a bulk target", () => {
  for (const language of ["en", "pt"] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    const rows = ["first", "second", "third"].map((id) => ({
      id,
      title: id,
      cells: [],
      selectable: true,
      actions: [],
    }));
    const input: DataListInput = {
      content: {
        phase: "ready",
        refresh: "idle",
        value: [{ id: "loaded", title: "Loaded", rows, collapsible: false, total: 11 }],
      },
      order: { sort: "", filters: {} },
      filters: [],
      views: [],
      viewDirty: false,
      selection: "multiple",
      selectedIds: ["third", "first", "third"],
      collapsedIds: [],
      bulkActions: [{ id: "archive", label: "Archive", state: "ready", tone: "primary" }],
      page: { more: true, loading: false },
    };
    const before = JSON.stringify(input);
    const initial = ok(deriveDataList(input, p));
    assert.deepEqual(initial.selectedIds, ["first", "third"]);
    assert.equal(initial.bulk.actions[0]!.enabled, true);

    const refreshed: DataListInput = {
      ...input,
      content: {
        phase: "ready",
        refresh: "idle",
        value: [
          {
            id: "loaded",
            title: "Loaded",
            collapsible: false,
            rows: [rows[0]!, { ...rows[2]!, selectable: false, selectionReason: "Read only" }],
          },
        ],
      },
      selectedIds: ["third", "second", "first"],
    };
    const withdrawn = ok(deriveDataList(refreshed, p));
    assert.deepEqual(withdrawn.selectedIds, ["first"]);
    assert.deepEqual(withdrawn.allTarget, []);
    assert.equal(withdrawn.selectionIssue?.code, "unavailable");
    assert.equal(withdrawn.selectionIssue?.message, p.copy.kit.unavailable);
    assert.equal(withdrawn.bulk.actions[0]!.enabled, false);
    const reconciled = ok(deriveDataList({ ...refreshed, selectedIds: ["first"] }, p));
    assert.equal(reconciled.selectionIssue, undefined);
    assert.equal(reconciled.bulk.actions[0]!.enabled, true);

    for (const code of ["forbidden", "not-found"] as const) {
      const state = ok(
        deriveState(
          {
            kind: "error",
            issue: { code, path: "list", recovery: "immutable", message: p.copy.kit.unavailable },
          },
          p,
        ),
      );
      const denied = ok(deriveDataList({ ...input, content: { phase: "error", state } }, p));
      assert.deepEqual(denied.sections, []);
      assert.deepEqual(denied.selectedIds, []);
      assert.deepEqual(denied.allTarget, []);
      assert.equal(denied.bulk.actions[0]!.enabled, false);
      assert.equal(denied.selectAll?.enabled, false);
      assert.equal(denied.more?.enabled, false);
      assert.deepEqual(denied.state, state);
    }
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(rows[0]), false);
    rows[0]!.title = "Caller draft changed";
    assert.equal(initial.sections[0]!.rows[0]!.title, "first");
    assert.ok(Object.isFrozen(reconciled.selectedIds));
  }
});
