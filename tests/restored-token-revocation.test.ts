import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";
import { createSessionStore } from "../src/effects/session";
import {
  issuedTokenResponse,
  loginIdentity,
  loginResponse,
  logoutResponse,
  revokeResponse,
} from "./fakes/wire";

// The pinned server's SignedIn routes refuse scoped credentials. Keep the read
// independent of the logout answer: a warning is not proof the key stopped.
for (const restart of [false, true]) {
  test(`sign-out revokes a minted token ${restart ? "after restoration" : "without restarting"}`, async () => {
    let stopped = false;
    let stored: string | null = null;
    const baseURL = "https://member.example.test";
    const session = "pk=synthetic-holder";
    const storage = createSessionStore({
      getItemAsync: async () => stored,
      setItemAsync: async (_key, value) => {
        stored = value;
      },
    });
    const transport: typeof fetch = async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      const headers = new Headers(init.headers);
      const problem = (status: number) =>
        new Response(JSON.stringify({ status }), {
          status,
          headers: { "Content-Type": "application/problem+json" },
        });
      if (path === "/api/v1/auth/login")
        return loginResponse({ headers: { "Set-Cookie": `${session}; HttpOnly` } });
      if (path === "/api/v1/app/resources") {
        if (stopped || !headers.has("authorization")) return problem(401);
        return new Response(JSON.stringify({ resources: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      // auth-token-issue, auth-token-revoke and auth-logout are SignedIn.
      if (headers.has("authorization")) return problem(403);
      if (headers.get("cookie") !== session) return problem(401);
      if (path === "/api/v1/auth/tokens") return issuedTokenResponse();
      if (path.endsWith("/revoke")) {
        stopped = true;
        return revokeResponse();
      }
      if (path === "/api/v1/auth/logout") return logoutResponse();
      return problem(404);
    };
    let phone = createApi(baseURL, transport);
    const answer = await phone.signIn(loginIdentity.email, "synthetic-password");
    assert.equal(answer.kind, "signed-in");
    const key = phone.bearer();
    assert.ok(key);
    await storage.save({ baseURL, token: key.token, tokenId: key.id });
    if (restart) {
      const saved = await storage.load();
      assert.ok(saved?.token && saved.tokenId);
      phone = createApi(saved.baseURL, transport, { token: saved.token, id: saved.tokenId });
    }
    const replay = createApi(baseURL, transport, key);
    await replay.catalog();
    await phone.logout();
    await storage.clear(baseURL);
    assert.equal(phone.bearer(), undefined);
    assert.equal((await storage.load())?.token, undefined);
    await assert.rejects(
      replay.catalog(),
      (error: unknown) => error instanceof ApiError && error.status === 401,
      "the same key must no longer read after sign-out, including after a phone restart",
    );
  });
}
