import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";

test("test files are named for behavior instead of a review phase", () => {
  const files = readdirSync("tests", { recursive: true, encoding: "utf8" }) as string[];
  const phaseNamed = files.filter((file) =>
    /(?:^|\/)(?:review[-_]|round\d+[-_]|probe[-_])[^/]*\.(?:test|spec|case)\.[cm]?[jt]sx?$/.test(
      file,
    ),
  );
  assert.deepEqual(phaseNamed, []);
});
