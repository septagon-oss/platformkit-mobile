import assert from "node:assert/strict";
import test from "node:test";
import { nativeFileContents } from "../scripts/fingerprint";

const manifest = {
  type: "file" as const,
  filePath:
    "node_modules/@react-native-masked-view/masked-view/android/src/main/AndroidManifest.xml",
};
const fresh =
  '<manifest package="org.reactnative.maskedview" xmlns:android="http://schemas.android.com/apk/res/android">\n</manifest>\n';
const built =
  '<manifest  xmlns:android="http://schemas.android.com/apk/res/android">\n</manifest>\n';

test("the published and Gradle-rewritten masked-view manifests hash the same, across chunks", () => {
  const transform = nativeFileContents();
  assert.equal(transform(manifest, Buffer.from(fresh.slice(0, 24)), false, "utf8"), null);
  assert.equal(transform(manifest, Buffer.from(fresh.slice(24)), false, "utf8"), null);
  assert.equal(transform(manifest, null, true, "utf8"), built);
  // The hook resets after EOF, even when a caller reads the same source twice.
  assert.equal(transform(manifest, built, true, "utf8"), built);
});

test("other manifest changes remain visible in the fingerprint", () => {
  const permission = fresh.replace(
    "</manifest>",
    '<uses-permission android:name="android.permission.CAMERA"/>\n</manifest>',
  );
  const namespace = fresh.replace("org.reactnative.maskedview", "example.changed");
  assert.notEqual(nativeFileContents()(manifest, permission, true, "utf8"), built);
  assert.equal(nativeFileContents()(manifest, namespace, true, "utf8"), namespace);
});

test("all other file and configuration bytes pass through unchanged", () => {
  const contents = Buffer.from(fresh);
  const transform = nativeFileContents();
  assert.equal(
    transform({ type: "file", filePath: "another/AndroidManifest.xml" }, contents, false, "utf8"),
    contents,
  );
  assert.equal(transform({ type: "contents", id: "expoConfig" }, fresh, true, "utf8"), fresh);
});
