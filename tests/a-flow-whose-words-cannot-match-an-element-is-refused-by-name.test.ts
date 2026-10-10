// Maestro reads a text selector as regex source, not as a JavaScript literal: its YAML
// reader keeps the scalar whole and StringUtils.toRegexSafe compiles what it is given,
// matched against the element's text as a whole string. A journey that wraps its pattern
// in slashes therefore asks for an element whose text begins and ends with `/`, taps
// nothing, and fails at that step for a reason that says nothing about the screen it was
// proving. What the device-only gate cannot see, this one checks without a device: the
// words a flow looks for are refused where they cannot match, and the same expression
// written as the pattern it is — no wrappers — passes.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows } from "../scripts/check_flows";

/** flow writes one journey at `name` under `root` and returns its path. */
function flow(root: string, name: string, steps: readonly string[]): string {
  mkdirSync(path.join(root, "app"), { recursive: true });
  mkdirSync(path.join(root, "e2e/flows"), { recursive: true });
  writeFileSync(path.join(root, "app/index.tsx"), "export default () => null;\n");
  writeFileSync(
    path.join(root, "e2e/flows", name),
    `# screen: app/index.tsx\nappId: \${APP_ID}\nenv:\n  APP_ID: dev.septagon.platformkit.ci\n---\n${steps.join("\n")}\n`,
  );
  return name;
}

test("a journey whose words are spelled as a /regex/ literal is refused where they are written", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-selector-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const name = flow(root, "index.yaml", [
    "- launchApp",
    '- tapOn: "/(?i)^Delete [^‘’?]+$/"',
    '- assertVisible: "^Delete .*$"',
  ]);
  const problems = checkFlows(root);
  assert.equal(problems.length, 1, `refused once: ${problems.join("; ")}`);
  const refusal = problems[0]!;
  assert.ok(refusal.startsWith(`${name} line 7: tapOn:`), refusal);
  // The refusal says which rule the spelling breaks, not only that it differs.
  assert.match(refusal, /regex source/);
  assert.match(refusal, /nothing can ever be tapped/);
});

test("a journey whose words are the pattern itself is not refused for its spelling", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-selector-ok-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  flow(root, "index.yaml", [
    "- launchApp",
    // Plain text, a quoted word, and bare regex source all name what to look for.
    "- tapOn: New",
    '- assertNotVisible: "You can’t undo this in the app."',
    "- tapOn: (?i)^Delete [^‘’?]+$",
  ]);
  assert.deepEqual(checkFlows(root), []);
});
