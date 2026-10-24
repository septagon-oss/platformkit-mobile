// Both catalogue consumers accept the same unmodified response from the pinned server.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createApi } from "../src/effects/api";

test("a generated catalogue read accepts the served resolved policy", async () => {
  const body = readFileSync("testdata/catalog.json", "utf8");
  const api = createApi(
    "https://catalog.example.test",
    async () => new Response(body, { headers: { "Content-Type": "application/json" } }),
  );
  const catalog = await api.catalog();
  assert.ok(catalog.resources.every((entry) => entry.resolved !== undefined));
  const generated = await api.operations.appResources({});
  assert.equal(generated.data.resources?.length, catalog.resources.length);
  assert.ok(generated.data.resources?.every((entry) => entry.resolved !== undefined));
});
