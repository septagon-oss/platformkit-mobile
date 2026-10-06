// The viewer shows the image a person opened, or none. An item removed from the list or newly
// marked decorative clears the selection with its own refusal instead of advancing to the next
// item, which would show a different picture under the same caption.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, deriveViewer, type MediaInput, type MediaItem } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

test("removing or decorating a selected item never substitutes another viewer image", () => {
  const selected: MediaItem = {
    id: "canal",
    width: 1440,
    height: 960,
    description: "Canal at dusk",
    decorative: false,
    state: "ready",
  };
  const other: MediaItem = { ...selected, id: "square", description: "Quiet square" };
  for (const language of ["en", "pt"] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    const input: MediaInput & { open: boolean } = {
      open: true,
      selectedId: selected.id,
      content: { phase: "ready", refresh: "idle", value: [other, selected] },
      page: { more: false, loading: false },
    };
    const before = JSON.stringify(input);
    const allowed = deriveViewer(input, p);
    assert.ok(allowed.ok);
    assert.equal(allowed.value.selected?.id, selected.id);
    assert.equal(allowed.value.previous, other.id);

    for (const items of [[other], [other, { ...selected, decorative: true }]]) {
      const result = deriveViewer(
        { ...input, content: { phase: "ready", refresh: "idle", value: items } },
        p,
      );
      assert.ok(result.ok);
      assert.equal(result.value.open, true, "the caller still owns dismissal");
      assert.equal(result.value.selected, undefined);
      assert.equal(result.value.position, undefined);
      assert.equal(result.value.previous, undefined);
      assert.equal(result.value.next, undefined);
      assert.deepEqual(result.value.selectionIssue, {
        code: "unavailable",
        recovery: "correctable",
        path: "selectedId",
        message: p.copy.kit.unavailable,
      });
    }

    const invalid = deriveViewer(
      {
        ...input,
        content: { phase: "ready", refresh: "idle", value: [{ ...selected, width: 0 }] },
      },
      p,
    );
    assert.equal(invalid.ok, false);
    assert.equal("value" in invalid, false, "invalid media cannot leak a partial selected model");
    if (!invalid.ok) {
      assert.equal(invalid.issues[0]?.code, "invalid-input");
      assert.equal(invalid.issues[0]?.recovery, "immutable");
      assert.equal(invalid.issues[0]?.message, p.copy.issue.invalid);
    }
    assert.deepEqual(deriveViewer(input, p), allowed, "a later authorized snapshot can reopen it");
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(selected), false, "derivation must not freeze the caller's draft");
  }
});
