import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows } from "../scripts/check_flows";

test("a yml journey run by Maestro must name the screen it proves", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-flow-extensions-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "app"));
  mkdirSync(path.join(root, "e2e/flows"), { recursive: true });
  writeFileSync(path.join(root, "app/index.tsx"), "export default () => null;\n");
  const body = "appId: ${APP_ID}\nenv:\n  APP_ID: dev.septagon.platformkit.ci\n---\n- launchApp\n";
  writeFileSync(path.join(root, "e2e/flows/home.yaml"), "# screen: app/index.tsx\n" + body);
  assert.deepEqual(checkFlows(root), []);
  // Maestro's directory planner accepts both YAML extensions.
  writeFileSync(path.join(root, "e2e/flows/extra.yml"), body);
  assert.deepEqual(checkFlows(root), ["extra.yml: names no screen"]);
});
