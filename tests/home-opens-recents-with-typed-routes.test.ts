// Home must compile with the route declarations Expo generates when this app
// starts. Generate them with Expo's own scanner in memory so a clean checkout
// and a checkout whose developer already started Metro check the same contract.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import type { RequireContext } from "expo-router";
import ts from "typescript";

const require = createRequire(import.meta.url);
const expo = createRequire(require.resolve("expo/package.json"));
const cli = createRequire(expo.resolve("@expo/cli/package.json"));
const { requireContext } = require("expo-router/internal/testing") as {
  requireContext: (directory: string) => RequireContext;
};
const { getTypedRoutesDeclarationFile } = cli(
  "@expo/router-server/build/typed-routes/generate",
) as {
  getTypedRoutesDeclarationFile: (context: RequireContext) => string;
};

test("Home can open remembered records with the app's generated typed routes", () => {
  const root = process.cwd();
  const declaration = getTypedRoutesDeclarationFile(requireContext(path.join(root, "app")));
  assert.ok(declaration.includes("pathname: `/[module]/[entity]/[id]`"));
  const read = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  assert.equal(read.error, undefined);
  const config = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  assert.deepEqual(config.errors, []);

  const home = path.join(root, "src/screens/Home.tsx");
  const declarations = path.join(root, ".expo/types/router.d.ts");
  const host = ts.createCompilerHost(config.options);
  const source = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) =>
    file === declarations
      ? ts.createSourceFile(file, declaration, ts.ScriptTarget.Latest, true)
      : source(file, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([home, declarations], config.options, host);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .filter((diagnostic) => diagnostic.file?.fileName === home)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  assert.deepEqual(errors, [], "Home accepts the router declarations its own startup generates");
});
