// Presentation fallback preserves the resource contract: a bad hint can cost
// its label, but never its fields, commands or validation of required members.
// The generated operation still owns its stricter published response contract.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CatalogError, parseCatalog } from "../src/core/catalog";
import { ApiError, createApi } from "../src/effects/api";

const document = () => JSON.parse(readFileSync("testdata/catalog.json", "utf8"));

test("malformed hints at every nesting level preserve the unhinted catalog", () => {
  const input = document();
  const baseline = parseCatalog(input);
  input.resources[0].presentation = "a noun where an object belongs";
  input.resources[0].fields[1].presentation = false;
  input.resources[0].commands[0].presentation = 63;
  input.resources[0].commands[0].fields[0].presentation = [];
  const noticed: string[] = [];
  assert.deepEqual(
    parseCatalog(input, (at) => noticed.push(at)),
    baseline,
  );
  assert.deepEqual(noticed, [
    "resources[0].fields[1].presentation",
    "resources[0].presentation",
    "resources[0].commands[0].presentation",
    "resources[0].commands[0].fields[0].presentation",
  ]);
});

test("fallback leaves missing required resource and command members refused by path", () => {
  for (const missing of ["entry path", "field name", "command verb", "command field type"]) {
    const input = document();
    const resource = input.resources[0];
    resource.presentation = { singular: false };
    let path: string;
    switch (missing) {
      case "entry path":
        delete resource.path;
        path = "resources[0].path";
        break;
      case "field name":
        delete resource.fields[1].name;
        path = "resources[0].fields[1].name";
        break;
      case "command verb":
        delete resource.commands[0].verb;
        path = "resources[0].commands[0].verb";
        break;
      default:
        delete resource.commands[0].fields[0].type;
        path = "resources[0].commands[0].fields[0].type";
    }
    assert.throws(
      () => parseCatalog(input),
      (error: unknown) => error instanceof CatalogError && error.message.includes(path),
      missing,
    );
  }
});

test("the shell accepts a hint fallback while the generated catalog operation refuses it", async () => {
  const input = document();
  input.resources[0].commands[0].presentation = false;
  const api = createApi(
    "https://fallback.example.test",
    (async () =>
      new Response(JSON.stringify(input), {
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
  );
  assert.deepEqual(await api.catalog(() => {}), parseCatalog(document()));
  await assert.rejects(
    api.operations.appResources({}),
    (error: unknown) => error instanceof ApiError && error.detail.includes("/api/v1/app/resources"),
  );
});
