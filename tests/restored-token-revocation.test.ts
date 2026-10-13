// What survives a restart on this phone is the key alone — the session that
// signed in is held in memory for as long as the key it minted is held and never
// written down — and `auth-token-revoke` answers to that session, not to the key.
// So a sign-out has two true answers, decided by what the run still holds. A key
// minted by this run stops on the server, and the same key must no longer read. A
// key read back out of storage brings nothing but itself, so the sign-out forgets
// it here and says that this device could not revoke it, naming where the account
// can; a phone that minted no key and holds no session has no door through which
// to claim that key dead. When a scoped credential is given such a door, the
// restored arm below starts answering `revoked: true`, and that is the point to
// move its assertion down to the read the minted arm makes of its own key.
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, type Api, createApi } from "../src/effects/api";
import { kitEnglish, kitPortuguese } from "../src/core/kitCopy";
import { createSessionStore } from "../src/effects/session";
import {
  issuedTokenResponse,
  loginIdentity,
  loginResponse,
  logoutResponse,
  revokeResponse,
} from "./fakes/wire";

/**
 * NOT_STOPPED is the sentence a sign-out owes the person when this phone forgot a
 * key the server still answers to. It is contract rather than decoration, so it is
 * pinned as written: a screen that said only "signed out" would hand the reader a
 * live credential they believe is dead.
 */
const NOT_STOPPED =
  "This device's key could not be revoked from here; remove it from your account's devices.";

const BASE = "https://member.example.test";
const HOLDER_SESSION = "pk=synthetic-holder";

/**
 * signedInPhone signs in over a server that applies the pinned kernel's own door
 * rules — every route that answers to the holder refuses a credential carrying
 * its own scopes, and work routes read the key — stores the key it is given, and
 * hands back the connection plus a second connection holding the same key.
 * `restart` reads the key back out of storage into a fresh connection first, as a
 * phone that was killed and reopened does; the connection it returns then holds a
 * key with nothing behind it.
 */
async function signedInPhone(restart: boolean): Promise<{
  phone: Api;
  replay: Api;
  storage: ReturnType<typeof createSessionStore>;
}> {
  let stopped = false;
  let stored: string | null = null;
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
      return loginResponse({ headers: { "Set-Cookie": `${HOLDER_SESSION}; HttpOnly` } });
    if (path === "/api/v1/app/resources") {
      if (stopped || !headers.has("authorization")) return problem(401);
      return new Response(JSON.stringify({ resources: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // auth-token-issue, auth-token-revoke and auth-logout are SignedIn.
    if (headers.has("authorization")) return problem(403);
    if (headers.get("cookie") !== HOLDER_SESSION) return problem(401);
    if (path === "/api/v1/auth/tokens") return issuedTokenResponse();
    if (path.endsWith("/revoke")) {
      stopped = true;
      return revokeResponse();
    }
    if (path === "/api/v1/auth/logout") return logoutResponse();
    return problem(404);
  };
  let phone = createApi(BASE, transport);
  const answer = await phone.signIn(loginIdentity.email, "synthetic-password");
  assert.equal(answer.kind, "signed-in");
  const key = phone.bearer();
  assert.ok(key);
  await storage.save({ baseURL: BASE, token: key.token, tokenId: key.id });
  if (restart) {
    const saved = await storage.load();
    assert.ok(saved?.token && saved.tokenId);
    phone = createApi(saved.baseURL, transport, { token: saved.token, id: saved.tokenId });
  }
  const replay = createApi(BASE, transport, key);
  await replay.catalog();
  return { phone, replay, storage };
}

test("sign-out stops a key through the session that minted it", async () => {
  const { phone, replay, storage } = await signedInPhone(false);
  const { revoked } = await phone.logout();
  // The shell's own half of a sign-out, which the screen drives beside the call
  // above: this phone forgets the key whether or not the server stopped it.
  await storage.clear(BASE);
  assert.equal(revoked, true, "this run holds the session that minted the key");
  assert.equal(phone.bearer(), undefined);
  assert.equal((await storage.load())?.token, undefined);
  await assert.rejects(
    replay.catalog(),
    (error: unknown) => error instanceof ApiError && error.status === 401,
    "the same key must no longer read after sign-out",
  );
});

test("signing out of a key restored from storage forgets it here and says it was not revoked", async () => {
  const { phone, storage } = await signedInPhone(true);
  const { revoked } = await phone.logout();
  await storage.clear(BASE);
  // The key came back out of storage alone, so the revoke this sign-out made was
  // refused at a door that answers only to the holder. Forgetting is still owed,
  // and the answer still says what the server did not do.
  assert.equal(revoked, false, "forgetting a key here is not stopping it there");
  assert.equal(phone.bearer(), undefined);
  assert.equal((await storage.load())?.token, undefined, "nothing here signs with it again");
  assert.equal(kitEnglish.keyNotStopped, NOT_STOPPED);
  assert.notEqual(kitPortuguese.keyNotStopped, kitEnglish.keyNotStopped);
  assert.match(kitPortuguese.keyNotStopped, /chave/);
});
