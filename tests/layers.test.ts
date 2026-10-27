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
      'export { Section } from "@septagon-oss/platformkit-mobile/ui/molecules/Section";',
    ],
    [
      "src/ui/organisms/Probe.tsx",
      'export { useShell } from "@septagon-oss/platformkit-mobile/shell";',
    ],
    [
      "src/core/probe.ts",
      'export { ApiError } from "@septagon-oss/platformkit-mobile/effects/api";',
    ],
    ["app/probe.tsx", 'export { Button } from "@septagon-oss/platformkit-mobile/ui/atoms/Button";'],
  ]) {
    assert.ok((await boundaries(file!, source!)).length > 0, `${file}: ${source}`);
  }
  for (const [file, source] of [
    [
      "src/ui/molecules/Probe.tsx",
      'export { Button } from "@septagon-oss/platformkit-mobile/ui/atoms/Button";',
    ],
    [
      "src/ui/organisms/Probe.tsx",
      'export { useTheme } from "@septagon-oss/platformkit-mobile/ui/theme";',
    ],
    ["src/screens/Probe.tsx", 'export { useShell } from "@septagon-oss/platformkit-mobile/shell";'],
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
      'export { render } from "@septagon-oss/platformkit-mobile/tools/tokens";',
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
    'export { createApi } from "@septagon-oss/platformkit-mobile/effects/api";',
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

test("generated schemas are pure but generated transports stay behind effect boundaries", async () => {
  for (const file of ["src/core/example.ts", "src/ui/atoms/Example.tsx", "app/example.tsx"]) {
    for (const source of [
      'export { authMe } from "@/generated/sdk.gen";',
      'export { createClient } from "@/generated/client";',
      'export { authMe } from "@septagon-oss/platformkit-mobile/generated";',
    ])
      assert.ok((await boundaries(file, source)).length > 0, `${file}: ${source}`);
  }
  assert.deepEqual(
    await boundaries("src/core/example.ts", 'export { zCatalog } from "@/generated/zod.gen";'),
    [],
  );
});

test("the pack door belongs to the declarer, and the generated key map to the contract", async () => {
  // src/pack.ts is where a product declares a pack: a read, a policy binding and the
  // screens that draw them. A core function that declared one would know React, and a
  // UI layer that declared one would own a read — both are props those layers are handed.
  // The generated key map is reached only by the two files that name a key or a read.
  for (const [file, source] of [
    ["src/core/probe.ts", 'export { definePack } from "../pack";'],
    ["src/core/probe.ts", 'export { entryReads } from "../generated/entries.gen";'],
    ["src/ui/atoms/Probe.tsx", 'export { definePack } from "../pack";'],
    ["src/ui/atoms/Probe.tsx", 'export { entryReads } from "../../generated/entries.gen";'],
  ]) {
    assert.ok((await boundaries(file!, source!)).length > 0, `${file}: ${source}`);
  }
  for (const [file, source] of [
    ["src/pack.ts", 'export { entryReads } from "./generated/entries.gen";'],
    ["src/renderers.ts", 'export type { EntryKey } from "./generated/entries.gen";'],
  ]) {
    assert.deepEqual(await boundaries(file!, source!), [], source!);
  }
});

test("an example pack is composed by no route and reads its data through useOperation", async () => {
  // src/examples holds the kit's example of a renderer pack. Nothing composes
  // it — a product's own pack lives with the product — and it reaches the pinned
  // document through the pack contract rather than by holding the transport, so
  // the screen it demonstrates is the screen a product can actually copy.
  for (const [file, source] of [
    ["src/screens/Probe.tsx", 'export { taskRenderers } from "../examples/taskRenderers";'],
    ["src/route.tsx", 'export { taskRenderers } from "./examples/taskRenderers";'],
    ["app/probe.tsx", 'export { taskRenderers } from "../src/examples/taskRenderers";'],
    [
      "app/probe.tsx",
      'export { taskRenderers } from "@septagon-oss/platformkit-mobile/examples/taskRenderers";',
    ],
    ["src/examples/probe.tsx", 'export { createClient } from "../generated/client";'],
    ["src/examples/probe.tsx", 'export { ApiError } from "../effects/api";'],
    [
      "src/examples/probe.tsx",
      'export { api } from "@septagon-oss/platformkit-mobile/effects/api";',
    ],
  ]) {
    assert.ok((await boundaries(file!, source!)).length > 0, `${file}: ${source!}`);
  }
  for (const source of [
    'export { taskRenderers } from "@septagon-oss/platformkit-mobile/examples/taskRenderers";',
    'export { taskRenderers } from "../examples/taskRenderers";',
  ]) {
    assert.deepEqual(await boundaries("tests/screens/probe.test.tsx", source), [], source);
  }
  for (const source of [
    'export { useOperation } from "../screens/useOperation";',
    'export { Actions } from "../ui/organisms/Actions";',
    'export { zCatalog } from "../generated/zod.gen";',
  ]) {
    assert.deepEqual(await boundaries("src/examples/probe.tsx", source), [], source);
  }
});

test("a core door exposes its index and nothing under it", async () => {
  // src/core is five doors: list, record, form, command, present. A consumer — a
  // screen, a pack, the deprecated barrel, or a sibling door — enters through the
  // index, so a rule reads one way from one path and a door may regroup its own part
  // files without telling anyone.
  for (const [file, source] of [
    ["src/screens/Probe.tsx", 'export { listRow } from "../core/list/rows";'],
    ["src/screens/Probe.tsx", 'export { values } from "../../core/form/values";'],
    [
      "src/screens/Probe.tsx",
      'export { values } from "@septagon-oss/platformkit-mobile/core/form/values";',
    ],
    ["src/ui/organisms/Probe.tsx", 'export { controlPointers } from "../../core/form/values";'],
    ["src/core/form/values.ts", 'export { listRow } from "../list/rows";'],
    ["src/core/derive.ts", 'export { listRow } from "./list/rows";'],
  ]) {
    assert.ok((await boundaries(file!, source!)).length > 0, `${file}: ${source!}`);
  }
  for (const [file, source] of [
    ["src/screens/Probe.tsx", 'export { listRow } from "../core/list";'],
    ["src/core/form/values.ts", 'export { Control } from "./controls";'],
    ["src/core/form/values.ts", 'export { label } from "../present";'],
    ["src/core/derive.ts", 'export { listRow } from "./list";'],
    ["src/screens/Probe.tsx", 'export { deriveDeck } from "../core/derive";'],
    ["src/screens/Probe.tsx", 'export { noun } from "../core/record";'],
  ]) {
    assert.deepEqual(await boundaries(file!, source!), [], `${file}: ${source}`);
  }
});

test("the kit's gallery fixtures stay out of the doors and out of the product", async () => {
  // stateGallery, kitGallery, kitScenes and galleryPages are what src/ui/gallery.tsx
  // draws. A door that carried them would ship the kit's examples inside the surface
  // a product imports.
  for (const [file, source] of [
    ["src/core/list/rows.ts", 'export { kitExamples } from "../kitGallery";'],
    ["src/screens/Probe.tsx", 'export { sceneFor } from "../core/kitScenes";'],
    ["src/ui/organisms/Probe.tsx", 'export { stateExamples } from "../../core/stateGallery";'],
    ["src/shell.tsx", 'export { galleryPage } from "./core/galleryPages";'],
  ]) {
    assert.ok((await boundaries(file!, source!)).length > 0, `${file}: ${source!}`);
  }
  assert.deepEqual(
    await boundaries("src/ui/gallery.tsx", 'export { kitExamples } from "../core/kitGallery";'),
    [],
  );
  assert.deepEqual(
    await boundaries(
      "src/core/derive.ts",
      'export { kitExamples } from "./kitGallery";\nexport { listRow } from "./list/rows";',
    ).then((messages) => messages.length),
    1,
    "the barrel publishes the fixtures for the window and still may not read a door's part",
  );
});
