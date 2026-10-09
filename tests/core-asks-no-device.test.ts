// The core derives from what it is handed: a locale, a zone, an instant. Reading
// the phone's own language, hours or clock inside a derivation would make one row
// read one way on one device and another way on the next, and would make a test's
// answer depend on the machine that ran it. So the device is asked once, in
// src/screens, and the answer is passed down. These lines are the rule as a check.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const sources = (readdirSync("src/core", { recursive: true, encoding: "utf8" }) as string[])
  .filter((file) => file.endsWith(".ts"))
  .map((file) => `src/core/${file}`);

const asksTheMachine = /resolvedOptions\(|Date\.now\(|new Date\(\s*\)|process\.env|Math\.random/;

test("the core asks no device: it takes the locale, the zone and the instant it is given", () => {
  const asking = sources.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .map((line, i) => ({ code: line.trim(), at: `${file}:${i + 1}` }))
      // A comment may name what the file refuses to do; only spelled-out code asks.
      .filter(({ code }) => code !== "" && !/^(?:\/\/|\*|\/\*)/.test(code))
      .filter(({ code }) => asksTheMachine.test(code))
      .map(({ at }) => at),
  );
  assert.deepEqual(asking, [], "these lines read the machine instead of their arguments");
});
