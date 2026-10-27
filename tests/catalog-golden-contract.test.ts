// The catalogue goldens copied from the kernel are answers the pinned HTTP document must accept: the
// shell's own catalog read, the strict generated appResources operation and the generated catalogue
// schema all take each of them as served, so refreshing one pin to a shape the other refuses fails
// here rather than on a phone.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { zCatalog } from "../src/generated/zod.gen";
import { createApi } from "../src/effects/api";

type Document = { resources: Record<string, unknown>[] };

for (const name of ["catalog.json", "catalog.control-plane.json", "catalog.hints.json"]) {
  test(`the ${name} golden is a catalogue both catalog reads accept`, async () => {
    const body = readFileSync(`testdata/${name}`, "utf8");
    const resources = (JSON.parse(body) as Document).resources.length;
    const serve = (text: string) =>
      createApi(
        "https://goldens.test",
        (async () =>
          new Response(text, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch,
      );
    const catalog = await serve(body).catalog();
    assert.equal(catalog.resources.length, resources);
    const result = await serve(body).operations.appResources({});
    assert.equal(result.data.resources?.length, resources);
    assert.equal(result.data.catalogVersion, catalog.version);
    assert.equal(zCatalog.safeParse(JSON.parse(body)).success, true);
  });
}
