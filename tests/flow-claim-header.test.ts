import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkFlows } from "../scripts/check_flows";

// A flow says which screen it proves in its header comment, above the
// configuration and the `---` that starts its steps. A `# screen:` line among
// the steps is a remark about one step, not the flow's claim, so it does not
// count a screen as covered.

test("a screen claim below the flow's header does not cover the screen", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-mobile-flow-claim-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (at: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, at)), { recursive: true });
    writeFileSync(path.join(root, at), text);
  };
  write("app/index.tsx", 'export const Home = () => <View testID="home" />;\n');
  write("app/gallery.tsx", "export default () => null;\n");
  const steps = [
    "appId: ${APP_ID}",
    "env:",
    "  APP_ID: dev.septagon.platformkit.ci",
    "---",
    "- launchApp",
    "- assertVisible:",
    '    id: "home"',
  ];
  write("e2e/flows/gallery.yaml", ["# screen: app/gallery.tsx", ...steps, ""].join("\n"));
  write(
    "e2e/flows/home.yaml",
    ["# screen: app/gallery.tsx", ...steps, "# screen: app/index.tsx", ""].join("\n"),
  );
  assert.deepEqual(checkFlows(root), ["app/index.tsx: no device flow names it"]);
});
