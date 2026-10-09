// A refusal that names no catalogue resource — a named operation's read, the
// catalogue load itself — still names *something*: "this record", "this
// workspace". That noun is a word a person reads, so it comes from the phone's
// own bundle like the sentence around it. A Portuguese phone reads a Portuguese
// sentence end to end, never an English noun dropped into it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveCopy } from "../src/core/copy";
import { recordSubject } from "../src/core/failure";
import { ApiError } from "../src/effects/api";
import { catalogFailure, refusalOf } from "../src/screens/failure";

const pt = deriveCopy("pt");
const english = /\b(this|record|workspace)\b/i;

test("a named operation's failed read names its record in Portuguese on a Portuguese phone", () => {
  const said = refusalOf(new ApiError(503, ""), "read", recordSubject, pt).text;
  // Reached: the sentence is the Portuguese load sentence.
  assert.match(said, /^Não foi possível carregar /);
  assert.doesNotMatch(said, english, `an English noun inside a Portuguese sentence: ${said}`);
});

test("a catalogue the plan excludes names the workspace in Portuguese on a Portuguese phone", () => {
  const said = catalogFailure(new ApiError(402, ""), pt);
  // Reached: the sentence is the Portuguese plan sentence.
  assert.match(said, /^O plano desta conta não inclui /);
  assert.doesNotMatch(said, english, `an English noun inside a Portuguese sentence: ${said}`);
});
