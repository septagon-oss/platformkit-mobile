import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

test("a packed dependency resolves the shared composition and atomic layers without a checkout", (t) => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "pk-mobile-package-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  type Packed = { filename: string; files: { path: string }[] };
  const result = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary], {
      cwd: root,
      encoding: "utf8",
    }),
  ) as Packed[] | Record<string, Packed>;
  // npm 12 keys the pack report by package name; earlier versions return an array.
  const packed = Array.isArray(result) ? result[0] : result["platformkit-mobile"];
  assert.ok(packed);
  const installed = path.join(temporary, "node_modules/platformkit-mobile");
  mkdirSync(installed, { recursive: true });
  execFileSync("tar", [
    "-xzf",
    path.join(temporary, packed.filename),
    "--strip-components=1",
    "-C",
    installed,
  ]);
  const require = createRequire(path.join(temporary, "consumer.cjs"));
  const names = [
    "core/catalog",
    "core/derive",
    "effects/api",
    "renderers",
    "route",
    "shell",
    "tools/tokens",
    "tools/android",
    "screens/Home",
    "screens/SignIn",
    "screens/ResourceDetail",
    "ui/theme",
    "ui/scale",
    "ui/atoms/Button",
    "ui/atoms/Text",
    "ui/molecules/Section",
    "ui/organisms/ResourceDetail",
    "ui/templates/Screen",
  ];
  for (const name of names) {
    const resolved = require.resolve(`platformkit-mobile/${name}`);
    assert.ok(resolved.startsWith(installed + path.sep), name);
    assert.ok(existsSync(resolved), name);
  }
  for (const name of [
    "src/shell",
    "effects/native-session",
    "screens/useResourceDetail",
    "app/_layout",
  ]) {
    assert.throws(() => require.resolve(`platformkit-mobile/${name}`), name);
  }
  const files = new Set(packed.files.map((file) => file.path));
  const dependencies = Object.keys(
    JSON.parse(readFileSync(path.join(installed, "package.json"), "utf8")).dependencies,
  );
  assert.ok(files.has("src/ui/tokens.ts"), "generated design tokens travel with their components");
  for (const file of ["build.sh", "gradle-ci.properties", "signing.gradle"]) {
    assert.ok(files.has(`scripts/android/${file}`), `the Android recipe needs ${file}`);
  }
  for (const name of files) {
    assert.ok(
      name.startsWith("src/") ||
        ["build.sh", "gradle-ci.properties", "signing.gradle"].some(
          (file) => name === `scripts/android/${file}`,
        ) ||
        ["scripts/tokens.ts", "package.json", "README.md", "LICENSE", "NOTICE"].includes(name),
      name,
    );
    assert.ok(
      !name.split("/").some((part) => part.startsWith(".env") || part === "node_modules"),
      name,
    );
  }
  // Follow actual source imports, so adding a relative asset or helper without
  // packing it breaks this check even when the public entry still resolves.
  for (const name of files) {
    if (!/\.tsx?$/.test(name)) continue;
    const filename = path.join(installed, name);
    const source = ts.createSourceFile(
      filename,
      readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      if (!specifier.text.startsWith(".")) {
        const dependency = specifier.text
          .split("/")
          .slice(0, specifier.text.startsWith("@") ? 2 : 1)
          .join("/");
        assert.ok(
          isBuiltin(specifier.text) || dependencies.includes(dependency),
          `${name}: undeclared dependency ${specifier.text}`,
        );
        continue;
      }
      const target = path.resolve(path.dirname(filename), specifier.text);
      assert.ok(target.startsWith(installed + path.sep), `${name}: ${specifier.text}`);
      assert.ok(
        ["", ".ts", ".tsx", ".json", "/index.ts", "/index.tsx"].some((suffix) =>
          files.has(path.relative(installed, target + suffix)),
        ),
        `${name}: ${specifier.text}`,
      );
    }
  }
});
