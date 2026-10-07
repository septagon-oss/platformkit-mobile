// Resolve from the generator's parser, not the root: a nested vulnerable copy
// must not hide behind the patched YAML parser used by unrelated tooling.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const requireHere = createRequire(import.meta.url);
const requireGenerator = createRequire(requireHere.resolve("@hey-api/openapi-ts/package.json"));
const requireParser = createRequire(
  requireGenerator.resolve("@hey-api/json-schema-ref-parser/package.json"),
);

test("the API generator resolves a YAML parser with the denial-of-service fixes", () => {
  const { version } = requireParser("js-yaml/package.json") as { version: string };
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  assert.ok(
    major > 4 || (major === 4 && (minor > 3 || (minor === 3 && patch >= 2))),
    `the generator resolved js-yaml ${version}, expected 4.3.2 or newer`,
  );
});

test("the generator's YAML parser preserves referenced schema values", () => {
  const yaml = requireParser("js-yaml") as { load: (source: string) => unknown };
  assert.deepEqual(
    yaml.load(`schemas:
  Row: &row
    type: object
    properties:
      total:
        type: integer
        minimum: 0
  Alias: *row
response:
  $ref: '#/schemas/Row'
`),
    {
      schemas: {
        Row: { type: "object", properties: { total: { type: "integer", minimum: 0 } } },
        Alias: { type: "object", properties: { total: { type: "integer", minimum: 0 } } },
      },
      response: { $ref: "#/schemas/Row" },
    },
  );
});
