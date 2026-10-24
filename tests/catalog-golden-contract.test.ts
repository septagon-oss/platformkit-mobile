// The catalogue goldens copied from the kernel are answers the pinned HTTP document must accept: the
// shell's own catalog read and the strict generated appResources operation both take each of them,
// so refreshing one pin to a shape the other refuses fails here rather than on a phone.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { zCatalog } from "../src/generated/zod.gen";
import { createApi } from "../src/effects/api";

type Document = { resources: Record<string, unknown>[] };

// The pinned document types some resolved members as objects that the served golden prints as null,
// so the strict operation is asked about everything but the resolved blocks, which the next case
// holds to the one disagreement they are known to have.
const withoutResolved = (body: string): string => {
  const doc = JSON.parse(body) as Document;
  return JSON.stringify({
    ...doc,
    resources: doc.resources.map(({ resolved: _resolved, ...entry }) => entry),
  });
};

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
    const result = await serve(withoutResolved(body)).operations.appResources({});
    assert.equal(result.data.resources?.length, resources);
    assert.equal(result.data.catalogVersion, catalog.version);
  });
}

test("the strict schema refuses a served resolved block only where it prints null for an object", () => {
  const body = readFileSync("testdata/catalog.json", "utf8");
  const refused = zCatalog.safeParse(JSON.parse(body));
  assert.equal(refused.success, false);
  const outside = refused.error?.issues.filter((i) => !i.path.includes("resolved")) ?? [];
  assert.deepEqual(outside, []);
  assert.equal(
    refused.error?.issues.every((i) => i.code === "invalid_type"),
    true,
  );
});
