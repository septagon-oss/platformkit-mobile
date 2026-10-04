import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { checkFlows, routeFiles, screenClaims } from "../scripts/check_flows";

// A journey earns its place by naming the screen it proves, and the rule that
// keeps the set complete is scripts/check_flows.ts — the gate `npm run check`
// already runs. This test does not restate it: it builds the small trees the
// rule refuses and the one it accepts, and proves the gate answers for them.
// The last case is the completeness claim itself, over this checkout.

const APP_ID = "dev.septagon.platformkit.ci";

/** flow is a flow body that carries the package, one control the source sets, and whatever screens it claims. */
function flow(claims: readonly string[], id = "home"): string {
  return [
    "# What this journey proves, and the screens that belong to it.",
    ...claims.map((c) => `# screen: ${c}`),
    "appId: ${APP_ID}",
    "env:",
    `  APP_ID: ${APP_ID}`,
    "---",
    "- launchApp",
    "- assertVisible:",
    `    id: "${id}"`,
    "",
  ].join("\n");
}

/**
 * tree is a checkout small enough to reason about: four route files and a
 * layout, two flows that share the home screen — the account door is the home
 * screen's too — and one flow that claims two routes of its own.
 */
function tree(t: TestContext): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "pk-mobile-flow-coverage-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (at: string, text: string) => {
    const file = path.join(root, at);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  write("app/index.tsx", 'export const Home = () => <View testID="home" />;\n');
  write("app/_layout.tsx", "export default function Layout() { return null; }\n");
  write("app/x/y.tsx", "export const Y = () => null;\n");
  write("app/x/z.tsx", "export const Z = () => null;\n");
  write("e2e/flows/index.yaml", flow(["app/index.tsx"]));
  write("e2e/flows/account.yaml", flow(["app/index.tsx"]));
  write("e2e/flows/deep.yaml", flow(["app/x/y.tsx", "app/x/z.tsx"]));
  return root;
}

const flowOf = (root: string, name: string) => path.join(root, "e2e/flows", name);

test("a route screen is a .tsx under app/ and a layout is not one", (t) => {
  const root = tree(t);
  // app/_layout.tsx and e2e/flows/*.yaml are on disk and out of the list: the
  // layout draws no screen, and a flow is not a screen. A non-tsx file beside
  // a route is no route either.
  writeFileSync(path.join(root, "app", "notes.md"), "not a route\n");
  assert.deepEqual(routeFiles(root), ["app/index.tsx", "app/x/y.tsx", "app/x/z.tsx"]);
});

test("every screen named, every claim a route: the tree passes", (t) => {
  const root = tree(t);
  assert.deepEqual(checkFlows(root), []);
  // The exemption is proven while the layout is on disk, not by its absence.
  assert.ok(routeFiles(root).includes("app/index.tsx"));
  assert.ok(!routeFiles(root).includes("app/_layout.tsx"));
  assert.deepEqual(screenClaims(root).get("deep.yaml"), ["app/x/y.tsx", "app/x/z.tsx"]);
});

test("a screen no flow names is refused by name", (t) => {
  const root = tree(t);
  // deep.yaml keeps its other claim, so only the screen is at fault here.
  writeFileSync(flowOf(root, "deep.yaml"), flow(["app/x/y.tsx"]));
  assert.deepEqual(checkFlows(root), ["app/x/z.tsx: no device flow names it"]);
});

test("a flow that names no screen is refused: the rule reads both ways", (t) => {
  const root = tree(t);
  // Dropping the home claims leaves the screen uncovered and two flows that
  // say nothing about what they prove — both refusals, in route order first.
  writeFileSync(flowOf(root, "index.yaml"), flow([]));
  writeFileSync(flowOf(root, "account.yaml"), flow([]));
  assert.deepEqual(checkFlows(root), [
    "app/index.tsx: no device flow names it",
    "account.yaml: names no screen",
    "index.yaml: names no screen",
  ]);
});

test("a claim that is no route file is refused against the flow that wrote it", (t) => {
  const root = tree(t);
  // account.yaml still claims the real screen, so the tree is otherwise fine:
  // the only thing wrong is the path index.yaml points at.
  writeFileSync(flowOf(root, "index.yaml"), flow(["app/gone.tsx"]));
  assert.deepEqual(checkFlows(root), ["index.yaml: no route screen app/gone.tsx"]);
});

test("a route added without a journey is refused, not the flows beside it", (t) => {
  const root = tree(t);
  writeFileSync(path.join(root, "app", "settings.tsx"), "export default () => null;\n");
  assert.deepEqual(checkFlows(root), ["app/settings.tsx: no device flow names it"]);
});

test("this checkout names a flow for every one of its route screens", () => {
  assert.deepEqual(checkFlows(process.cwd()), []);
});
