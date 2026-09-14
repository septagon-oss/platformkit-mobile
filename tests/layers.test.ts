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
      message.ruleId === "no-restricted-imports" ||
      message.ruleId === "no-restricted-syntax" ||
      message.ruleId === "no-restricted-globals",
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

test("package subpaths preserve the same atomic and effect boundaries", async () => {
  for (const [file, source] of [
    [
      "src/ui/atoms/Probe.tsx",
      'export { Section } from "platformkit-mobile/ui/molecules/Section";',
    ],
    ["src/ui/organisms/Probe.tsx", 'export { useShell } from "platformkit-mobile/shell";'],
    ["src/core/probe.ts", 'export { ApiError } from "platformkit-mobile/effects/api";'],
    ["app/probe.tsx", 'export { Button } from "platformkit-mobile/ui/atoms/Button";'],
  ]) {
    assert.ok((await boundaries(file!, source!)).length > 0, `${file}: ${source}`);
  }
  for (const [file, source] of [
    ["src/ui/molecules/Probe.tsx", 'export { Button } from "platformkit-mobile/ui/atoms/Button";'],
    ["src/ui/organisms/Probe.tsx", 'export { useTheme } from "platformkit-mobile/ui/theme";'],
    ["src/screens/Probe.tsx", 'export { useShell } from "platformkit-mobile/shell";'],
  ]) {
    assert.deepEqual(await boundaries(file!, source!), [], `${file}: ${source}`);
  }
});

test("native runtime layers cannot import the packaged token generator or Node tools", async () => {
  for (const file of [
    "src/core/probe.ts",
    "src/effects/probe.ts",
    "src/shell.tsx",
    "src/ui/theme.tsx",
    "app/probe.tsx",
  ]) {
    for (const source of [
      'export { render } from "platformkit-mobile/tools/tokens";',
      'export { render } from "../scripts/tokens";',
      'export { readFile } from "node:fs/promises";',
      'export { readFile } from "fs/promises";',
    ]) {
      assert.ok((await boundaries(file, source)).length > 0, `${file}: ${source}`);
    }
  }
});

test("the route dispatcher composes screens from the catalog and performs no effect", async () => {
  for (const source of [
    'export { ApiError } from "./effects/api";',
    'export { sessions } from "./effects/native-session";',
    'export { createApi } from "platformkit-mobile/effects/api";',
  ]) {
    assert.ok((await boundaries("src/route.tsx", source)).length > 0, source);
  }
  for (const source of [
    'export { key } from "./core/catalog";',
    'export { humanize } from "./core/derive";',
    'export { ResourceList } from "./screens/ResourceList";',
    'export { Screen } from "./ui/templates/Screen";',
  ]) {
    assert.deepEqual(await boundaries("src/route.tsx", source), [], source);
  }
  // An app route still may not reach for core; the dispatcher does that for it.
  assert.ok(
    (await boundaries("app/probe.tsx", 'export { key } from "../src/core/catalog";')).length > 0,
  );
});

test("effects may use the secure store and nothing else of Expo, the bare package included", async () => {
  for (const source of [
    'export * as Expo from "expo";',
    'export { fetch as expoFetch } from "expo/fetch";',
    'export { default as Constants } from "expo-constants";',
    'export * as Haptics from "expo-haptics";',
    'export { default as Ionicons } from "@expo/vector-icons/Ionicons";',
    'export { Platform } from "react-native";',
  ]) {
    assert.ok((await boundaries("src/effects/probe.ts", source)).length > 0, source);
  }
  assert.deepEqual(
    await boundaries("src/effects/probe.ts", 'export * as SecureStore from "expo-secure-store";'),
    [],
  );
});

test("the transport is named once, in effects; everywhere else speaks through an Api", async () => {
  for (const [file, source] of [
    ["src/shell.tsx", "export const api = createApi(url, fetch);"],
    ["src/screens/Probe.tsx", 'export const read = () => fetch("/api/v1/x");'],
    ["src/ui/atoms/Probe.tsx", "export const socket = new WebSocket(url);"],
    ["app/probe.tsx", "export const xhr = new XMLHttpRequest();"],
  ]) {
    assert.ok((await boundaries(file!, source!)).length > 0, `${file}: ${source}`);
  }
  assert.deepEqual(
    await boundaries("src/effects/probe.ts", "export const transport: typeof fetch = fetch;"),
    [],
  );
});
