import assert from "node:assert/strict";
import test from "node:test";
import { initial, reduce } from "../src/core/state";

test("the five transitions", () => {
  assert.equal(initial.phase, "booting");
  assert.equal(reduce(initial, { type: "no-session" }).phase, "anonymous");
  const loading = reduce(initial, { type: "session" });
  assert.equal(loading.phase, "loading");
  const ready = reduce(loading, { type: "catalog", catalog: { resources: [] } });
  assert.equal(ready.phase, "ready");
  assert.deepEqual(ready.catalog, { resources: [] });
  const failed = reduce(loading, { type: "failed", error: "unreachable" });
  assert.equal(failed.phase, "failed");
  assert.equal(failed.error, "unreachable");
  const out = reduce(ready, { type: "signed-out" });
  assert.equal(out.phase, "anonymous");
  assert.equal(out.catalog, undefined, "a signed-out shell keeps no catalog");
});
