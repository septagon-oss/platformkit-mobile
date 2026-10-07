// The catalogue goldens copied from the kernel are answers the pinned HTTP document must accept: the
// shell's own catalog read and the strict generated appResources operation both take each of them,
// so refreshing one pin to a shape the other refuses fails here rather than on a phone.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createApi } from "../src/effects/api";

for (const name of ["catalog.json", "catalog.control-plane.json"]) {
  test(`the ${name} golden is a catalogue both catalog reads accept`, async () => {
    const body = readFileSync(`testdata/${name}`, "utf8");
    const resources = (JSON.parse(body) as { resources: unknown[] }).resources.length;
    const api = createApi(
      "https://goldens.test",
      (async () =>
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
    );
    const catalog = await api.catalog();
    assert.equal(catalog.resources.length, resources);
    const result = await api.operations.appResources({});
    assert.equal(result.data.resources?.length, resources);
    assert.equal(result.data.catalogVersion, catalog.version);
  });
}
