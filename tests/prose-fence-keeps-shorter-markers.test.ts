// A fenced code block may quote a shorter fence. Its opening marker's whole
// width defines the closing marker, so the quoted heading and image remain code.
import assert from "node:assert/strict";
import test from "node:test";
import { phoneEditorHolds, proseBlocks } from "../src/core/prose";

const code = [
  "````markdown",
  "```",
  "# Installation example",
  "![example](https://example.test/example.png)",
  "```",
  "````",
].join("\n");

test("a shorter marker inside a fenced block does not end its literal content", () => {
  const source = `Before.\n\n${code}\n\nAfter.`;
  const split = proseBlocks(source);
  assert.equal(split.ok, true, JSON.stringify(split));
  if (!split.ok) return;
  assert.deepEqual(
    split.blocks.map((block) => block.kind),
    ["markdown", "markdown", "markdown"],
  );
  assert.equal(split.blocks[1]?.kind === "markdown" && split.blocks[1].source, code);
});

test("a quoted heading and image inside a wide fence do not hold the editor", () => {
  assert.deepEqual(phoneEditorHolds(code), []);
});
