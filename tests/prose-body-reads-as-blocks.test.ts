// A rich text body is the Markdown the server stored (0069 §1), so reading it is a
// reading of that shape: a blank line between blocks, a figure a paragraph of its own,
// a fence that keeps its blank lines. These cases fix where the cuts fall, which width
// a frame gets in a slot, and which shapes the phone refuses to draw because the
// server would never have stored them.
import assert from "node:assert/strict";
import test from "node:test";
import { escapeSpoilers, phoneEditorHolds, proseBlocks, variantWidth } from "../src/core/prose";

type Blocks = Extract<ReturnType<typeof proseBlocks>, { ok: true }>;
type Block = Blocks["blocks"][number];
/** text is a run's Markdown, or "" when the block at that place is a figure. */
const text = (block: Block | undefined): string => (block?.kind === "markdown" ? block.source : "");
/** figure is a figure's own fields, or none when the block at that place is a run. */
const figure = (block: Block | undefined) => (block?.kind === "figure" ? block : undefined);
const ok = (source: string): Blocks["blocks"] => {
  const split = proseBlocks(source);
  if (!split.ok) assert.fail(`refused: ${split.constructs.join(", ")}`);
  return split.blocks;
};

test("two headings, a paragraph and a list stay four runs in their own order", () => {
  const blocks = ok(
    "## Coast\n\nA greyhound runs in short bursts.\n\n### Temperament\n\n- Calm\n- Alert\n",
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["markdown", "markdown", "markdown", "markdown"],
  );
  assert.deepEqual(
    blocks.map((b) => (b.kind === "markdown" ? b.id : "")),
    ["run-0", "run-1", "run-2", "run-3"],
  );
  assert.equal(text(blocks[0]), "## Coast");
  assert.equal(text(blocks[1]), "A greyhound runs in short bursts.");
  assert.equal(text(blocks[3]), "- Calm\n- Alert");
});

test("a figure is its own block between two paragraphs", () => {
  const blocks = ok(
    'Before.\n\n![A greyhound stretched out asleep](pk-file:3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b "In the yard, after the race")\n\nAfter.',
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["markdown", "figure", "markdown"],
  );
  assert.equal(figure(blocks[1])?.file, "3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b");
  assert.equal(figure(blocks[1])?.alt, "A greyhound stretched out asleep");
  assert.equal(figure(blocks[1])?.caption, "In the yard, after the race");
  assert.equal(figure(blocks[1])?.id, "fig-0");
});

test("a caption keeps the quote it escaped", () => {
  assert.equal(
    figure(ok('![Two](pk-file:3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b "the \\"quick\\" one")')[0])
      ?.caption,
    'the "quick" one',
  );
});

test("an image with no alt and no title is a decorative figure", () => {
  assert.equal(figure(ok("![](pk-file:3f7b1c2e-8d5a-4e6f-9b1c-2a3d4e5f6a7b)")[0])?.alt, "");
});

test("two figures keep their own ids in the order the body holds them", () => {
  const blocks = ok(
    "![One](pk-file:11111111-1111-4111-8111-111111111111)\n\n![Two](pk-file:22222222-2222-4222-8222-222222222222)\n",
  );
  assert.deepEqual(
    blocks.flatMap((b) => (b.kind === "figure" ? [b.id] : [])),
    ["fig-0", "fig-1"],
  );
  assert.deepEqual(
    blocks.flatMap((b) => (b.kind === "figure" ? [b.file] : [])),
    ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
  );
});

test("a body that is nothing but a figure is one block", () => {
  const blocks = ok("![One](pk-file:11111111-1111-4111-8111-111111111111)");
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["figure"],
  );
});

test("a fenced block keeps its blank lines and its language header", () => {
  const blocks = ok("Read this:\n\n```text\nfirst\n\nsecond\n```\n\nAfter.");
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["markdown", "markdown", "markdown"],
  );
  assert.equal(text(blocks[1]), "```text\nfirst\n\nsecond\n```");
});

test("a tilde fence closes on its own marker, not the first backtick", () => {
  const blocks = ok("~~~sql\nSELECT 1\n-- a `note`\n~~~\n\nAfter.");
  assert.equal(blocks.length, 2);
  assert.ok(text(blocks[0]).includes("SELECT 1"));
});

