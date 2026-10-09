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
    if (String(url).endsWith("/app/resources"))
      return new Response(JSON.stringify({ resources: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    return loginResponse();
  }) as typeof fetch);
  assert.deepEqual(await api.answerFactor(loginIdentity.email, " 123456 "), {
    token: issuedToken.token,
    id: issuedToken.id,
  });
  await api.me();
  await api.catalog();
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
  // Who this is answers to the holder, not to a key narrowed to a list of
  // permissions: auth-me is httpx.SignedIn(), and a scoped credential is refused
  // at every one of those doors (kit/httpx/authorize.go). So the phone that wants
  // an answer asks with the session its sign-in opened, and the alternative —
  // asking with the key and reading the 403 as "nobody" — is the phone never
  // knowing who it signed in as.
  const who = new Headers(calls[2]!.init.headers);
  assert.equal(who.get("cookie"), "pk=factor-session");
  assert.equal(who.get("authorization"), null);
  // The work is the other credential: the catalogue is the door a scoped key is
  // written for (kit/httpx.AnyCredential says so by name), and no request that
  // does work presents a session at all.
  const read = new Headers(calls[3]!.init.headers);
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
