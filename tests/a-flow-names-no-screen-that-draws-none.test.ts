// A route file the router never routes is a file no journey can ever name, so refusing it
// as uncovered would ask for a flow that lands on a screen that does not exist. expo-router
// reads `+html` and `+native-intent` as its own configuration and leaves them out of the
// route tree (getRoutesCore's ignore list), exactly as a layout composes screens without
// drawing one of its own — and a layout stays refused by name below, because its children's
// claims are what cover it.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows, routeFiles } from "../scripts/check_flows";

const STEPS = [
  "appId: ${APP_ID}",
  "env:",
  "  APP_ID: dev.septagon.platformkit.ci",
  "---",
  "- launchApp",
  "- assertVisible:",
  '    id: "home"',
];

test("a +-prefixed app file names no screen a journey could reach", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-mobile-native-intent-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (at: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, at)), { recursive: true });
    writeFileSync(path.join(root, at), text);
  };
  write("app/+native-intent.tsx", "export function redirectSystemPath() { return undefined; }\n");
  write("app/+html.tsx", "export default () => null;\n");
  write("app/index.tsx", 'export const Home = () => <View testID="home" />;\n');
  write("app/[module]/[entity]/[id]/index.tsx", "export default () => null;\n");
  write("e2e/flows/home.yaml", ["# screen: app/index.tsx", ...STEPS, ""].join("\n"));

  assert.deepEqual(routeFiles(root), ["app/[module]/[entity]/[id]/index.tsx", "app/index.tsx"]);
  assert.deepEqual(checkFlows(root), [
    "app/[module]/[entity]/[id]/index.tsx: no device flow names it",
  ]);
});
