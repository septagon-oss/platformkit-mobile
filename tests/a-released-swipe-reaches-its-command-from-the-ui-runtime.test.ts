// A native row's drag is read and released on the UI runtime: the gesture callbacks are worklets,
// and whatever they call synchronously must be callable there. This compiles the real surface with
// the app's native Babel preset, serializes its gesture callbacks through the installed Worklets
// serializer and unpackers, and drives one armed, released drag: the threshold's tick and the
// command must both reach the React Native runtime. The JS gesture double cannot see this boundary.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { createContext, runInContext, type Context } from "node:vm";
import { transformFileSync } from "@babel/core";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const worklets = path.dirname(require.resolve("react-native-worklets/package.json"));
const caller = { name: "metro", platform: "android", isDev: true, supportsStaticESM: false };
type Fn = (...args: unknown[]) => unknown;
type Modules = Readonly<Record<string, unknown>>;
const same = (value: unknown) => value;

function evaluate<T>(runtime: Context, code: string, dependencies: Modules = {}): T {
  const exported = {};
  const load = (name: string) => {
    if (name.startsWith("@babel/runtime/")) return require(name);
    assert.ok(Object.hasOwn(dependencies, name), `unprovided dependency ${name}`);
    return dependencies[name];
  };
  const execute = runInContext(`(function(exports, require) { ${code}\n})`, runtime) as (
    exports: object,
    require: (name: string) => unknown,
  ) => void;
  execute(exported, load);
  return exported as T;
}

