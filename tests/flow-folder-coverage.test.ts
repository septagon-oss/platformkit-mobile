import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows } from "../scripts/check_flows";

// `maestro test e2e/flows` with no workspace config plans the flows matching
// its default glob `*`, which does not cross a folder: a journey one folder down
// never runs. A screen claimed only there is a screen no journey reaches, so the
// gate either leaves it uncovered or refuses the folder — never counts it.
test("a screen claimed only by a flow in a folder Maestro does not plan is uncovered", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-folders-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "app"));
  mkdirSync(path.join(root, "e2e/flows/nested"), { recursive: true });
  writeFileSync(path.join(root, "app/index.tsx"), "export default () => null;\n");
  writeFileSync(path.join(root, "app/other.tsx"), "export default () => null;\n");
  const body = "appId: ${APP_ID}\nenv:\n  APP_ID: dev.septagon.platformkit.ci\n---\n- launchApp\n";
  writeFileSync(path.join(root, "e2e/flows/home.yaml"), "# screen: app/index.tsx\n" + body);
  // The same claim at the top level, where Maestro plans it, covers the screen.
  writeFileSync(path.join(root, "e2e/flows/other.yaml"), "# screen: app/other.tsx\n" + body);
  assert.deepEqual(checkFlows(root), []);
  rmSync(path.join(root, "e2e/flows/other.yaml"));
  writeFileSync(path.join(root, "e2e/flows/nested/other.yaml"), "# screen: app/other.tsx\n" + body);
  const problems = checkFlows(root);
  assert.ok(
    problems.some((p) => p.startsWith("app/other.tsx") || p.startsWith("nested/")),
    `a claim no planned journey makes passed the gate: ${JSON.stringify(problems)}`,
  );
});
