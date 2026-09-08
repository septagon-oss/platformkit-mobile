import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { exportSource } from "../scripts/source";

// These are disposable Git fixtures owned and removed by the test harness.
// Their dependency metadata is intentionally small; npm installation is
// exercised separately against an export of the real application.
function fixture(t: TestContext) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "pk-mobile-source-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, "repo");
  mkdirSync(root);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  git("init", "-q");
  const pkg = { name: "example-mobile", version: "1.2.3", dependencies: { example: "^2.0.0" } };
  const lock = {
    name: pkg.name,
    version: pkg.version,
    lockfileVersion: 3,
    packages: {
      "": { ...pkg },
      "node_modules/example": {
        version: "2.1.0",
        resolved: "https://registry.npmjs.org/example/-/example-2.1.0.tgz",
        integrity: "sha512-" + Buffer.alloc(64, 1).toString("base64"),
      },
    },
  };
  function write(name: string, data: string | Buffer) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data);
  }
  const manifests = () => {
    write("package.json", JSON.stringify(pkg));
    write("package-lock.json", JSON.stringify(lock));
  };
  manifests();
  write("src/ui/atoms/Label.tsx", "export const label = 'committed';\n");
  write("assets/mark.bin", Buffer.from([0, 255, 128, 13, 10]));
  write("scripts/android/build.sh", "#!/bin/sh\nexit 0\n");
  chmodSync(path.join(root, "scripts/android/build.sh"), 0o755);
  write(".gitea/workflows/ci.yml", "name: verification\n");
  write(".github/workflows/ci.yml", "name: verification\n");
  function commit() {
    git("add", ".");
    git(
      "-c",
      "user.name=Source test",
      "-c",
      "user.email=source@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-qm",
      "test fixture",
    );
    return git("rev-parse", "HEAD");
  }
  return { root, dir, pkg, lock, write, manifests, commit, output: path.join(dir, "export") };
}

test("a receipt describes the exact committed bytes and modes, independent of the checkout", (t) => {
  const f = fixture(t);
  const revision = f.commit();
  f.write("src/ui/atoms/Label.tsx", "uncommitted edit\n");
  f.write(".env.local", "EXPO_PUBLIC_API_URL=https://example.invalid\n");
  f.write("node_modules/extra/index.js", "untracked dependency\n");
  exportSource(f.root, revision, f.output);
  const receipt = JSON.parse(readFileSync(path.join(f.output, "SOURCE.json"), "utf8"));
  assert.equal(receipt.source.revision, revision);
  assert.equal(receipt.source.version, "1.2.3");
  assert.equal(
    readFileSync(path.join(f.output, "src/ui/atoms/Label.tsx"), "utf8"),
    "export const label = 'committed';\n",
  );
  assert.deepEqual(
    readFileSync(path.join(f.output, "assets/mark.bin")),
    Buffer.from([0, 255, 128, 13, 10]),
  );
  assert.equal(statSync(path.join(f.output, "scripts/android/build.sh")).mode & 0o777, 0o755);
  for (const name of [".git", ".gitea", ".github", ".env.local", "node_modules"])
    assert.equal(existsSync(path.join(f.output, name)), false, name);
  assert.equal(receipt.files.length, 5);
  for (const entry of receipt.files) {
    const bytes = readFileSync(path.join(f.output, entry.path));
    assert.equal(entry.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.mode, (statSync(path.join(f.output, entry.path)).mode & 0o777).toString(8));
  }
  const second = path.join(f.dir, "second");
  exportSource(f.root, revision, second);
  assert.deepEqual(
    readFileSync(path.join(f.output, "SOURCE.json")),
    readFileSync(path.join(second, "SOURCE.json")),
  );
});

test("exports require immutable commits and never overwrite an existing destination", (t) => {
  const f = fixture(t);
  const revision = f.commit();
  assert.throws(() => exportSource(f.root, "HEAD", f.output), /full 40-character/);
  assert.throws(() => exportSource(f.root, revision.slice(0, 8), f.output), /full 40-character/);
  assert.throws(() => exportSource(f.root, revision, path.join(f.root, "export")), /outside/);
  symlinkSync(f.root, path.join(f.dir, "alias"));
  assert.throws(() => exportSource(f.root, revision, path.join(f.dir, "alias/export")), /outside/);
  mkdirSync(f.output);
  writeFileSync(path.join(f.output, "keep.txt"), "existing work");
  assert.throws(() => exportSource(f.root, revision, f.output), /already exists/);
  assert.equal(readFileSync(path.join(f.output, "keep.txt"), "utf8"), "existing work");
});

test("local dependencies and workspace links fail before producing an output", (t) => {
  for (const spec of [
    "file:../shared",
    "link:../shared",
    "workspace:*",
    "../shared",
    "/tmp/shared",
    "C:\\shared",
  ]) {
    const f = fixture(t);
    f.pkg.dependencies.example = spec;
    f.manifests();
    assert.throws(() => exportSource(f.root, f.commit(), f.output), /local path/);
    assert.equal(existsSync(f.output), false);
  }
  const f = fixture(t);
  Object.assign(f.lock.packages["node_modules/example"], { link: true });
  f.manifests();
  assert.throws(() => exportSource(f.root, f.commit(), f.output), /linked or workspace/);
  assert.equal(existsSync(f.output), false);
});

test("lockfile drift, unpinned packages and missing integrity cannot be exported", (t) => {
  const cases = [
    {
      edit: (f: ReturnType<typeof fixture>) => {
        f.pkg.version = "1.2.4";
      },
      error: /version differs/,
    },
    {
      edit: (f: ReturnType<typeof fixture>) => {
        f.lock.packages["node_modules/example"].version = "^2.0.0";
      },
      error: /exact package version/,
    },
    {
      edit: (f: ReturnType<typeof fixture>) => {
        f.lock.packages["node_modules/example"].integrity = "";
      },
      error: /SHA-512/,
    },
    {
      edit: (f: ReturnType<typeof fixture>) => {
        f.lock.packages["node_modules/example"].resolved = "file:../shared";
      },
      error: /published HTTPS/,
    },
    {
      edit: (f: ReturnType<typeof fixture>) => {
        Object.assign(f.pkg, { workspaces: ["../shared"] });
      },
      error: /workspaces/,
    },
  ];
  for (const { edit, error } of cases) {
    const f = fixture(t);
    edit(f);
    f.manifests();
    assert.throws(() => exportSource(f.root, f.commit(), f.output), error);
    assert.equal(existsSync(f.output), false);
  }
});

test("tracked symlinks and local configuration fail instead of leaking into a handoff", (t) => {
  const link = fixture(t);
  symlinkSync("../../sibling", path.join(link.root, "src/shared"));
  assert.throws(
    () => exportSource(link.root, link.commit(), link.output),
    /symlinks and submodules/,
  );
  assert.equal(existsSync(link.output), false);
  const env = fixture(t);
  env.write(".env.local", "EXPO_PUBLIC_API_URL=https://example.invalid\n");
  assert.throws(() => exportSource(env.root, env.commit(), env.output), /local configuration/);
  assert.equal(existsSync(env.output), false);
});
