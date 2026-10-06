import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows } from "../scripts/check_flows";

test("an invalid workspace sequence is refused before the device job can run it", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-workspace-syntax-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "app"));
  mkdirSync(path.join(root, "e2e/flows"), { recursive: true });
  writeFileSync(path.join(root, "app/index.tsx"), "export default () => null;\n");
  for (const name of ["index", "other"])
    writeFileSync(
      path.join(root, `e2e/flows/${name}.yaml`),
      "# screen: app/index.tsx\nappId: ${APP_ID}\nenv:\n  APP_ID: dev.septagon.platformkit.ci\n---\n- launchApp\n",
    );
  const config = path.join(root, "e2e/flows/config.yaml");
  writeFileSync(config, "flows: [index.yaml, other.yaml]\n");
  assert.deepEqual(checkFlows(root), [], "a valid sequence plans both journeys");

  // An omitted first item is not YAML. Maestro 2.8.0's real planner raises
  // SyntaxError at the comma; discarding the item invents a runnable plan.
  writeFileSync(config, "flows: [, index.yaml, other.yaml]\n");
  const problems = checkFlows(root);
  assert.ok(
    problems.some((p) => p.startsWith("config.yaml:")),
    `the workspace the runner cannot parse must be named: ${JSON.stringify(problems)}`,
  );
});