/** The installed library's own plumbing, transpiled without the worklet transform. */
function plain<T>(runtime: Context, relative: string, dependencies?: Modules): T {
  const source = readFileSync(path.join(worklets, "src", relative), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return evaluate<T>(runtime, code, dependencies);
}

/** A file as Metro hands it to an Android build: the app's Babel preset, worklet transform included. */
function native<T>(runtime: Context, file: string, dependencies?: Modules): T {
  const compiled = transformFileSync(file, { caller, envName: "development", cwd: root, root });
  assert.ok(compiled?.code);
  return evaluate<T>(runtime, compiled.code, dependencies);
}

/**
 * Two runtimes, as on a phone: the React Native one renders the row and serializes its worklets,
 * the UI one unpacks and calls them. Only the native value bridge is stood in for; classification,
 * unpacking, the remote-function refusal and `runOnJS`/`scheduleOnRN` are the installed library's.
 */
function phone() {
  const rn = createContext({
    __DEV__: false,
    __RUNTIME_NAME: "RN",
    __RUNTIME_KIND: 1,
    queueMicrotask,
  });
  rn.global = rn;
  const ui = createContext({ __DEV__: false, __RUNTIME_NAME: "UI", __RUNTIME_KIND: 2 });
  ui.global = ui;
  plain<{ installRemoteFunctionUnpacker: () => void }>(
    ui,
    "memory/remoteFunctionUnpacker.native.ts",
  ).installRemoteFunctionUnpacker();
  plain<{ installValueUnpacker: () => void }>(
    ui,
    "memory/valueUnpacker.native.ts",
  ).installValueUnpacker();

  // What a remote function stands for on the React Native side, and what the UI side asked it to run.
  const remotes = new Map<unknown, Fn>();
  const scheduled: (() => void)[] = [];
  ui.__serializer = (value: unknown) => value;
  ui.__workletsModuleProxy = {
    scheduleOnRN: (fun: Fn, args?: unknown[]) => {
      const original = remotes.get(fun) ?? fun;
      scheduled.push(() => original(...(args ?? [])));
    },
  };

  const runtimeKind = native(rn, path.join(worklets, "src/runtimeKind.ts"));
  const workletFunction = native(rn, path.join(worklets, "src/workletFunction.ts"));
  const WorkletsModule = {
    createSerializableString: same,
    createSerializableNumber: same,
    createSerializableBoolean: same,
    createSerializableUndefined: () => undefined,
    createSerializableNull: () => null,
    createSerializableObject: same,
    createSerializableArray: same,
    createSerializableHostObject: same,
    createSerializableWorklet: (props: unknown) => (ui.__valueUnpacker as Fn)(props),
    createSerializableNonWorkletFunction: (fn: Fn, name: string) => {
      const remote = (ui.__remoteFunctionUnpacker as Fn)(name);
      remotes.set(remote, fn);
      return remote;
    },
  };
  const serializer = plain<{ createSerializable: <T>(value: T) => T }>(
    rn,
    "memory/serializable.native.ts",
    {
      "../debug/errors": {},
      "../debug/jsVersion": {},
      "../debug/logger": {},
      "../runtimeKind": runtimeKind,
      "../workletFunction": workletFunction,
      "../WorkletsModule/NativeWorklets": { WorkletsModule },
      "./isSynchronizable": plain(rn, "memory/isSynchronizable.ts"),
      "./serializableMappingCache": plain(rn, "memory/serializableMappingCache.native.ts"),
    },
  );
  const threads = native<Record<string, unknown>>(
    rn,
    path.join(worklets, "src/threads.native.ts"),
    {
      "./featureFlags/featureFlags": { getStaticFeatureFlag: () => false },
      "./guardImplementation": { addNoBundleModeGuardImplementation: () => undefined },
      "./memory/serializable": serializer,
      "./runtimeKind": runtimeKind,
      "./workletFunction": workletFunction,
      "./WorkletsModule/NativeWorklets": { WorkletsModule },
    },
  );
  const flush = () => {
    while (scheduled.length > 0) scheduled.shift()!();
  };
  return { rn, serializer, threads, flush };
}

/** The real RowSwipe, rendered once on the React Native runtime with its gesture recorded. */
function swipeRow(onRun: () => void) {
  const { rn, serializer, threads, flush } = phone();
  const ticks: unknown[] = [];
  const handlers: Record<string, Fn> = {};
  let onJS = false;
  const pan: Record<string, unknown> = new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        (...args: unknown[]) => {
          if (name === "runOnJS") onJS = args[0] === true;
          else if (name.startsWith("on") && typeof args[0] === "function")
            handlers[name] = args[0] as Fn;
          return pan;
        },
    },
  );
  // A shared value is one cell both runtimes see; the bridge passes host objects by identity.
  const shared = (value: unknown) => new Proxy({ value }, { has: () => true });
  // reanimated's withTiming is a worklet; this one has the shape the plugin gives a worklet, is made
  // on the React Native runtime like every value the release captures, and settles at once.
  const withTiming = runInContext(
    `(() => {
      const withTiming = (toValue) => toValue;
      withTiming.__closure = {};
      withTiming.__workletHash = 1;
      withTiming.__initData = { code: "function withTiming(toValue) { return toValue; }" };
      return withTiming;
    })()`,
    rn,
  ) as Fn;
  const reanimated = {
    ...threads,
    __esModule: true,
    default: { View: "Animated.View" },
    useSharedValue: shared,
    useAnimatedStyle: () => ({}),
    withTiming,
  };
  const scale = native<{ swipe: { reveal: number } }>(rn, path.join(root, "src/ui/scale.ts"), {
    "react-native": {
      Platform: { OS: "android", select: (o: Record<string, unknown>) => o.android ?? o.default },
    },
    "../core/illustrations": { illustrationStroke: 1 },
  });
  const element = (type: unknown, props: unknown) => ({ type, props });
  const { RowSwipe } = native<{ RowSwipe: Fn }>(rn, path.join(root, "src/screens/RowSwipe.tsx"), {
    react: {
      __esModule: true,
      default: {},
      useCallback: (fn: Fn) => fn,
      useMemo: (fn: Fn) => fn(),
      useRef: (current: unknown) => ({ current }),
    },
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "Fragment" },
    "react-native": { StyleSheet: { create: same }, View: "View" },
    "react-native-gesture-handler": {
      Gesture: { Pan: () => pan },
      GestureDetector: "GestureDetector",
    },
    "react-native-reanimated": reanimated,
    "react-native-worklets": threads,
    "expo-haptics": {
      ImpactFeedbackStyle: { Light: "light" },
      NotificationFeedbackType: { Success: "success" },
      impactAsync: async (style: unknown) => void ticks.push(style),
    },
    "../core/gesture": native(rn, path.join(root, "src/core/gesture.ts")),
    "../ui/atoms/Icon": { Icon: "Icon" },
    "../ui/atoms/Text": { Text: "Text" },
    "../ui/scale": scale,
    "../ui/theme": { useStyles: () => ({}) },
  });
  RowSwipe({
    action: { verb: "resolve", label: "Resolve", destructive: false },
    motion: "normal",
    onRun,
    children: null,
  });
  // A callback the plugin made a worklet runs on the UI runtime, as the recogniser runs it; one the
  // row asks to keep on the JS thread is called where it was made.
  const on = (name: string): Fn => {
    const handler = handlers[name];
    assert.ok(handler, `the row's gesture has no ${name}`);
    if (onJS || !(handler as unknown as { __workletHash?: number }).__workletHash) return handler;
    return serializer.createSerializable(handler);
  };
  return { on, ticks, reveal: scale.swipe.reveal, flush };
}

const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test("a drag past the threshold asks for its tick from the UI runtime", async () => {
  const row = swipeRow(() => undefined);
  const past = -(row.reveal + 8);
  row.on("onBegin")({ translationX: 0 });
  row.on("onUpdate")({ translationX: past });
  row.on("onUpdate")({ translationX: past - 4 });
  row.flush();
  await settled();
  assert.deepEqual(row.ticks, ["light"]);
});

test("a released armed drag runs its command from the UI runtime", async () => {
  let runs = 0;
  const row = swipeRow(() => {
    runs += 1;
  });
  const past = -(row.reveal + 8);
  row.on("onBegin")({ translationX: 0 });
  row.on("onUpdate")({ translationX: past });
  row.on("onEnd")({ translationX: past }, true);
  row.on("onFinalize")({ translationX: past }, true);
  row.flush();
  await settled();
  assert.equal(runs, 1);
});
