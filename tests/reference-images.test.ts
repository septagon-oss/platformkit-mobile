import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("chosen gallery references are available beside their manifest", () => {
  const directory = "design/references";
  const manifest = JSON.parse(readFileSync(path.join(directory, "refs.json"), "utf8")) as {
    entries: readonly { id: string; sha256: string }[];
  };
  const files = readdirSync(directory, { recursive: true, encoding: "utf8" }) as string[];
  const localDigests = new Set(
    files
      .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
      .map((file) =>
        createHash("sha256")
          .update(readFileSync(path.join(directory, file)))
          .digest("hex"),
      ),
  );
  assert.deepEqual(
    manifest.entries.filter((entry) => !localDigests.has(entry.sha256)).map((entry) => entry.id),
    [],
    "each chosen screen should have its exact bytes under design/references",
  );
});
