// A fence-like line followed by words is literal code, not a closing delimiter.
// The reader preserves that valid fenced block instead of refusing the whole body.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { proseBlocks } from "../src/core/prose";

const MarkdownIt = createRequire(import.meta.url)("markdown-it");

test("a fence marker followed by text stays inside its code block", () => {
  const source = ["```text", "``` is part of the example", "# Literal code heading", "```"].join(
    "\n",
  );
  const tokens = new MarkdownIt().parse(source, {});
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].type, "fence");
  assert.equal(tokens[0].content, "``` is part of the example\n# Literal code heading\n");
  assert.deepEqual(proseBlocks(source), {
    ok: true,
    blocks: [{ kind: "markdown", id: "run-0", source }],
  });
});
