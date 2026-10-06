import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows } from "../scripts/check_flows";

test("an empty replacement selection cannot hide a flow Maestro runs from its id checks", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-null-selection-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "app"));
  mkdirSync(path.join(root, "e2e/flows"), { recursive: true });
  writeFileSync(
    path.join(root, "app/index.tsx"),
    'export const Home = () => <View testID="home" />;\n',
  );
  const body = (id: string) =>
    `# screen: app/index.tsx\nappId: \${APP_ID}\nenv:\n  APP_ID: dev.septagon.platformkit.ci\n---\n- assertVisible:\n    id: "${id}"\n`;
  writeFileSync(path.join(root, "e2e/flows/index.yaml"), body("home"));
  writeFileSync(path.join(root, "e2e/flows/other.yaml"), body("home"));
  assert.deepEqual(checkFlows(root), [], "the two valid journeys cover this tree");

  // WorkspaceExecutionPlanner.plan (Maestro 2.8.0) plans both files when the
  // last flows key is null. A prior selection no longer narrows the run.
  writeFileSync(path.join(root, "e2e/flows/config.yaml"), "flows: [index.yaml]\nflows:\n");
  writeFileSync(path.join(root, "e2e/flows/other.yaml"), body("missing-control"));
  const problems = checkFlows(root);
  assert.ok(
    problems.some(
      (p) =>
        p.startsWith("config.yaml:") ||
        (p.includes("other.yaml:") && p.includes("missing-control")),
    ),
    `a flow the planner runs must be checked, or its configuration refused: ${JSON.stringify(problems)}`,
  );
});
