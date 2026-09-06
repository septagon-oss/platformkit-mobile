import assert from "node:assert/strict";
import test from "node:test";
import { initial, reduce } from "../src/core/state";

const catalog = { resources: [] };

test("restoration, loading, failure and sign-out transitions", () => {
  assert.equal(initial.phase, "booting");
  assert.equal(reduce(initial, { type: "no-session", generation: 1 }).phase, "anonymous");
  const loading = reduce(initial, { type: "session", generation: 1 });
  assert.equal(loading.phase, "loading");
  const ready = reduce(loading, { type: "catalog", generation: 1, catalog });
  assert.equal(ready.phase, "ready");
  assert.deepEqual(ready.catalog, catalog);
  const failed = reduce(loading, { type: "failed", generation: 1, error: "unreachable" });
  assert.equal(failed.phase, "failed");
  assert.equal(failed.error, "unreachable");
  const out = reduce(ready, { type: "signed-out", generation: 2 });
  assert.equal(out.phase, "anonymous");
  assert.equal(out.catalog, undefined, "a signed-out shell keeps no catalog");
});

test("late success, failure and restored sessions cannot undo sign-out", () => {
  const loading = reduce(initial, { type: "session", generation: 10 });
  const out = reduce(loading, { type: "signed-out", generation: 20 });
  assert.equal(reduce(out, { type: "catalog", generation: 10, catalog }), out);
  assert.equal(reduce(out, { type: "failed", generation: 10, error: "late" }), out);
  assert.equal(reduce(out, { type: "session", generation: 10 }), out);
  assert.equal(reduce(out, { type: "session", generation: 20 }), out);
  assert.equal(reduce(out, { type: "catalog", generation: 20, catalog }), out);
});

test("a new sign-in supersedes restoration and earlier login attempts", () => {
  const signingIn = reduce(initial, { type: "sign-in", generation: 3 });
  assert.equal(signingIn.phase, "signing-in");
  assert.equal(reduce(signingIn, { type: "session", generation: 1 }), signingIn);
  assert.equal(reduce(signingIn, { type: "no-session", generation: 1 }), signingIn);
  assert.equal(reduce(signingIn, { type: "session", generation: 2 }), signingIn);
  const loading = reduce(signingIn, { type: "session", generation: 3 });
  assert.equal(loading.phase, "loading");
  assert.equal(reduce(loading, { type: "catalog", generation: 3, catalog }).phase, "ready");
});

test("a newer refresh owns the catalog even if responses arrive in reverse order", () => {
  const first = reduce(initial, { type: "session", generation: 4 });
  const second = reduce(first, { type: "session", generation: 5 });
  assert.equal(reduce(second, { type: "catalog", generation: 4, catalog }), second);
  const ready = reduce(second, { type: "catalog", generation: 5, catalog });
  assert.equal(reduce(ready, { type: "failed", generation: 4, error: "late" }), ready);
});

test("a storage failure remains signed out with an actionable error", () => {
  const out = reduce(initial, { type: "signed-out", generation: 2, error: "Clear failed" });
  assert.deepEqual(out, { phase: "anonymous", generation: 2, error: "Clear failed" });
  assert.equal(reduce(out, { type: "catalog", generation: 1, catalog }), out);
});
