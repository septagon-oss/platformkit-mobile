import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { ESLint } from "eslint";

const root = path.resolve(import.meta.dirname, "..");
const eslint = new ESLint({ cwd: root });

async function boundaries(file: string, source: string) {
  const [result] = await eslint.lintText(source, { filePath: path.join(root, file) });
  assert.ok(result);
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  return result.messages.filter(
    (message) =>
      message.ruleId === "no-restricted-imports" || message.ruleId === "no-restricted-syntax",
  );
}

test("atoms and molecules cannot depend on an organism or a screen layout", async () => {
  for (const file of ["src/ui/atoms/Probe.tsx", "src/ui/molecules/Probe.tsx"]) {
    for (const source of [
      'export { ResourceList } from "../organisms/ResourceList";',
      'export { Screen } from "../templates/Screen";',
      'export { Gallery } from "../gallery";',
    ]) {
      assert.ok((await boundaries(file, source)).length > 0, `${file}: ${source}`);
    }
  }
  assert.ok(
    (await boundaries("src/ui/atoms/Probe.tsx", 'export { Row } from "../molecules/Row";')).length >
      0,
  );
});

test("layout templates and shared theme helpers stay independent of organisms", async () => {
  for (const [file, source] of [
    ["src/ui/templates/Probe.tsx", 'export { Home } from "../organisms/Home";'],
    ["src/ui/templates/Probe.tsx", 'export { Gallery } from "../gallery";'],
    ["src/ui/theme.tsx", 'export { Text } from "./atoms/Text";'],
    ["src/ui/scale.ts", 'export { Row } from "./molecules/Row";'],
    ["src/ui/tokens.ts", 'export { Screen } from "./templates/Screen";'],
    ["src/ui/chooser.ts", 'export { Home } from "./organisms/Home";'],
  ]) {
    assert.ok((await boundaries(file!, source!)).length > 0, `${file}: ${source}`);
  }
});

test("native screens compose organisms, and organisms compose rows and layout primitives", async () => {
  for (const [file, source] of [
    ["src/ui/atoms/Probe.tsx", 'export { Text } from "./Text";'],
    ["src/ui/atoms/Probe.tsx", 'export { useTheme } from "../theme";'],
    ["src/ui/molecules/Probe.tsx", 'export { Text } from "../atoms/Text";'],
    ["src/ui/templates/Probe.tsx", 'export { Skeleton } from "../atoms/Skeleton";'],
    ["src/ui/organisms/Probe.tsx", 'export { Row } from "../molecules/Row";'],
    ["src/ui/organisms/Probe.tsx", 'export { ListScreen } from "../templates/ListScreen";'],
    ["src/ui/gallery.tsx", 'export { Button } from "./atoms/Button";'],
    ["src/screens/Probe.tsx", 'export { ResourceList } from "../ui/organisms/ResourceList";'],
    ["src/screens/Probe.tsx", 'export { useShell } from "../shell";'],
  ]) {
    assert.deepEqual(await boundaries(file!, source!), [], `${file}: ${source}`);
  }
});

test("layer rules retain the UI effect boundary and the route composition boundary", async () => {
  for (const layer of ["atoms", "molecules", "organisms", "templates"]) {
    const file = `src/ui/${layer}/Probe.tsx`;
    for (const source of [
      'export { useShell } from "../../shell";',
      'export { ApiError } from "../../effects/api";',
      'export { useRouter } from "expo-router";',
    ]) {
      assert.ok((await boundaries(file, source)).length > 0, `${file}: ${source}`);
    }
  }
  assert.ok(
    (await boundaries("app/probe.tsx", 'export { Text } from "../src/ui/atoms/Text";')).length > 0,
  );
});

test("aliases, typed re-exports and dynamic imports cannot hide an upward dependency", async () => {
  for (const source of [
    'export { Row } from "@/ui/molecules/Row";',
    'export type { Props } from "../organisms/Home";',
    'export { ResourceList } from "../organisms/ResourceList.tsx";',
    'export const load = () => import("../organisms/Home");',
  ]) {
    assert.ok((await boundaries("src/ui/atoms/Probe.tsx", source)).length > 0, source);
  }
});
