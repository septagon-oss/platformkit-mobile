import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { checkFlows, flowFiles, workspacePlan } from "../scripts/check_flows";

// `tests/flow-workspace-selection.test.ts` proves the invariant: a screen whose
// only journey is excluded from the plan is uncovered. These cases hold the four
// edges of how that plan is built — that an exclusion narrows it the way an
// inclusion does, that a glob selects instead of refusing everything, that an
// entry naming no journey is named back, and that a field the gate cannot read
// is refused rather than read as agreement.

const APP_ID = "dev.septagon.platformkit.ci";
const body = `appId: \${APP_ID}\nenv:\n  APP_ID: ${APP_ID}\n---\n- launchApp\n`;

/**
 * pair is the smallest workspace with two claims: `index` proves app/index.tsx
 * and `other` proves app/other.tsx, both at the top level, where Maestro plans.
 */
function pair(t: TestContext): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-plan-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "app"));
  mkdirSync(path.join(root, "e2e/flows"), { recursive: true });
  for (const name of ["index", "other"]) {
    writeFileSync(path.join(root, `app/${name}.tsx`), "export default () => null;\n");
    writeFileSync(path.join(root, `e2e/flows/${name}.yaml`), `# screen: app/${name}.tsx\n${body}`);
  }
  return root;
}

const config = (root: string, text: string) =>
  writeFileSync(path.join(root, "e2e/flows/config.yaml"), text);

test("a flow excluded from the plan leaves its screen uncovered", (t) => {
  const root = pair(t);
  assert.deepEqual(checkFlows(root), []);
  config(root, "excludeFlows:\n  - other.yaml\n");
  assert.deepEqual(flowFiles(root), ["index.yaml"], "the exclusion narrows the list CI walks");
  assert.deepEqual(checkFlows(root), ["app/other.tsx: no device flow names it"]);
});

test("a glob selects journeys without refusing the set that matches it", (t) => {
  const root = pair(t);
  // A workspace that names what it runs may still run everything: the plan is a
  // match, not a suspicion, and a tree whose journeys all match has nothing to
  // answer for.
  config(root, `name: journeys\nflows:\n  - "*.yaml"\n`);
  assert.deepEqual(flowFiles(root), ["index.yaml", "other.yaml"]);
  assert.deepEqual(checkFlows(root), []);
  config(root, "flows: [index.yaml, other.yaml]\n");
  assert.deepEqual(flowFiles(root), ["index.yaml", "other.yaml"]);
  assert.deepEqual(checkFlows(root), []);
});

test("a filter naming no journey is refused by that name", (t) => {
  const root = pair(t);
  // Maestro refuses a workspace whose filter points at a file that is not there;
  // a gate that stayed quiet about it would let the run die on a device, forty
  // emulator minutes in, over a line `npm run check` could have read.
  config(root, "flows:\n  - index.yaml\n  - gone.yaml\n");
  assert.deepEqual(flowFiles(root), ["index.yaml"]);
  assert.deepEqual(checkFlows(root), [
    "config.yaml: flows names gone.yaml, which is no journey in e2e/flows",
    "app/other.tsx: no device flow names it",
  ]);
});

test("a workspace field the gate cannot apply is refused, not assumed", (t) => {
  const root = pair(t);
  // A tag lives in each flow's own header: a gate that read `tags:` and counted
  // the files beside it would be counting journeys the run filters out.
  config(root, "tags:\n  in:\n    - smoke\n");
  assert.deepEqual(checkFlows(root), [
    "config.yaml: tags is no workspace field this gate can read, so it cannot name the journeys Maestro plans",
  ]);
  // A filter that is neither a block list nor a flow list says nothing about the
  // plan, so the plan is refused rather than guessed at.
  config(root, "flows: index.yaml\n");
  assert.ok(
    checkFlows(root).some((p) => p.startsWith("config.yaml: flows is no list")),
    "a scalar filter is named, not applied as an exact name",
  );
  // An empty plan is the one thing a workspace can ask for that the gate can
  // still answer honestly: every screen of this tree loses its journey.
  config(root, "flows: []\n");
  assert.deepEqual(flowFiles(root), []);
  assert.deepEqual(workspacePlan(root).problems, []);
  assert.deepEqual(checkFlows(root), [
    "app/index.tsx: no device flow names it",
    "app/other.tsx: no device flow names it",
  ]);
});
