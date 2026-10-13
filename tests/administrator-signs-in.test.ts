// An administrator signs in on the phone and holds a key, as a member does.
//
// The kernel's built-in admin role grants the wildcard (modules/auth/internal/
// seed.go: `admin := []string{contracts.Wildcard}`), and login answers a role's
// permissions as the role stores them (modules/auth/internal/service.go,
// identify), so an administrator's Identity names "*". auth-token-issue refuses
// that scope by name — "the wildcard answers for every permission in the tenant
// and for no operator permission at all" (modules/auth/internal/tokens.go,
// IssueToken) — with a 422. All three are read at the commit
// testdata/openapi.source.json pins.
//
// The fake below is that commit's kernel for the two operations this sign-in
// makes, with its rule for the mint. A sign-in that learns what to ask for from
// another documented operation answers that one here too; a re-pinned kernel
// whose mint rule changed changes the rule here with it.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";
import { issuedTokenResponse } from "./fakes/wire";

const administrator = {
  userId: "33333333-3333-4333-8333-333333333333",
  email: "owner@example.test",
  roles: ["admin"],
  permissions: ["*"],
};

test("an administrator signs in on the phone and holds a key", async () => {
  const mints: { scopes: string[] }[] = [];
  const api = createApi("https://owner.test", (async (url, init = {}) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/v1/auth/login")
      return new Response(JSON.stringify(administrator), {
        status: 200,
        headers: { "Content-Type": "application/json", "Set-Cookie": "pk=owner; HttpOnly" },
      });
    if (path === "/api/v1/auth/tokens" && init.method === "POST") {
      const body = JSON.parse(String(init.body)) as { scopes: string[] };
      mints.push(body);
      if (body.scopes.length === 0 || body.scopes.includes("*"))
        return new Response(
          JSON.stringify({
            status: 422,
            title: "Unprocessable Entity",
            detail: "every scope has to be a permission this account already holds",
          }),
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        );
      return issuedTokenResponse({}, { scopes: body.scopes });
    }
    return new Response(JSON.stringify({ status: 404, title: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/problem+json" },
    });
  }) as typeof fetch);

  const answer = await api.signIn(administrator.email, "password").catch((e: unknown) => e);

  assert.ok(mints.length > 0, "the password leg reaches the mint");
  assert.equal(
    (answer as { kind?: string }).kind,
    "signed-in",
    `the sign-in finishes: ${String(answer)}`,
  );
  assert.notEqual(api.bearer(), undefined, "the phone holds the key it minted");
});
