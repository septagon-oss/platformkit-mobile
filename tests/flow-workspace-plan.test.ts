import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { checkFlows, flowFiles, workspacePlan } from "../scripts/check_flows";

// `tests/flow-workspace-selection.test.ts` proves the invariant: a screen whose
// only journey is excluded from the plan is uncovered. These cases hold the edges
// of how that plan is built — that an inclusion narrows it, that a glob selects
// instead of refusing everything, that an entry naming no journey is named back,
// that a field the gate cannot read is refused rather than read as agreement, and
// which spellings of a selection the gate applies and which it refuses by name.

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

test("an exclusion no Maestro run applies is refused, not narrowed to", (t) => {
  const root = pair(t);
  assert.deepEqual(checkFlows(root), []);
  // Measured on the planner `maestro test e2e/flows` itself calls —
  // WorkspaceExecutionPlanner.plan (maestro-cli-2.8.0) with the CLI's own
  // arguments — a workspace whose configuration excludes index.yaml still plans
  // index.yaml, at either spelling of the list and beside a matching `flows:`.
  // So the gate keeps both journeys in every check below and names the line that
  // would otherwise have left a running flow unchecked.
  config(root, "excludeFlows:\n  - other.yaml\n");
  assert.deepEqual(flowFiles(root), ["index.yaml", "other.yaml"]);
  assert.deepEqual(checkFlows(root), [
    "config.yaml: excludeFlows is no field a Maestro run applies — maestro-cli-2.8.0's planner takes its journeys from flows: and reads no exclusion from this file, so what this line drops still runs; select what runs with flows: instead",
  ]);
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

test("the shape a selection is written in is part of what the gate reads", (t) => {
  const root = pair(t);
  // Maestro's own planner reads each of these as `flows: [index.yaml]` — every
  // one printed `PLANNED index.yaml` alone from
  // maestro.orchestra.workspace.WorkspaceExecutionPlanner (2.8.0) — so the gate
  // applies them, and other.yaml's claim is a screen no run reaches.
  for (const spelling of [
    '"flows": [index.yaml]\n',
    "flows : [index.yaml]\n",
    "\uFEFFflows: [index.yaml]\n",
    "flows:\n  - index.yaml\n",
    "flows:\n- index.yaml\n",
  ]) {
    config(root, spelling);
    assert.deepEqual(flowFiles(root), ["index.yaml"], spelling);
    assert.deepEqual(checkFlows(root), ["app/other.tsx: no device flow names it"], spelling);
  }
  // What the planner reads as one document, the gate may not guess at: a
  // whole-document flow mapping is refused with the file that holds it, and the
  // plan stays the whole directory, because a refusal is answerable and a partial
  // reading is not.
  config(root, "{flows: [index.yaml]}\n");
  assert.deepEqual(flowFiles(root), ["index.yaml", "other.yaml"]);
  assert.deepEqual(checkFlows(root), [
    'config.yaml: "{flows: [index.yaml]}" is no workspace key this gate can read: it applies a name at column zero with its list in [brackets] or as - items below it',
  ]);
  // A filter with no value after it is no filter at all: measured on the same
  // planner, `flows:` with nothing after it plans every journey in the directory,
  // so the gate leaves the plan alone instead of narrowing it to nothing.
  config(root, "flows:\nname: journeys\n");
  assert.deepEqual(flowFiles(root), ["index.yaml", "other.yaml"]);
  assert.deepEqual(checkFlows(root), []);
  // And a key written twice wins the way that parser lets it win: the last one.
  config(root, "flows: [index.yaml]\nflows: [other.yaml]\n");
  assert.deepEqual(flowFiles(root), ["other.yaml"]);
});
