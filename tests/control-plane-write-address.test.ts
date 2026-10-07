// A resource read in the workspace and written on the control plane is written where the
// document says and read where it always was, with the row encoded into every address —
// the plan below is shaped as the kernel's reference app serves billing/plan to its
// operator (write_path printed, no operations, fields carrying maxLength), not as this
// repository's own fixtures spell it.
import assert from "node:assert/strict";
import test from "node:test";
import { doors, parseCatalog } from "../src/core/catalog";
import { createApi } from "../src/effects/api";

const served = {
  catalogVersion: 2,
  resources: [
    {
      module: "billing",
      entity: "plan",
      path: "/api/v1/billing/plans",
      fields: [
        { name: "id", type: "uuid", readOnly: true },
        { name: "code", type: "string", maxLength: 60, required: true },
        { name: "priceCents", type: "int", default: "0" },
        { name: "active", type: "bool", widget: "checkbox" },
      ],
      writable: true,
      write_path: "/api/v1/ops/billing/plans",
      commands: [
        { verb: "retire", path: "/api/v1/ops/billing/plans/{id}/retire" },
        { verb: "reprice", collection: true, path: "/api/v1/ops/billing/plans/reprice" },
        { verb: "note" },
      ],
    },
    {
      module: "site",
      entity: "settings",
      path: "/api/v1/site/settings",
      fields: [{ name: "title", type: "string", maxLength: 120 }],
      writable: true,
      singleton: true,
      commands: [{ verb: "republish" }],
    },
  ],
};

function recording() {
  const sent: string[] = [];
  const f = async (url: string, init: RequestInit = {}) => {
    sent.push(`${init.method} ${url.replace("https://acme.test", "")}`);
    // Responses meet the pinned wire contracts; the assertions below still
    // exercise only T-0285's read/write addresses and encoded row substitution.
    const status =
      init.method === "DELETE" ? 204 : init.method === "POST" && url.endsWith("/plans") ? 201 : 200;
    const body = url.includes("?limit=")
      ? { items: [], total: 0, limit: 20, offset: 0 }
      : { code: "pro", name: "Pro", currency: "USD", active: true };
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetch: f as unknown as typeof fetch, sent };
}

test("a plan read in the workspace is created, amended and removed on the control plane", async () => {
  const [plan] = parseCatalog(served).resources;
  assert.deepEqual(doors(plan!), { create: true, update: true, delete: true });
  const { fetch, sent } = recording();
  const api = createApi("https://acme.test", fetch);
  const row = "plan 7/α";
  await api.list(plan!);
  await api.get(plan!, row);
  await api.create(plan!, { code: "pro" });
  await api.update(plan!, row, { code: "pro" });
  await api.remove(plan!, row);
  assert.deepEqual(sent, [
    "GET /api/v1/billing/plans?limit=20&offset=0",
    "GET /api/v1/billing/plans/plan%207%2F%CE%B1",
    "POST /api/v1/ops/billing/plans",
    "PATCH /api/v1/ops/billing/plans/plan%207%2F%CE%B1",
    "DELETE /api/v1/ops/billing/plans/plan%207%2F%CE%B1",
  ]);
});

test("a printed command takes the encoded row in place of {id} and is never extended by its verb", async () => {
  const [plan, settings] = parseCatalog(served).resources;
  const { fetch, sent } = recording();
  const api = createApi("https://acme.test", fetch);
  await api.command(plan!, "plan 7/α", "retire");
  await api.command(plan!, undefined, "reprice");
  await api.command(plan!, "p1", "note");
  // A singleton's command is derived without a row, which is the kernel's own
  // rule for it (ui/screens.itemish), so nothing prints an address for it.
  await api.command(settings!, undefined, "republish");
  assert.deepEqual(sent, [
    "POST /api/v1/ops/billing/plans/plan%207%2F%CE%B1/retire",
    "POST /api/v1/ops/billing/plans/reprice",
    "POST /api/v1/billing/plans/p1/note",
    "POST /api/v1/site/settings/republish",
  ]);
});
