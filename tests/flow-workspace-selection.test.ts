import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows } from "../scripts/check_flows";

test("a screen claimed only by a flow excluded by workspace configuration is uncovered", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-selection-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "app"));
  mkdirSync(path.join(root, "e2e/flows"), { recursive: true });
  const body = "appId: ${APP_ID}\nenv:\n  APP_ID: dev.septagon.platformkit.ci\n---\n- launchApp\n";
  for (const name of ["index", "other"]) {
    writeFileSync(path.join(root, `app/${name}.tsx`), "export default () => null;\n");
    writeFileSync(path.join(root, `e2e/flows/${name}.yaml`), `# screen: app/${name}.tsx\n${body}`);
  }
  assert.deepEqual(checkFlows(root), []);

  // Maestro automatically reads config.yaml when running the directory. Its
  // planner selects only index.yaml here, even though other.yaml is beside it.
  writeFileSync(path.join(root, "e2e/flows/config.yaml"), "flows:\n  - index.yaml\n");
  const problems = checkFlows(root);
  assert.ok(
    problems.some((p) => p.includes("app/other.tsx") || p.includes("config.yaml")),
    `the workspace excludes other.yaml, but the gate accepts its screen claim: ${JSON.stringify(problems)}`,
  );
});
