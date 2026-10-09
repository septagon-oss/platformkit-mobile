// What a phone may ask the mint for, and what it must not ask for.
//
// A bearer key is narrowed, never escalated: modules/auth/internal/tokens.go's
// IssueToken refuses a scope with no permission behind it, refuses the wildcard
// by name, and refuses a scope the holder's own roles do not already grant — and
// modules/auth/internal/seed.go grants the built-in administrator role the
// wildcard alone, so an account that is granted everything is answered with the
// wildcard and no permission at all (modules/auth/internal/service.go's identify).
// The phone therefore cannot forward the list a sign-in answered with; it turns it
// into permissions, out of the declarations the pinned document prints for its own
// surface (x-platformkit-auth), which is what src/core/scopes.ts is for.
//
// An operator grant is the other half: contracts.Grants answers for it only by
// naming it, and contracts.CheckedPermissions refuses it outside the operator's
// own tenant. This phone calls the app surface and no other, so it never asks.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createApi } from "../src/effects/api";
import { WILDCARD, delegableScopes } from "../src/core/scopes";
import { issuedTokenResponse, loginIdentity } from "./fakes/wire";

/** signInThrough answers as the kernel does about one mint body and reports it. */
function signInThrough(permissions: readonly string[]) {
  const mints: { body: Record<string, unknown>; bearer: boolean }[] = [];
  const api = createApi("https://scope.test", (async (url, init = {}) => {
    const path = new URL(String(url)).pathname;
    const headers = new Headers(init.headers);
    if (path === "/api/v1/auth/login")
      return new Response(JSON.stringify({ ...loginIdentity, permissions }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Set-Cookie": "pk=one; HttpOnly" },
      });
    if (path === "/api/v1/auth/tokens" && init.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const scopes = (body.scopes ?? []) as string[];
      const refused =
        scopes.length === 0 ||
        scopes.includes(WILDCARD) ||
        scopes.some((scope) =>
          readPermissions.some(
            (permission) => permission.operator && permission.permission === scope,
          ),
        );
      mints.push({ body, bearer: headers.get("authorization") === null });
      if (refused)
        return new Response(
          JSON.stringify({
            status: 422,
            detail: "every scope has to be a permission this account already holds",
          }),
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        );
      return issuedTokenResponse({}, { scopes });
    }
    return new Response(JSON.stringify({ status: 404 }), {
      status: 404,
      headers: { "Content-Type": "application/problem+json" },
    });
  }) as typeof fetch);
  return { api, mints };
}

interface Declared {
  readonly permission: string;
  readonly operator: boolean;
  readonly surface: string;
}

/** readPermissions is the pinned document's own declaration per permission, read
 * here the way scripts/api.ts reads it when it writes grants.gen.ts. */
const readPermissions: Declared[] = (() => {
  const document = JSON.parse(readFileSync("testdata/openapi.json", "utf8")) as {
    paths: Record<
      string,
      Record<
        string,
        {
          "x-platformkit-auth"?: { kind?: string; permission?: string };
          "x-platformkit-surface"?: string;
        }
      >
    >;
  };
  const out = new Map<string, Declared>();
  for (const item of Object.values(document.paths))
    for (const operation of Object.values(item)) {
      const declared = operation["x-platformkit-auth"];
      if (declared?.permission)
        out.set(declared.permission, {
          permission: declared.permission,
          operator: declared.kind === "operator_permission",
          surface: operation["x-platformkit-surface"] ?? "",
        });
    }
  return [...out.values()];
})();

test("an account granted the wildcard is minted the permissions this phone can call", async () => {
  const { api, mints } = signInThrough([WILDCARD]);
  const answer = await api.signIn(loginIdentity.email, "password");
  assert.equal(answer.kind, "signed-in", "the built-in administrator gets a key");
  assert.equal(mints.length, 1, "the phone asks once");
  const scopes = mints[0]!.body.scopes as string[];
  assert.ok(!scopes.includes(WILDCARD), "the rule that stands for permissions is never a scope");
  assert.deepEqual([...scopes].sort(), appGrants.map((grant) => grant.permission).sort());
});

/** appGrants is the document's own list of the permissions a phone can ask for. */
const appGrants = readPermissions.filter((grant) => !grant.operator && grant.surface === "app");

test("an account granted a role is minted the permissions that role names", async () => {
  const { api, mints } = signInThrough(["task:read", "task:update"]);
  assert.equal((await api.signIn(loginIdentity.email, "password")).kind, "signed-in");
  assert.deepEqual(mints[0]!.body.scopes, ["task:read", "task:update"]);
});

test("a grant held only by the installation's operator stays out of a phone's key", async () => {
  // The bootstrapped owner holds the wildcard and the two operator grants the
  // control plane asks with. Handing those to the mint is a 422 in every tenant
  // that is not the operator's own (contracts.CheckedPermissions), and this phone
  // calls no control-plane route.
  const { api, mints } = signInThrough([WILDCARD, "tenant:manage", "billing:catalog"]);
  assert.equal((await api.signIn(loginIdentity.email, "password")).kind, "signed-in");
  const scopes = mints[0]!.body.scopes as string[];
  for (const operator of readPermissions.filter((grant) => grant.operator))
    assert.ok(
      !scopes.includes(operator.permission),
      `${operator.permission} is not a phone's scope`,
    );
});

test("the permissions a wildcard stands for are the ones the document declares, not a list written here", () => {
  const fromDocument = readPermissions
    .filter((grant) => !grant.operator && grant.surface === "app")
    .map((grant) => grant.permission)
    .sort();
  assert.deepEqual(delegableScopes([WILDCARD], readPermissions).sort(), fromDocument);
  assert.ok(fromDocument.includes("task:read"), "the phone's own module is in its own key");
});

test("an account granted nothing is refused a key in the phone's own words", async () => {
  const { api, mints } = signInThrough([]);
  await assert.rejects(api.signIn(loginIdentity.email, "password"), /grants nothing/);
  assert.deepEqual(mints, [], "nothing is asked of the mint");
  assert.equal(api.bearer(), undefined);
});
