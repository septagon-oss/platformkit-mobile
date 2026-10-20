// What a build may claim about a link: the private scheme always, and a verified HTTPS host
// only when the build names one itself. Android fetches /.well-known/assetlinks.json from the
// host, so a claimed host is a fact about the deployment — the manifest may carry the one the
// build already connects to, and no other, or the filter opens the browser all the same and
// leaves a claim nobody owns in the binary.
import assert from "node:assert/strict";
import test from "node:test";
import config, { appLinks } from "../app.config";

const link = appLinks("https://platformkit.example/api")[0]!;

test("the app's own scheme is declared whatever the build connects to", () => {
  assert.equal(config.scheme, "platformkit");
  // A checkout that names no server — every development machine, and every CI job that
  // talks to a workstation over adb reverse — carries the scheme and no host claim.
  assert.deepEqual(appLinks(""), []);
});

test("the server a build names is the one host it verifies, and the only one", () => {
  assert.equal(config.android?.package, "dev.septagon.platformkit");
  assert.equal(link.autoVerify, true);
  assert.equal(link.action, "VIEW");
  assert.deepEqual(link.data, {
    scheme: "https",
    host: "platformkit.example",
    pathPrefix: "/app/",
  });
  assert.deepEqual(link.category, ["BROWSABLE", "DEFAULT"]);
  // The address a person signs in at is a URL, and the host of it is the whole claim: no
  // port, no path and no second host joins the list.
  assert.deepEqual(appLinks("https://platformkit.example").length, 1);
  assert.deepEqual(appLinks("https://platformkit.example/api/v1").length, 1);
});

test("a host the platform will not verify is claimed nowhere", () => {
  // Cleartext is the emulator's `adb reverse`, and an app link over it is a claim Android
  // refuses to check; a port is a different origin; a value that is not a URL names nothing.
  for (const plain of [
    "http://localhost:8081",
    "https://platformkit.example:8443",
    "platformkit.example",
    "not a server",
  ])
    assert.deepEqual(appLinks(plain), [], plain);
});
