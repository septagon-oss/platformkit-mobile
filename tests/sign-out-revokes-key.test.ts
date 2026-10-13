// Signing out stops the key on the server, not only on the phone.
//
// At the commit testdata/openapi.source.json pins, auth-token-revoke is declared
// httpx.SignedIn() (modules/auth/internal/token_routes.go), and a SignedIn
// operation refuses a credential that carries its own scopes with a 403 —
// "this credential carries its own scope, and this operation answers only to its
// holder" (kit/httpx/authorize.go). A key minted with scopes is such a
// credential. The fake below answers with those two rules: a scoped key is
// refused at every SignedIn door, the session a password opened is accepted
// there, and the revoke it accepts stops the key.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";
import { issuedToken, issuedTokenResponse, loginIdentity } from "./fakes/wire";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": status >= 400 ? "application/problem+json" : "application/json",
      ...headers,
    },
  });

test("signing out stops the key on the server", async () => {
  const stopped = new Set<string>();
  const sessions = new Set<string>(["pk=member"]);
  const api = createApi("https://member.test", (async (url, init = {}) => {
    const path = new URL(String(url)).pathname;
    const headers = new Headers(init.headers);
    const cookie = headers.get("cookie") ?? "";
    const bearer = headers.get("authorization") ?? "";
    if (path === "/api/v1/auth/login")
      return json(200, loginIdentity, { "Set-Cookie": "pk=member; HttpOnly" });
    // Every remaining door here is SignedIn. A scoped key does not stand in for
    // its holder at one; the holder's session does.
    if (bearer && !cookie)
      return json(403, {
        status: 403,
        title: "Forbidden",
        detail:
          "AUTH_DENIED: this credential carries its own scope, and this operation answers only to its holder",
      });
    if (!sessions.has(cookie)) return json(401, { status: 401, title: "Unauthorized" });
    if (path === "/api/v1/auth/tokens") return issuedTokenResponse();
    if (path === `/api/v1/auth/tokens/${issuedToken.id}/revoke`) {
      stopped.add(issuedToken.id);
      return json(200, { done: true });
    }
    if (path === "/api/v1/auth/logout") {
      sessions.delete(cookie);
      return json(200, { signedOut: true });
    }
    return json(404, { status: 404, title: "Not Found" });
  }) as typeof fetch);

  const answer = await api.signIn(loginIdentity.email, "password");
  assert.equal(answer.kind, "signed-in");
  await api.logout().catch(() => undefined);

  assert.equal(api.bearer(), undefined, "the phone forgets its key");
  assert.ok(stopped.has(issuedToken.id), "the server has stopped the key the phone signed with");
});
