// A specimen shows a state as it is, controls included. The hero's secondary verb
// opens this picture, so it belongs to this picture: printed over a skeleton or over
// a failed frame it promises the person the act the specimen is showing cannot happen.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy, kitExamples } from "../src/core/derive";
import type { Presentation } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

function hero(caseId: string, p: Presentation) {
  const result = kitExamples(p, caseId);
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.issues));
  return result.value.hero;
}

test("a media specimen offers its opening act only over a picture that is here", () => {
  for (const language of ["en", "pt"] as const) {
    const p = { ...presentation, copy: deriveCopy(language) };
    const ready = hero("media-hero/default", p);
    assert.equal(ready.item.state, "ready", language);
    assert.equal(ready.action?.label, p.copy.kit.details, language);
    // A specimen that waits still says what it is a picture of, and still offers to
    // bring it back when it failed. What it withholds is the act on the picture.
    for (const [caseId, state] of [
      ["media-hero/loading", "loading"],
      ["media-hero/error", "error"],
    ] as const) {
      const waiting = hero(caseId, p);
      assert.equal(waiting.item.state, state, caseId);
      assert.equal(waiting.title, p.copy.kit.placePrintRoom, caseId);
      assert.equal(waiting.action, undefined, caseId);
      assert.equal(waiting.item.canRetry, state === "error", caseId);
    }
  }
});
