// The two doors that mint a sign-in — the password at auth-login and the code at
// auth-challenge-verify — are refused by the kernel unless the request reads as
// same-site: kit/httpx's SameSite accepts a Sec-Fetch-Site of same-origin or none,
// or no Sec-Fetch-Site and either no Origin or one naming the request's own host,
// and modules/auth answers anything else with a 403 that tells the person to
// "answer the second factor from the sign-in page itself". A phone is the case
// that rule accepts by presenting nothing, so what src/effects/api.ts strips from
// a generated request before it leaves is the contract this file holds: no Origin,
// no Sec-Fetch-Site, and on these two public doors no credential of either kind,
// because a request that carried a cookie and a key together is answered as
// anonymous (kit/httpx/authenticate.go's ambiguousCredential).
import assert from "node:assert/strict";
import test from "node:test";
import { createApi } from "../src/effects/api";
import { FACTOR_REQUIRED_DETAIL } from "../src/core/signInOutcome";
import { issuedTokenResponse, loginIdentity, loginResponse } from "./fakes/wire";

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly headers: Headers;
}

/** The headers the kernel's same-site rule and its credential rule read, by name. */
const browserOnly = ["origin", "sec-fetch-site"] as const;
const credentials = ["cookie", "authorization"] as const;

/**
 * signInThroughTheFactor walks the whole way in over a recording transport — a
 * password the server refuses for the second half, a code it accepts with a
 * session, the mint that session pays for — on the connection the shell makes for
 * a sign-in, which holds nothing yet, and hands back every request as it left.
 */
async function signInThroughTheFactor(): Promise<Sent[]> {
  const sent: Sent[] = [];
  const api = createApi("https://factor.example.test", (async (
    input: string | URL | Request,
    init: RequestInit = {},
  ) => {
    const path = new URL(String(input)).pathname;
    sent.push({ method: init.method ?? "GET", path, headers: new Headers(init.headers) });
    if (path === "/api/v1/auth/login")
      return new Response(
        JSON.stringify({ type: "about:blank", status: 401, detail: FACTOR_REQUIRED_DETAIL }),
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    if (path === "/api/v1/auth/challenge/verify")
      return loginResponse({ headers: { "Set-Cookie": "pk=factor-session; HttpOnly" } });
    if (path === "/api/v1/auth/tokens") return issuedTokenResponse();
    return new Response(JSON.stringify({ status: 404 }), {
      status: 404,
      headers: { "Content-Type": "application/problem+json" },
    });
  }) as typeof fetch);
  const answer = await api.signIn(loginIdentity.email, "password");
  assert.equal(answer.kind, "factor-required");
  await api.answerFactor(loginIdentity.email, "123456");
  return sent;
}

test("the password and the code are offered with no Origin, no Sec-Fetch-Site and no credential", async () => {
  const sent = await signInThroughTheFactor();
  const doors = sent.filter(
    (request) =>
      request.path === "/api/v1/auth/login" || request.path === "/api/v1/auth/challenge/verify",
  );
  assert.deepEqual(
    doors.map((request) => `${request.method} ${request.path}`),
    ["POST /api/v1/auth/login", "POST /api/v1/auth/challenge/verify"],
    "both public doors were knocked on, once each, in order",
  );
  for (const request of doors) {
    for (const name of [...browserOnly, ...credentials])
      assert.equal(
        request.headers.get(name),
        null,
        `${request.path} must leave without ${name}; it carried ${request.headers.get(name)}`,
      );
    assert.match(
      request.headers.get("content-type") ?? "",
      /^application\/json/,
      `${request.path} says what it carries`,
    );
  }
  // The same transport, one request later, does carry a credential: the mint goes
  // with the session the code earned and with that alone, so the doors above are
  // bare by rule and not because this transport never sends anything.
  const mint = sent.find((request) => request.path === "/api/v1/auth/tokens");
  assert.ok(mint, "the accepted code was followed by a mint");
  assert.equal(mint.headers.get("cookie"), "pk=factor-session");
  assert.equal(mint.headers.get("authorization"), null);
  for (const name of browserOnly) assert.equal(mint.headers.get(name), null);
});
