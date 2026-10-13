// A rich text body is drawn by `Prose` in the kit's type and said aloud by `proseSpoken`:
// the same words, at two speeds. These cases hold what a person hearing the record is told
// — the author's sentences, a code block read as written, a figure named — and what they are
// never told: the markup that only tells a screen how to draw, a link's address, a checked
// box read out as brackets, or a `##` where a heading stands.
import assert from "node:assert/strict";
import test from "node:test";
import { proseSpoken } from "../src/core/prose";

const FILE = "3f6f0b7f-2b6f-4d8b-9d3a-6f0f3f0f9c31";

test("a heading, its emphasis and a link are said as their own words", () => {
  assert.equal(
    proseSpoken(
      "## Care plan\n\nGive **fresh water** every [morning](https://acme.test/visit) and keep *quiet* hours.",
    ),
    "Care plan\nGive fresh water every morning and keep quiet hours.",
  );
});

test("a fenced block is said as the code it holds, and its marker says nothing", () => {
  assert.equal(
    proseSpoken("## Two\n\n```sh\npk deploy --dry-run\n```\n\nAfter."),
    "Two\npk deploy --dry-run\nAfter.",
  );
});

test("a list says its items and not its marks, checked off or not", () => {
  assert.equal(
    proseSpoken("- [x] Supplied water\n- [ ] Cleaned bowl\n\n1. Boil\n2. Cool"),
    ["Supplied water", "Cleaned bowl", "Boil", "Cool"].join("\n"),
  );
});

test("a quoted line is said as the sentence it quotes", () => {
  assert.equal(
    proseSpoken("> Bring the sample.\n\nNote the date."),
    ["Bring the sample.", "Note the date."].join("\n"),
  );
});

test("a table is said cell by cell, and its separator row says nothing", () => {
  assert.equal(
    proseSpoken("| Dose | Time |\n| --- | --- |\n| 5 ml | Morning |"),
    ["Dose, Time", "5 ml, Morning"].join("\n"),
  );
});

test("a figure is named by its alt and its caption, and a decorative one says nothing", () => {
  assert.equal(
    proseSpoken(`Give water.\n\n![The bridge at dusk](pk-file:${FILE} "South span")`),
    "Give water.\nThe bridge at dusk, South span",
  );
  assert.equal(proseSpoken(`Water.\n\n![ ](pk-file:${FILE})`), "Water.");
});

test("a mark that never pairs is a character of the sentence, not markup", () => {
  // The format draws a lone backtick as a backtick, and `snake_case` and arithmetic keep
  // the characters that spell them: removing an unpaired mark would change what is said.
  assert.equal(
    proseSpoken("Set `snake_case in the box, then 2 * 3 + 4 and a lone ~ there."),
    "Set `snake_case in the box, then 2 * 3 + 4 and a lone ~ there.",
  );
});

test("a body the reader refuses is said exactly as it was stored", () => {
  // Refused, the field draws the whole body as text, syntax and all: what a person hears
  // is then what is on the screen rather than a paraphrase of it.
  const stored = "# Too high\n\nGive water.";
  assert.equal(proseSpoken(stored), stored);
});
