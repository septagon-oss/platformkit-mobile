// A `widget:richtext` field held a one-line text box on the phone (2026-10-09, the owner writing content): kind()
// had no richtext branch, so a body fell through to "text". Until T-0192's editor, it is at least a prose box.
import assert from "node:assert/strict";
import test from "node:test";
import type { Field } from "../src/core/catalog";
import { kind } from "../src/core/derive";

test("a rich text body is written as prose, not one line", () => {
  const body = { name: "body", type: "text", widget: "richtext" } as Field;
  assert.equal(kind(body), "textarea");
});
