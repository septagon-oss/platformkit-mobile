// The release channel accepts plain versions and refuses both prerelease and
// build suffixes before a registry is involved. The refusal names the supplied
// version so a maintainer can correct the manifest that produced it.
import assert from "node:assert/strict";
import test from "node:test";
import { publishable } from "../scripts/publish";

test("a release version cannot carry prerelease or build metadata", () => {
  const manifest = {
    name: "@septagon-oss/platformkit-mobile",
    files: ["src", "CHANGELOG.md"],
  };
  for (const version of ["0.7.4", "1.0.0", "12.3.8"])
    assert.doesNotThrow(() => publishable({ ...manifest, version }), version);
  for (const version of ["0.7.4-beta.2", "1.0.0+build.9", "12.3.8-rc.1+sha.abc"]) {
    assert.throws(
      () => publishable({ ...manifest, version }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(version) &&
        error.message.includes("suffix"),
      version,
    );
  }
});
