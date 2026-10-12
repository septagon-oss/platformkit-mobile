// Signing out answers one question with two facts: whether the server stopped the
// key, and whether the person still has a key to stop. Only a key the phone forgot
// and the server may still spend is a key somebody has to go and remove — a
// connection that held none leaves nothing, and a key the server refuses as a
// caller it does not recognise is dead wherever it is. The kernel refuses
// everything with a 403 and names the code first (kit/httpx/authorize.go: "Every
// refusal is a 403, never a 401"), so the two 403s below — the one that knows the
// caller and refuses the asking, the one that knows nobody — are the whole of the
// difference the screen draws its sentence from.
import assert from "node:assert/strict";
import test from "node:test";
import { createApi, type Api } from "../src/effects/api";
import { issuedToken, issuedTokenResponse, loginIdentity, loginResponse } from "./fakes/wire";

const BASE = "https://member.example.test";
const HOLDER_SESSION = "pk=synthetic-holder";
/** The 403 kit/httpx writes for a scoped credential standing at a door that
 * answers to its holder only: the key is real, the asking is not allowed. */
const DENIED =
  "AUTH_DENIED: this credential carries its own scope, and this operation answers only to its holder";
/** The 403 kit/httpx writes for a caller it could not match to anybody, which is
 * what a revoked or expired bearer is carried as at every door. */
const ANONYMOUS = "AUTH_ANONYMOUS: this operation requires a signed-in caller";

/** refuse is a refusal in the shape the kernel writes it. One per request: a
Response body is read once. */
const refuse = (detail: string) =>
  new Response(JSON.stringify({ type: "about:blank", title: "Forbidden", status: 403, detail }), {
    status: 403,
    headers: { "Content-Type": "application/problem+json" },
  });

/**
 * server answers the two doors a sign-out knocks on with a refusal naming `code`,
 * mints a key for the sign-in that opens one, and records each request as
 * `method path credential` so a test can see who the phone asked with.
 */
function server(code: string, seen: string[]): typeof fetch {
  return (async (input, init = {}) => {
    const path = new URL(String(input)).pathname;
    const headers = new Headers(init.headers);
    const credential = headers.has("authorization")
      ? "key"
      : headers.get("cookie") === HOLDER_SESSION
        ? "holder"
        : "none";
    seen.push(`${init.method ?? "GET"} ${path} ${credential}`);
    if (path === "/api/v1/auth/login")
      return loginResponse({ headers: { "Set-Cookie": `${HOLDER_SESSION}; HttpOnly` } });
    if (path === "/api/v1/auth/tokens") return issuedTokenResponse();
    if (path.endsWith("/revoke") || path === "/api/v1/auth/logout") return refuse(code);
    return refuse("AUTH_DENIED: nothing here answers that");
  }) as typeof fetch;
}

/** restored is a phone that read its key back out of storage: the secret alone,
 * with no sign-in session behind it, which is every phone that was reopened. */
function restored(code: string, seen: string[]): Api {
  return createApi(BASE, server(code, seen), { token: issuedToken.token, id: issuedToken.id });
}

test("a sign-out that holds no key asks nothing and leaves nothing to remove", async () => {
  const seen: string[] = [];
  const phone = createApi(BASE, server(DENIED, seen));
  assert.deepEqual(await phone.logout(), { revoked: false, live: false });
  assert.deepEqual(seen, [], "a connection with no key sends no revoke to anybody");
});

test("a key refused at the door its holder alone answers is left for the person to stop", async () => {
  const seen: string[] = [];
  const phone = restored(DENIED, seen);
  assert.deepEqual(await phone.logout(), { revoked: false, live: true });
  assert.ok(phone.bearer() === undefined, "this phone forgets the key either way");
  assert.ok(
    seen.includes(`POST /api/v1/auth/tokens/${issuedToken.id}/revoke key`),
    "a restored key presents itself, because nothing else came back out of storage with it",
  );
});

test("a key the server does not recognise leaves nothing live to remove", async () => {
  const seen: string[] = [];
  const phone = restored(ANONYMOUS, seen);
  assert.deepEqual(await phone.logout(), { revoked: false, live: false });
  assert.ok(seen.length > 0, "the phone still asked, and the answer is what changed");
});

test("a sign-in whose own session the server no longer knows still leaves its key standing", async () => {
  const seen: string[] = [];
  const phone = createApi(BASE, server(ANONYMOUS, seen));
  const answer = await phone.signIn(loginIdentity.email, "synthetic-password");
  assert.equal(answer.kind, "signed-in");
  // The revoke went out with the session that minted the key, so "I know no
  // caller" is the session's own end: the key that outlives it was never
  // presented, and nothing here may claim it dead.
  assert.deepEqual(await phone.logout(), { revoked: false, live: true });
  assert.ok(
    seen.includes(`POST /api/v1/auth/tokens/${issuedToken.id}/revoke holder`),
    "the mint's own session is what a sign-out asks with while it holds one",
  );
});
