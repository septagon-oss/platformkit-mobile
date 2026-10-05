// A denied media read ends the selection it covered: caption, description and retry stop
// existing, and nothing the viewer showed from the earlier authorized read is still on screen.
import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCopy,
  deriveMedia,
  deriveState,
  deriveViewer,
  type MediaInput,
} from "../src/core/derive";
import { presentation } from "./fakes/presentation";

for (const language of ["en", "pt"] as const) {
  test(`${language} denied media read clears selection and cannot revive stale content`, () => {
    const p = { ...presentation, copy: deriveCopy(language) };
    const original: MediaInput & { open: boolean } = {
      open: true,
      selectedId: "terrace",
      content: {
        phase: "ready",
        refresh: "idle",
        value: [
          {
            id: "terrace",
            width: 1800,
            height: 1200,
            description: "Terrace after rain",
            caption: "Caption from the previously authorized collection",
            decorative: false,
            state: "ready",
          },
        ],
      },
      page: { more: true, loading: false },
    };
    const before = JSON.stringify(original);
    const ready = deriveViewer(original, p);
    assert.ok(ready.ok);
    assert.equal(ready.value.selected?.id, "terrace");

    for (const code of ["forbidden", "not-found"] as const) {
      const error = {
        kind: "error" as const,
        issue: {
          code,
          path: "media",
          recovery: "immutable" as const,
          message: p.copy.kit.unavailable,
        },
      };
      const refusal = deriveState(error, p);
      assert.ok(refusal.ok);
      const denied: MediaInput & { open: boolean } = {
        ...original,
        content: { phase: "error", state: refusal.value },
      };
      const collection = deriveMedia(denied, p);
      const viewer = deriveViewer(denied, p);
      assert.ok(collection.ok);
      assert.ok(viewer.ok);
      for (const model of [collection.value, viewer.value]) {
        assert.deepEqual(model.items, []);
        assert.equal(model.writable, false);
        assert.equal(model.more?.enabled, false);
        assert.equal(model.state?.language, language);
        assert.equal(model.state?.body, p.copy.kit.unavailable);
        assert.deepEqual(model.state?.actions, []);
        assert.equal(JSON.stringify(model).includes("Terrace after rain"), false);
        assert.equal(JSON.stringify(model).includes("previously authorized collection"), false);
      }
      assert.equal(viewer.value.open, true, "the caller owns closing the denied viewer");
      assert.equal(viewer.value.selected, undefined);
      assert.equal(viewer.value.position, undefined);
      assert.equal(viewer.value.previous, undefined);
      assert.equal(viewer.value.next, undefined);
      assert.equal(viewer.value.selectionIssue?.message, p.copy.kit.unavailable);

      // A denied read cannot be presented as retained, stale-but-readable content.
      const stale = deriveState({ ...error, updatedAt: "2026-07-18T08:55:00Z" }, p);
      assert.equal(stale.ok, false);
      assert.equal("value" in stale, false);
      if (!stale.ok) {
        assert.ok(stale.issues.some((issue) => issue.path === "updatedAt"));
        assert.ok(stale.issues.every((issue) => issue.recovery === "immutable"));
        assert.ok(stale.issues.every((issue) => issue.message === p.copy.issue.invalid));
      }
    }

    // A subsequent authorized response remains usable; refusal is not a global latch.
    assert.deepEqual(deriveViewer(original, p), ready);
    assert.equal(JSON.stringify(original), before);
    assert.equal(Object.isFrozen(original.content), false);
  });
}
