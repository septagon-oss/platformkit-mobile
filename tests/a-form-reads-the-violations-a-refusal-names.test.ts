// A refused write names its fields in `violations` when the server prints them, and in the older `errors`
// list when it does not; one refusal is never shown twice by reading both.
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";
import { parseCatalog } from "../src/core/catalog";
import { invoiceDocument } from "./fakes/policy";

const invoice = parseCatalog(invoiceDocument(null)).resources[0]!;

async function refusedWith(body: unknown): Promise<ApiError> {
  const api = createApi(
    "https://acme.test",
    (async () =>
      new Response(JSON.stringify(body), {
        status: 422,
        headers: { "Content-Type": "application/problem+json" },
      })) as typeof fetch,
  );
  try {
    await api.create(invoice, {});
  } catch (e) {
    assert.ok(e instanceof ApiError);
    return e;
  }
  throw new Error("the write was not refused");
}

test("violations name the fields a refusal is about, without the body prefix", async () => {
  const e = await refusedWith({
    detail: "Review the invalid fields",
    violations: [
      { location: "body.reference", code: "required", message: "Reference is required" },
      { location: "body.lines[1].total", code: "min", message: "Total must be positive" },
      { location: "", code: "x", message: "names no field" },
      { location: "body.memo", code: "x", message: "" },
    ],
  });
  assert.deepEqual(e.fields, {
    reference: "Reference is required",
    "lines[1].total": "Total must be positive",
  });
});

test("the errors list stays the fallback when violations name no field", async () => {
  const e = await refusedWith({
    detail: "Review the invalid fields",
    violations: [],
    errors: ["reference: is required"],
  });
  assert.deepEqual(e.fields, { reference: "is required" });
});

test("violations win over errors and the two are never merged", async () => {
  const e = await refusedWith({
    violations: [{ location: "body.total", code: "min", message: "Total must be positive" }],
    errors: ["reference: is required", "total: older wording"],
  });
  assert.deepEqual(e.fields, { total: "Total must be positive" });
});