test("an unclosed fence is refused rather than drawn as an open paragraph", () => {
  const split = proseBlocks("```text\nnever closed");
  assert.equal(split.ok, false);
  assert.equal(split.ok === false && split.constructs.includes("code fence"), true);
});

test("a table is one run, pipes and all", () => {
  const blocks = ok("| Coat | Length |\n| --- | --- |\n| Short | 2 mm |\n");
  assert.equal(blocks.length, 1);
  assert.ok(text(blocks[0]).includes("| Short | 2 mm |"));
});

test("a nested list and a task list stay one run each", () => {
  const blocks = ok("- whelps\n  - neonates\n    - first week\n\n- [x] wormed\n- [ ] vaccinated\n");
  assert.equal(blocks.length, 2);
});

test("a blockquote and a thematic break are read as they were written", () => {
  const blocks = ok("> Whippet, not greyhound.\n\n---\n\nSmall enough for a flat.");
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["markdown", "markdown", "markdown"],
  );
});

test("plain text with newlines is paragraphs, not a refusal", () => {
  const blocks = ok("Good with children.\nGood with other dogs.\n\nVaccinated in March.");
  assert.equal(blocks.length, 2);
  assert.equal(text(blocks[0]), "Good with children.\nGood with other dogs.");
});

test("an image inside a sentence is refused: §1 has no inline image", () => {
  const split = proseBlocks("Look at ![this](pk-file:11111111-1111-4111-8111-111111111111) here.");
  assert.equal(split.ok, false);
  assert.equal(split.ok === false && split.constructs.includes("image"), true);
});

test("an image inside a list item is refused", () => {
  const split = proseBlocks("- a\n- ![two](pk-file:11111111-1111-4111-8111-111111111111)\n");
  assert.equal(split.ok, false);
});

test("a pk-file reference that is not a uuid is refused", () => {
  const split = proseBlocks("![One](pk-file:not-a-uuid)");
  assert.equal(split.ok, false);
  assert.equal(split.ok === false && split.constructs.includes("pk-file"), true);
});

test("an image addressed anywhere but pk-file is refused", () => {
  assert.equal(proseBlocks("![One](https://example.test/one.png)").ok, false);
});

test("a heading outside ## to #### is refused, and one inside is not", () => {
  assert.equal(proseBlocks("# Title\n\nBody.").ok, false);
  assert.equal(proseBlocks("##### Too deep\n\nBody.").ok, false);
  assert.equal(proseBlocks("## Two\n\n### Three\n\n#### Four").ok, true);
});

test("a link in any scheme the format allows is ordinary text to this reader", () => {
  assert.equal(
    proseBlocks("[Book a visit](mailto:vet@example.test) or [call](tel:+351210000000).").ok,
    true,
  );
});

test("a wide slot gets the widest variant below the frame, and never the frame's own width", () => {
  // A 390 dp phone at 3×: the slot is 1170 device pixels.
  assert.deepEqual(
    [2400, 1920, 1440, 960, 800, 400].map((frame) => variantWidth(1170, frame)),
    [960, 960, 960, 480, 480, 0],
  );
});

test("a slot wider than the widest variant still gets that widest variant", () => {
  assert.equal(variantWidth(3000, 4000), 1920);
  assert.equal(variantWidth(3000, 1920), 1440);
  assert.equal(variantWidth(500, 4000), 480);
});

test("a frame nobody measured plans nothing", () => {
  assert.equal(variantWidth(1170, 0), 0);
  assert.equal(variantWidth(0, 2400), 0);
  assert.equal(variantWidth(Number.NaN, 2400), 0);
});

test("a spoiler span is escaped so no sentence hides on the phone alone", () => {
  assert.equal(escapeSpoilers("a || b || c"), "a \\|\\| b \\|\\| c");
  assert.equal(escapeSpoilers("no bars here"), "no bars here");
});

test("a table is what the phone's rich editor cannot hold, and nothing else is", () => {
  assert.deepEqual(phoneEditorHolds("| a | b |\n| --- | --- |\n| 1 | 2 |\n"), ["table"]);
  assert.deepEqual(
    phoneEditorHolds(
      "## Heading\n\n- one\n- two\n\n![One](pk-file:11111111-1111-4111-8111-111111111111)",
    ),
    [],
  );
  assert.deepEqual(phoneEditorHolds("A body with no table at all."), []);
});
