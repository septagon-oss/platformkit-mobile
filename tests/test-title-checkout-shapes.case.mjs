import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run the actual scanner with explicit git/filesystem answers, without changing
// checkout refs or writing a deliberately invalid title into the repository.
const scanner = ts.transpileModule(
  readFileSync("tests/parameterized-test-titles.test.ts", "utf8"),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  },
).outputText;

for (const base of ["main", "origin/main", "origin/HEAD", undefined, "failed-diff"]) {
  test(`the title scan checks and refuses task titles with base ${base ?? "absent"}`, () => {
    for (const invalid of [false, true]) {
      const reads = [];
      const calls = [];
      let scans = 0;
      let registered = 0;
      const modules = {
        "node:assert/strict": assert,
        "node:child_process": {
          execFileSync(command, args) {
            assert.equal(command, "git");
            calls.push(args);
            if (args[0] === "merge-base" && args[1] === (base === "failed-diff" ? "main" : base))
              return "base-commit\n";
            if (args[0] === "diff" && base !== "failed-diff") {
              assert.equal(args.at(-1), `${base}...HEAD`);
              return "tests/nested/behavior.test.ts\nREADME.md\n";
            }
            throw new Error("unavailable git answer");
          },
        },
        "node:fs": {
          readdirSync(path, options) {
            assert.equal(path, "tests");
            assert.equal(options.recursive, true);
            scans++;
            return ["nested/behavior.test.ts", "fixture.json"];
          },
          readFileSync(path) {
            reads.push(path);
            const title = invalid ? ["T", "0221 draws the gallery"].join("-") : "draws the gallery";
            return `test(${JSON.stringify(title)}, () => {});`;
          },
        },
        "node:test": (_title, body) => {
          registered++;
          body();
        },
        typescript: ts,
      };
      const run = () =>
        runInNewContext(scanner, {
          exports: {},
          require: (name) => {
            assert.ok(Object.hasOwn(modules, name), name);
            return modules[name];
          },
        });
      if (invalid) assert.throws(run, /tests\/nested\/behavior.test.ts:1:/);
      else assert.doesNotThrow(run);
      assert.equal(registered, 1);
      assert.deepEqual(reads, ["tests/nested/behavior.test.ts"]);
      assert.equal(scans, base === undefined || base === "failed-diff" ? 1 : 0);
      assert.ok(calls.length > 0);
    }
  });
}
