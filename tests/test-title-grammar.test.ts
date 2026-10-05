import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

test("test titles are named for behavior instead of the task that wrote them", () => {
  const files = readdirSync("tests", { recursive: true, encoding: "utf8" }) as string[];
  const taskNamed = files
    .filter((file) => /\.(?:test|spec|case)\.[cm]?[jt]sx?$/.test(file))
    .flatMap((file) =>
      readFileSync(`tests/${file}`, "utf8")
        .split("\n")
        .filter((line) => /\b(?:test|it|describe)\(\s*["'`]T-?\d{4}\b/.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    );
  assert.deepEqual(taskNamed, []);
});
