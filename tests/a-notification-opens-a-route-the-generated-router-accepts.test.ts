// The notification tap compiles against the same route declarations Expo generates when
// this app starts. The check is scoped to the handler, independent of other screen errors.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli"));
const { getTypedRoutesDeclarationFile } = cliRequire(
  "@expo/router-server/build/typed-routes/generate",
);
const { requireContext } = require("expo-router/internal/testing");
const { EXPO_ROUTER_CTX_IGNORE } = require("expo-router/_ctx-shared");

test("a notification tap accepts the router types generated from the app's route files", () => {
  const declarations: string = getTypedRoutesDeclarationFile(
    requireContext(path.join(root, "app"), true, EXPO_ROUTER_CTX_IGNORE),
  );
  const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const { options, errors } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  assert.deepEqual(errors, []);
  const handler = path.join(root, "src/screens/PushTravel.tsx");
  const routeTypes = path.join(root, ".expo/types/notification-routes.d.ts");
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host);
  const exists = host.fileExists.bind(host);
  host.readFile = (file) => (file === routeTypes ? declarations : read(file));
  host.fileExists = (file) => file === routeTypes || exists(file);
  const program = ts.createProgram([handler, routeTypes], options, host);
  const source = program.getSourceFile(handler);
  assert.ok(source, "The notification handler must be loaded by the compiler.");
  const diagnostics = ts.getPreEmitDiagnostics(program, source);
  assert.deepEqual(
    diagnostics.map((d) => `${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`),
    [],
    "A notification tap must compile after Expo has generated this app's typed routes.",
  );
});
