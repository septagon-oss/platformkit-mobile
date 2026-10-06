import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows } from "../scripts/check_flows";

// YAML spells one key several ways. Maestro's workspace planner reads each of
// these as `flows: [index.yaml]` and plans index.yaml alone, so other.yaml runs
// nowhere. The gate either applies that selection (app/other.tsx is uncovered)
// or refuses the configuration it could not read (it names config.yaml).
const SPELLINGS: Record<string, string> = {
  "a quoted key": '"flows": [index.yaml]\n',
  "a space before the colon": "flows : [index.yaml]\n",
  "a byte-order mark before the key": "﻿flows: [index.yaml]\n",
  "a flow mapping": "{flows: [index.yaml]}\n",
};

for (const [spelling, text] of Object.entries(SPELLINGS))
  test(`a workspace selection spelled with ${spelling} is applied or refused`, (t) => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-key-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(path.join(root, "app"));
    mkdirSync(path.join(root, "e2e/flows"), { recursive: true });
    const body =
      "appId: ${APP_ID}\nenv:\n  APP_ID: dev.septagon.platformkit.ci\n---\n- launchApp\n";
    for (const name of ["index", "other"]) {
      writeFileSync(path.join(root, `app/${name}.tsx`), "export default () => null;\n");
      writeFileSync(
        path.join(root, `e2e/flows/${name}.yaml`),
        `# screen: app/${name}.tsx\n${body}`,
      );
    }
    assert.deepEqual(checkFlows(root), []);

    writeFileSync(path.join(root, "e2e/flows/config.yaml"), text);
    const problems = checkFlows(root);
    assert.ok(
      problems.some((p) => p.includes("app/other.tsx") || p.includes("config.yaml")),
      `Maestro plans index.yaml alone, but the gate accepts other.yaml's claim: ${JSON.stringify(problems)}`,
    );
  });
