// Explicit Node review pin; run with tsx --test, outside the default *.test.ts glob.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveViewer, type MediaItem } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

test("T0180: viewer snapshots stay isolated from caller edits and later selection withdrawal", () => {
  const original: MediaItem = {
    id: "estuary",
    width: 1500,
    height: 1000,
    description: "Estuary at dawn",
    caption: "First authorized caption",
    decorative: false,
    state: "ready",
  };
  const items = [original];
  const view = () =>
    deriveViewer(
      {
        open: true,
        selectedId: original.id,
        content: { phase: "ready", refresh: "idle", value: items },
        page: { more: false, loading: false },
      },
      presentation,
    );
  const initial = view();
  assert.ok(initial.ok);
  assert.equal(initial.value.selected?.caption, "First authorized caption");
  assert.ok(Object.isFrozen(initial.value));
  assert.ok(Object.isFrozen(initial.value.items));
  assert.ok(Object.isFrozen(initial.value.selected));
  assert.equal(Object.isFrozen(items), false, "the caller still owns its mutable collection");
  assert.equal(Object.isFrozen(original), false, "derivation must not freeze caller objects");
  const snapshot = JSON.stringify(initial.value);

  // A later read can replace content under the same identity without mutating older models.
  items[0] = { ...original, caption: "Revised authorized caption", state: "loading" };
  items.push({ ...original, id: "dunes", description: "Dunes at noon" });
  const refreshed = view();
  assert.ok(refreshed.ok);
  assert.equal(refreshed.value.selected?.caption, "Revised authorized caption");
  assert.equal(refreshed.value.selected?.state, "loading");
  assert.equal(refreshed.value.next, "dunes");
  assert.equal(refreshed.value.selectionIssue, undefined);
  assert.equal(JSON.stringify(initial.value), snapshot);

  items.shift();
  const withdrawn = view();
  assert.ok(withdrawn.ok);
  assert.equal(withdrawn.value.selected, undefined);
  assert.equal(withdrawn.value.next, undefined);
  assert.equal(withdrawn.value.previous, undefined);
  assert.equal(withdrawn.value.selectionIssue?.code, "unavailable");
  assert.equal(refreshed.value.selected?.caption, "Revised authorized caption");
  assert.equal(JSON.stringify(initial.value), snapshot);

  items.unshift(original);
  const restored = view();
  assert.ok(restored.ok);
  assert.equal(restored.value.selected?.id, original.id);
  assert.equal(restored.value.selectionIssue, undefined);
});
