// A native gesture calls the shared swipe reading synchronously on the UI runtime. Compile it
// with the app's native Babel preset, then use the installed Worklets serializer and unpackers;
// the JS gesture double cannot expose a function that cannot cross that runtime boundary.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import { transformFileSync } from "@babel/core";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const worklets = path.dirname(require.resolve("react-native-worklets/package.json"));
type Reading = (travel: number, reveal: number) => { open: number; armed: boolean };

test("the shared swipe reading stays synchronous after native worklet serialization", () => {
  const runtime = createContext({ __DEV__: false, __RUNTIME_NAME: "UI" });
  runtime.global = runtime;

  function evaluate<T>(code: string, dependencies: Readonly<Record<string, unknown>> = {}): T {
    const exported = {};
    const load = (name: string) => {
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

  function installed<T>(relative: string, dependencies?: Readonly<Record<string, unknown>>): T {
    const source = readFileSync(path.join(worklets, "src", relative), "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return evaluate<T>(code, dependencies);
  }

  installed<{ installRemoteFunctionUnpacker: () => void }>(
    "memory/remoteFunctionUnpacker.native.ts",
  ).installRemoteFunctionUnpacker();
  installed<{ installValueUnpacker: () => void }>(
    "memory/valueUnpacker.native.ts",
  ).installValueUnpacker();

  // Stand in only for the native value bridge. Function classification, serialization and
  // invocation use the pinned library's own code, including its remote-function refusal.
  const same = (value: unknown) => value;
  const serializer = installed<{ createSerializable: (fn: Reading) => Reading }>(
    "memory/serializable.native.ts",
    {
      "../debug/errors": {},
      "../debug/jsVersion": {},
      "../debug/logger": {},
      "../runtimeKind": { RuntimeKind: { ReactNative: 0 } },
      "../workletFunction": installed("workletFunction.ts"),
      "../WorkletsModule/NativeWorklets": {
        WorkletsModule: {
          createSerializableString: same,
          createSerializableNumber: same,
          createSerializableBoolean: same,
          createSerializableUndefined: () => undefined,
          createSerializableObject: same,
          createSerializableWorklet: (props: unknown) => runtime.__valueUnpacker(props),
          createSerializableNonWorkletFunction: (_fn: unknown, name: string) =>
            runtime.__remoteFunctionUnpacker(name),
        },
      },
      "./isSynchronizable": installed("memory/isSynchronizable.ts"),
      "./serializableMappingCache": installed("memory/serializableMappingCache.native.ts"),
    },
  );

  const caller = { name: "metro", platform: "android", isDev: true, supportsStaticESM: false };
  const compiled = transformFileSync(path.join(root, "src/core/gesture.ts"), {
    caller,
    envName: "development",
  });
  assert.ok(compiled?.code);
  const { readSwipe } = evaluate<{ readSwipe: Reading }>(compiled.code);
  const onUI = serializer.createSerializable(readSwipe);
  const below = onUI(31, 72);
  assert.equal(below.open, 31);
  assert.equal(below.armed, false);
  const threshold = onUI(72, 72);
  assert.equal(threshold.open, 72);
  assert.equal(threshold.armed, true);
});
