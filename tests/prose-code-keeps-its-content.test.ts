// 0069 §1 allows fenced code with any content and inline code with any content, and the
// server stores both as written. The reader's refusals — an image outside a figure, a
// `pk-file:` that is not a uuid, a heading outside `##`–`####` — are about the body's
// own constructs, so a line of code that merely looks like one of them is still code.
// A description that carries a shell snippet with a comment line is an ordinary body,
// and the phone draws it whole.
import assert from "node:assert/strict";
import test from "node:test";
import { proseBlocks } from "../src/core/prose";

const ok = (source: string) => {
  const split = proseBlocks(source);
  if (!split.ok) assert.fail(`refused: ${split.constructs.join(", ")}`);
  return split.blocks;
};

test("a comment line inside a fenced block is code, not a heading", () => {
  const blocks = ok("Install it:\n\n```sh\n# install the deps\nnpm ci\n```");
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["markdown", "markdown"],
  );
  assert.equal(
    blocks[1]?.kind === "markdown" && blocks[1].source,
    "```sh\n# install the deps\nnpm ci\n```",
  );
});

test("image syntax quoted inside a fenced block is code, not an image", () => {
  const blocks = ok("```md\n![alt](https://example.test/a.png)\n```");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.kind, "markdown");
});

test("a pk-file: scheme named inside inline code is code, not a file reference", () => {
  const blocks = ok("Write `pk-file:` before the id.");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.kind, "markdown");
});

test("a heading-like line inside a fenced block in a list is still code", () => {
  const blocks = ok("- step\n\n  ```python\n  # compute\n  x = 1\n  ```\n");
  assert.ok(blocks.every((b) => b.kind === "markdown"));
});
