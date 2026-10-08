import assert from "node:assert/strict";
import test from "node:test";
import { createApi, ApiError } from "../src/effects/api";
import { issuedToken, issuedTokenResponse, loginIdentity, loginResponse } from "./fakes/wire";

test("an accepted factor mints only the granted scopes with the server default lifetime", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createApi("https://factor.test", (async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/challenge/verify"))
      return loginResponse({ headers: { "Set-Cookie": "pk=factor-session; HttpOnly" } });
    if (String(url).endsWith("/tokens")) return issuedTokenResponse();
    return loginResponse();
  }) as typeof fetch);
  assert.deepEqual(await api.answerFactor(loginIdentity.email, " 123456 "), {
    token: issuedToken.token,
    id: issuedToken.id,
  });
  await api.me();
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), {
    email: loginIdentity.email,
    code: "123456",
  });
  assert.deepEqual(JSON.parse(String(calls[1]!.init.body)), {
    name: "This phone",
    scopes: loginIdentity.permissions,
  });
  const mint = new Headers(calls[1]!.init.headers);
  assert.equal(mint.get("cookie"), "pk=factor-session");
  assert.equal(mint.get("authorization"), null);
  const read = new Headers(calls[2]!.init.headers);
  assert.equal(read.get("cookie"), null);
  assert.equal(read.get("authorization"), `Bearer ${issuedToken.token}`);
});

for (const status of [401, 503]) {
  test(`a factor refused with ${status} mints nothing and leaves no bearer`, async () => {
    const paths: string[] = [];
    const api = createApi("https://factor.test", (async (url) => {
      paths.push(new URL(String(url)).pathname);
      return new Response(JSON.stringify({ status, detail: "factor unavailable or refused" }), {
        status,
        headers: { "Content-Type": "application/problem+json" },
      });
    }) as typeof fetch);
    await assert.rejects(
      api.answerFactor(loginIdentity.email, "000000"),
      (e: unknown) => e instanceof ApiError && e.status === status,
    );
    assert.deepEqual(paths, ["/api/v1/auth/challenge/verify"]);
    assert.equal(api.bearer(), undefined);
  });
}
