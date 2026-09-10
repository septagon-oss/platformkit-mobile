import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const recipe = path.resolve(import.meta.dirname, "../scripts/android");
const record = `const fs = require('node:fs');
fs.appendFileSync(process.env.RECIPE_TRACE, JSON.stringify({tool: TOOL, cwd: process.cwd(), args: process.argv.slice(2)}) + '\\n');`;
const executable = (tool: string, body: string) =>
  "#!/usr/bin/env node\n" + record.replace("TOOL", JSON.stringify(tool)) + "\n" + body;

function fixture(t: test.TestContext) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "pk-android-recipe-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const library = path.join(temporary, "installed library");
  const bin = path.join(temporary, "bin");
  const trace = path.join(temporary, "calls.jsonl");
  mkdirSync(bin);
  cpSync(recipe, path.join(library, "scripts/android"), { recursive: true });
  const gradle = path.join(temporary, "gradle-fixture");
  const expo = path.join(temporary, "expo-fixture");
  writeFileSync(gradle, executable("gradle", ""), { mode: 0o755 });
  writeFileSync(
    expo,
    executable(
      "expo",
      `fs.mkdirSync('android', {recursive:true});
fs.writeFileSync('android/gradle.properties', 'fixture=true');
fs.copyFileSync(process.env.RECIPE_GRADLE, 'android/gradlew');
fs.chmodSync('android/gradlew', 0o755);`,
    ),
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(bin, "npm"),
    executable(
      "npm",
      `fs.mkdirSync('node_modules/.bin', {recursive:true});
fs.copyFileSync(process.env.RECIPE_EXPO, 'node_modules/.bin/expo');
fs.chmodSync('node_modules/.bin/expo', 0o755);`,
    ),
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: bin + path.delimiter + process.env.PATH,
    RECIPE_TRACE: trace,
    RECIPE_EXPO: expo,
    RECIPE_GRADLE: gradle,
    ABIS: "x86_64",
    TARGETS: ":app:assembleRelease :app:bundleRelease",
  };
  return { temporary, library, trace, env, script: path.join(library, "scripts/android/build.sh") };
}

function application(directory: string) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "package.json"), '{"dependencies":{"expo":"57.0.21"}}');
  writeFileSync(path.join(directory, "package-lock.json"), '{"lockfileVersion":3}');
  writeFileSync(path.join(directory, "app.json"), '{"expo":{"name":"Consumer fixture"}}');
}

for (const consuming of [true, false]) {
  test(
    `Android recipe builds the ${consuming ? "selected consumer" : "default reference app"}`,
    {
      skip: process.platform !== "linux" && "the Android recipe uses Linux CPU affinity",
    },
    (t) => {
      const f = fixture(t);
      const target = consuming ? path.join(f.temporary, "consumer app") : f.library;
      application(target);
      execFileSync("bash", [f.script, ...(consuming ? [target] : [])], {
        cwd: f.temporary,
        env: f.env,
      });
      const calls = readFileSync(f.trace, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.deepEqual(calls, [
        { tool: "npm", cwd: target, args: ["ci", "--no-audit", "--no-fund"] },
        {
          tool: "expo",
          cwd: target,
          args: ["prebuild", "--platform", "android", "--no-install", "--clean"],
        },
        {
          tool: "gradle",
          cwd: path.join(target, "android"),
          args: [
            ":app:assembleRelease",
            ":app:bundleRelease",
            "--no-daemon",
            "--max-workers=1",
            "-PreactNativeArchitectures=x86_64",
            "-I",
            path.join(f.library, "scripts/android/signing.gradle"),
            "--console=plain",
          ],
        },
      ]);
      assert.equal(
        readFileSync(path.join(target, "android/gradle.properties"), "utf8"),
        "fixture=true\n" + readFileSync(path.join(recipe, "gradle-ci.properties"), "utf8"),
      );
      if (consuming) {
        assert.equal(existsSync(path.join(f.library, "android")), false);
        assert.equal(existsSync(path.join(f.library, "node_modules")), false);
      }
    },
  );
}

test("invalid or empty application arguments fail before any build effect", (t) => {
  const f = fixture(t);
  const incomplete = path.join(f.temporary, "incomplete");
  mkdirSync(path.join(incomplete, "android"), { recursive: true });
  writeFileSync(path.join(incomplete, "android/keep.txt"), "untouched");
  for (const args of [[], [""], ["missing"], [incomplete], [incomplete, "another"]]) {
    const result = spawnSync("bash", [f.script, ...args], { cwd: f.temporary, env: f.env });
    assert.equal(result.status, 2, JSON.stringify(args));
    assert.equal(existsSync(f.trace), false);
    assert.equal(readFileSync(path.join(incomplete, "android/keep.txt"), "utf8"), "untouched");
  }
});
