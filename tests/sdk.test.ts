import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

// check:sdk answers "do the installed native packages match the expo this
// repository pins?" That question has one right answer for a given tree, so
// the gate must read the tree and nothing else. `expo install --check` asks
// Expo's live version service unless EXPO_OFFLINE is set; with it, the CLI
// compares against the installed expo's own bundledNativeModules.json, which
// is a file in node_modules that npm ci reproduces exactly. Without it, a
// patch published upstream turns a green commit red with no change to this
// repository, which happened twice in one week.
const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};
const require = createRequire(import.meta.url);

/** manifest is the version range the installed expo bundles for each package it knows. */
const manifest = (): Readonly<Record<string, string>> =>
  JSON.parse(readFileSync(require.resolve("expo/bundledNativeModules.json"), "utf8")) as Record<
    string,
    string
  >;

test("the SDK gate reads the pinned expo, not the network", () => {
  assert.match(
    pkg.scripts["check:sdk"] ?? "",
    /^EXPO_OFFLINE=1 expo install --check$/,
    "check:sdk must run offline: a gate that asks a live service is red on somebody else's release",
  );
  assert.ok(pkg.scripts.check?.includes("npm run check:sdk"), "npm run check runs the SDK gate");
  // The online question is still asked deliberately, by an owner and by the
  // weekly drift report, never as a gate.
  assert.equal(pkg.scripts["sdk:latest"], "expo install --check");
  assert.ok(!pkg.scripts.check?.includes("sdk:latest"));
});

test("the pinned expo knows every native package this app declares, so the offline gate checks them all", () => {
  const known = manifest();
  // expo itself is the pin, not something pinned against it: nothing in the
  // manifest describes the package the manifest comes from. Everything else
  // this app declares must be in there, or the offline gate would pass it
  // without looking.
  const unchecked = Object.keys(pkg.dependencies).filter((name) => !(name in known));
  assert.deepEqual(unchecked, ["expo"], "a dependency the pinned expo does not know is ungated");
  assert.equal(
    known.expo,
    undefined,
    "if a future manifest describes expo itself, the gate can check the SDK too",
  );
});

test("every installed native package is the version the pinned expo bundles", () => {
  const known = manifest();
  const wrong: string[] = [];
  for (const name of Object.keys(pkg.dependencies)) {
    const range = known[name];
    if (!range) continue;
    const installed = (
      JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")) as {
        version: string;
      }
    ).version;
    // The ranges the manifest uses are "1.2.3", "~1.2.3" and "^1.2.3". A
    // tilde allows a later patch, a caret a later minor, and an exact range
    // allows neither; that is the whole of the comparison the CLI makes, and
    // restating it here keeps this test honest if a future CLI turns offline
    // mode into a silent no-op.
    const [major, minor, patch] = range.replace(/^[~^]/, "").split(".").map(Number);
    const [im, imin, ip] = installed.split("-")[0]!.split(".").map(Number);
    const ok = range.startsWith("^")
      ? im === major && (imin! > minor! || (imin === minor && ip! >= patch!))
      : range.startsWith("~")
        ? im === major && imin === minor && ip! >= patch!
        : im === major && imin === minor && ip === patch;
    if (!ok) wrong.push(`${name}@${installed} is not ${range}`);
  }
  assert.deepEqual(wrong, [], "run npm run sdk:latest to see what Expo now recommends");
});
