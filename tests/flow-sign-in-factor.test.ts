import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { flowFiles } from "../scripts/check_flows";

// One journey Maestro plans (the set `check:flows` reads) signs in through the
// second-factor step: it claims the sign-in screen and answers the code step
// by the ids the screen sets, with the code from the environment the harness
// seeds — never a literal secret.
test("a planned journey signs in through the second-factor step", () => {
  const journeys = flowFiles(".").map((file) => ({
    file,
    text: readFileSync(path.join("e2e/flows", file), "utf8"),
  }));
  const factor = journeys.filter(
    ({ text }) =>
      /^# screen: app\/sign-in\.tsx$/m.test(text) &&
      /id: "challenge"/.test(text) &&
      /id: "code"/.test(text) &&
      /id: "verify"/.test(text),
  );
  assert.ok(
    factor.length > 0,
    `no planned flow answers the code step; planned: ${journeys.map((j) => j.file).join(", ")}`,
  );
  for (const { file, text } of factor)
    assert.match(
      text,
      /inputText: \$\{[A-Z_]+\}/,
      `${file} types a code it does not take from the environment`,
    );
});
