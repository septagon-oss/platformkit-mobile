// What the history scan is told to swallow, held to its size. `scripts/gitleaks.sh`
// reads every commit, so a credential-shaped string a test introduces stays under it
// whatever the tree looks like afterwards; the release tests hold one on purpose,
// because the publish step writes a credential into a fake npmrc that an in-process
// registry answers, and a test that never writes one proves nothing about the step.
// `.gitleaks.toml` is therefore the one place that exemption may live, and these cases
// hold it to three things: joined to gitleaks' own rules rather than written in place
// of them, stated as a value shape rather than as a file or a path, and too narrow to
// reach a credential a registry could answer. What counts as a secret is the scan's
// arithmetic; this file reads only the exemption's reach, from the shapes it names. And
// because that scan reads commits, a credential-shaped string written out here would be
// a leak of its own, so the near-misses these cases probe with are assembled from parts
// rather than written as literals.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const document = readFileSync(path.join(root, ".gitleaks.toml"), "utf8");

/** The lines under the file's single `[allowlist]` header, up to the next section. */
function allowlistLines(): string[] {
  const lines = document.split("\n");
  const header = lines.findIndex((line) => line.trim() === "[allowlist]");
  assert.notEqual(header, -1, ".gitleaks.toml states its exemptions in one [allowlist]");
  const body: string[] = [];
  for (const line of lines.slice(header + 1)) {
    if (line.trim().startsWith("[")) break;
    body.push(line);
  }
  return body.filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
}

/** The value shapes the exemption names, as patterns, together with the keys beside them. */
function exemption(): { shapes: RegExp[]; keys: string[] } {
  const lines = allowlistLines();
  const keys = lines.map((line) => {
    const key = /^\s*([a-z_]+)\s*=/.exec(line)?.[1];
    assert.ok(key, `${line} states no key this scan's exemption is read by`);
    return key;
  });
  const stated = lines.find((line) => line.trim().startsWith("regexes"));
  assert.ok(stated, "the exemption states the value shapes it exempts");
  const quoted = stated.split("'''").filter((_, index) => index % 2 === 1);
  assert.ok(
    quoted.every((shape) => shape.trim() !== ""),
    "every exempted shape is written between its triple quotes",
  );
  return {
    shapes: quoted.map((shape) => new RegExp(shape)),
    keys,
  };
}

/** The credential literals the release tests hand the step they run. */
function heldCredentials(): { file: string; value: string }[] {
  return ["tests/publish-registry-credential.test.ts", "tests/publish-workflow.test.ts"].map(
    (file) => {
      const literal = readFileSync(path.join(root, file), "utf8").match(
        /^const TOKEN = "([^"]+)";$/m,
      )?.[1];
      assert.ok(literal, `${file} holds the credential its registry answers`);
      return { file, value: literal };
    },
  );
}

/** An npm access token's own shape: `npm_` and 36 url-safe characters. */
function npmAccessToken(): string {
  return `npm_${"9P3kQ7xZ2LmVbN4tRsYdWcUfJhKgAeBq".concat("CnTx")}`;
}

/** Forty hex digits, which is what a signing key looks like to anything reading. */
function hexSecret(): string {
  return "0f1e2d3c".repeat(5);
}

test("the scan's exemption joins the scan's own rules instead of replacing them", () => {
  // A custom config that named no `[extend]` would leave gitleaks with one exemption
  // and no rules at all: a history scan that passes by looking at nothing. Measured
  // with the pinned binary — with the section the rules answer, without it nothing is
  // scanned, not even a real token.
  assert.match(document, /^\[extend\]$/m);
  assert.match(document, /^useDefault = true$/m);
});

test("the exemption reaches a value shape and never a file, a path or a commit", () => {
  const { shapes, keys } = exemption();
  assert.deepEqual(keys, ["description", "regexes"], "the exemption names nothing but shapes");
  assert.equal(shapes.length, 1, "one exempted shape is enough for one fixture");
});

test("the credential the release tests hand a fake npmrc is the exempt shape", () => {
  const { shapes } = exemption();
  for (const held of heldCredentials()) {
    assert.ok(
      shapes.some((shape) => shape.test(held.value)),
      `${held.file} holds ${held.value}, which the scan refuses and no release can ship`,
    );
  }
});

test("a credential a registry could answer stays outside the exemption", () => {
  const { shapes } = exemption();
  for (const near of [
    // The fixture's own prefix, longer than the fixture: a real secret wearing its
    // first six digits is still a secret.
    "npm_publish_secret_9f8e7d6c5b4a",
    "npm_publish_secret_7c41e0z",
    "npm_publish_secret_7c41e0_deadbeef",
    npmAccessToken(),
    hexSecret(),
  ]) {
    assert.ok(
      shapes.every((shape) => !shape.test(near)),
      `${near} is a credential, not the release fixture`,
    );
  }
});

test("a near-miss is assembled from parts, because the scan reads the file that names it", () => {
  // The scan reads commits, so a credential-shaped literal a test wrote as a
  // near-miss is a leak on its own record, whatever it was there to prove. The first
  // draft of this file carried npm's own token shape as a literal and the history
  // scan refused the commit that introduced it.
  const own = readFileSync(path.join(root, "tests/secret-scan-fixture-allowlist.test.ts"), "utf8");
  assert.ok(
    !/npm_[A-Za-z0-9]{36}/.test(own),
    "an npm access token's shape, written out, is a leak and not a test input",
  );
  assert.ok(
    !/[0-9a-f]{40}/.test(own),
    "a digest's shape, written out, is what a key reader looks for next",
  );

  // Assembled near-misses still have to be the shape they stand for, or the case above
  // would be refusing nothing.
  assert.match(npmAccessToken(), /^npm_[A-Za-z0-9]{36}$/);
  assert.match(hexSecret(), /^[0-9a-f]{40}$/);
});

test("the secret scan is handed the exemption by name and reads the history", () => {
  const script = readFileSync(path.join(root, "scripts/gitleaks.sh"), "utf8");
  assert.match(script, /--config \.gitleaks\.toml/, "the step says which terms it scanned under");
  assert.match(script, /gitleaks" git /, "the scan reads the history, not the working tree");
});
