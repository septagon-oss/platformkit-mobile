// A sign-out answers for the key it held, and for nothing else.
//
// Its two asks go out with two different credentials: the revoke with the session
// that minted the key, or with the key itself where the phone holds no session, and
// the close with that session alone (kit/httpx.SignedIn() refuses a scoped key at the
// revoke, and auth-logout answers to the holder). One can therefore be answered while
// the other is not, and the one sentence a signed-out screen has is about the key. So
// the key's verdict is what comes back and stands: a session the server would not
// close says nothing about a key already stopped and nothing the person could reach
// (src/effects/api.ts's SignOut), while a revoke that never answered at all is the
// one failure this call throws — and it throws only after the session it holds has
// been asked, because a sign-out that leaves a session standing leaves the person
// signed in somewhere.
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApi } from "../src/effects/api";
import {
  issuedToken,
  issuedTokenResponse,
  loginIdentity,
  loginResponse,
  logoutResponse,
  revokeResponse,
} from "./fakes/wire";

const BASE = "https://member.example.test";
const HOLDER_SESSION = "pk=synthetic-holder";
const REVOKE = `/api/v1/auth/tokens/${issuedToken.id}/revoke`;

/** unavailable is a server that took the request and did not answer it. */
const unavailable = () =>
  new Response(JSON.stringify({ status: 503, detail: "the session service is unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/problem+json" },
  });

/**
 * server opens a session for the password, mints from it, and answers the two
 * doors a sign-out knocks on with the verdicts this file decides. Each request is
 * recorded as `method path` in the order the phone made them.
 */
function server(doors: Record<string, () => Response>, seen: string[]): typeof fetch {
  return (async (input, init = {}) => {
    const path = new URL(String(input)).pathname;
    const method = init.method ?? "GET";
    seen.push(`${method} ${path}`);
    if (`${method} ${path}` === "POST /api/v1/auth/login")
      return loginResponse({ headers: { "Set-Cookie": `${HOLDER_SESSION}; HttpOnly` } });
    if (`${method} ${path}` === "POST /api/v1/auth/tokens") return issuedTokenResponse();
    const door = doors[`${method} ${path}`];
    return door ? door() : unavailable();
  }) as typeof fetch;
}

/** signedIn is a phone that signed in here, so it holds the session its key came from. */
async function signedIn(doors: Record<string, () => Response>, seen: string[]) {
  const phone = createApi(BASE, server(doors, seen));
  const answer = await phone.signIn(loginIdentity.email, "synthetic-password");
  assert.equal(answer.kind, "signed-in");
  seen.length = 0;
  return phone;
}

test("a session the server would not close leaves the key's confirmed stop alone", async () => {
  const seen: string[] = [];
  const phone = await signedIn(
    {
      [`POST ${REVOKE}`]: () => revokeResponse(),
      "POST /api/v1/auth/logout": unavailable,
    },
    seen,
  );
  assert.deepEqual(await phone.logout(), { revoked: true, live: false });
  assert.equal(phone.bearer(), undefined, "the phone forgets its key whatever the answer");
  assert.ok(seen.includes(`POST ${REVOKE}`), "the key was stopped");
  assert.ok(seen.includes("POST /api/v1/auth/logout"), "and the session was asked as well");
});

test("a revoke that never answered closes the session it went out with and stays uncertain", async () => {
  const seen: string[] = [];
  const phone = await signedIn({ [`POST ${REVOKE}`]: unavailable }, seen);
  // The key's own verdict is the one thing that may travel as a failure, because a
  // refusal to answer is not an answer and the screen has to say the key may live.
  await assert.rejects(phone.logout(), ApiError);
  assert.equal(phone.bearer(), undefined);
  assert.ok(
    seen.includes("POST /api/v1/auth/logout"),
    "the session this phone no longer holds is closed even when the ask about the key went unanswered",
  );
  assert.ok(seen.indexOf(`POST ${REVOKE}`) < seen.indexOf("POST /api/v1/auth/logout"));
});

test("a session close the server refused keeps the verdict the key already has", async () => {
  const seen: string[] = [];
  const phone = await signedIn(
    {
      [`POST ${REVOKE}`]: () => revokeResponse(),
      "POST /api/v1/auth/logout": () =>
        new Response(
          JSON.stringify({ type: "about:blank", status: 400, detail: "no such session" }),
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
    },
    seen,
  );
  assert.deepEqual(await phone.logout(), { revoked: true, live: false });
  assert.ok(seen.includes("POST /api/v1/auth/logout"));
});

test("a sign-out that closes both asks says nothing beyond the key it stopped", async () => {
  const seen: string[] = [];
  const phone = await signedIn(
    {
      [`POST ${REVOKE}`]: () => revokeResponse(),
      "POST /api/v1/auth/logout": () => logoutResponse(),
    },
    seen,
  );
  assert.deepEqual(await phone.logout(), { revoked: true, live: false });
  assert.deepEqual(seen, [`POST ${REVOKE}`, "POST /api/v1/auth/logout"]);
});
