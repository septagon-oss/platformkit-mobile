// tests/parity holds the kernel's reviewed cases; a copy edited to make a test pass, or a fixture whose
// recorded hash is not the hash of what it holds, is refused by name.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonical, checkParity, hashOf } from "../scripts/parity";

function copy<T>(body: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "parity-"));
  try {
    cpSync("tests/parity", join(root, "tests/parity"), { recursive: true });
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the committed copies are the kernel's and their hashes hold", () => {
  assert.deepEqual(checkParity("."), []);
});

test("a fixture changed after it was copied is refused for its bytes and for its hash", () => {
  const problems = copy((root) => {
    const file = join(root, "tests/parity/singleton.json");
    writeFileSync(file, readFileSync(file, "utf8").replace('"singleton"', '"changed"'));
    return checkParity(root);
  });
  assert.ok(problems.some((p) => p.includes("singleton.json") && p.includes("bytes differ")));
});

test("a file the manifest does not record is refused", () => {
  const problems = copy((root) => {
    writeFileSync(join(root, "tests/parity/extra.json"), "{}");
    return checkParity(root);
  });
  assert.deepEqual(problems, ["tests/parity/extra.json: not in tests/parity/parity.source.json"]);
});

test("the kernel's rule sorts keys, drops space, keeps markup unescaped and refuses fractions", () => {
  assert.equal(
    canonical({ b: [1, null], a: "<&>é", c: { z: true, y: false } }),
    '{"a":"<&>é","b":[1,null],"c":{"y":false,"z":true}}',
  );
  assert.match(
    hashOf({}),
    /^sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a$/,
  );
  assert.throws(() => canonical({ a: 1.5 }), /not a whole number/);
});
