// The bound catalog operation must honor its generated return type even when
// the shell's compatibility adapter accepts an unstamped legacy catalog.
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";
import { zCatalog } from "../src/generated/zod.gen";

const path = "/api/v1/app/resources";
const answering = (body: unknown) =>
  createApi(
    "https://contract.test",
    (async () =>
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
  );

test("the generated catalog operation never returns a value outside its declared schema", async () => {
  for (const body of [{ catalogVersion: 2, resources: [] }, { resources: [] }]) {
    const api = answering(body);
    let result;
    try {
      result = await api.operations.appResources({});
    } catch (error) {
      // A strict operation may refuse the legacy wire response; normalization
      // is also valid if the returned value satisfies the published schema.
      assert.ok(error instanceof ApiError);
      assert.ok(error.detail.includes(path));
      assert.ok(!("catalogVersion" in body), "the stamped response must be accepted");
      continue;
    }
    assert.ok(
      zCatalog.safeParse(result.data).success,
      "a generated Catalog result must include its required numeric catalogVersion",
    );
    assert.equal(typeof result.data.catalogVersion, "number");
  }
});

test("the shell catalog adapter continues to accept unstamped legacy catalogs", async () => {
  assert.deepEqual(await answering({ resources: [] }).catalog(), { version: 0, resources: [] });
});
