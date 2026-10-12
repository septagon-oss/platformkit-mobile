// Two decisions about a credential that did not work, and they are not the
// same decision. A 401 from the password leg means "one more thing is
// missing" and the person answers it on the same screen; the refusal of a
// request made while signed in means the key is dead and the only way out is
// the sign-in screen. Each is drawn once, here, so no screen invents its own.
//
// The kernel answers both with `application/problem+json` and the type
// kit/problem/problem.go gives every problem whose status says it all
// ("about:blank"), so a factor challenge and a wrong password differ only in
// their sentence until the server names a type of its own. The drift test in
// tests/sign-in-outcome.test.ts reads the pinned document and refuses this
// fallback the day it does. A dead key is told apart by the code its refusal
// names, because "every refusal is a 403, never a 401" (kit/httpx/authorize.go)
import type { RefusalShape } from "./refusal";

/** The discriminator the kernel would use if it grew one, quoted from the
 * fallback it replaces: `urn:platformkit:auth:factor-required`. */
export const FACTOR_REQUIRED_TYPE = "urn:platformkit:auth:factor-required";

/** modules/auth/internal/handler.go's answer to ErrFactorRequired, at the
 * commit this build pins. It is English whatever the person speaks, which is
 * why it is matched exactly here and never quoted on screen. */
export const FACTOR_REQUIRED_DETAIL =
  "that password is right; this account also answers with a second factor";

/** factorRequired is asked of an error the password leg answered, and only
 * of one: a 401 from the code leg is a wrong code, and a 401 from a resource
 * read is an expired credential. Neither reaches this call. */
export function factorRequired(e: RefusalShape): boolean {
  if (e.status !== 401) return false;
  if (e.type === FACTOR_REQUIRED_TYPE) return true;
  // about:blank is every problem's type at the pinned commit (kit/problem), so
  // this sentence is the only thing that separates this 401 from a wrong
  // password. A type of its own that is not the one above says no.
  return (e.type === undefined || e.type === "about:blank") && e.detail === FACTOR_REQUIRED_DETAIL;
}

/** ANONYMOUS_CODE names the refusal kit/httpx/authorize.go writes for a caller
 * it could not match to anybody: a 403 whose detail opens with this code —
 * "this operation requires a signed-in caller". A bearer that buys nobody is
 * carried on as that anonymous caller, so this is what a phone gets at every
 * door once its key is dead, not only at the one it asked. */
export const ANONYMOUS_CODE = "AUTH_ANONYMOUS";

/**
 * unrecognisedCaller is true of a refusal that says the server does not know who
 * is asking, as opposed to the refusal that names the caller and refuses what it
 * asks for ("AUTH_DENIED: this credential carries its own scope…", which proves
 * the key is live). Ask it of any refusal made with the key in hand: the read of
 * a resource and the revoke at sign-out are refused the same way for the same
 * reason. A refusal with no detail, or a body this contract cannot read, is not
 * an answer about the key and says no.
 */
export function unrecognisedCaller(e: unknown): boolean {
  const refusal = e as RefusalShape | null;
  if (!refusal || refusal.status !== 403 || typeof refusal.detail !== "string") return false;
  // The kernel puts the code first and explains after a colon.
  return refusal.detail === ANONYMOUS_CODE || refusal.detail.startsWith(`${ANONYMOUS_CODE}:`);
}

/**
 * expiredCredential is true of the answer every signed-in request can get once
 * its key is dead: revoked from the account's devices, past the lifetime its mint
 * gave it, or deleted with the account. The kernel's own answer is the 403 of a
 * caller it does not know (unrecognisedCaller); a 401 is read the same way
 * because it is what HTTP says of a credential that did not work, and anything
 * answering between this phone and the kernel may say it in those words. It is
 * false of 402, which is a pricing answer with its own sentence and its own way
 * out (ApiError.excluded), and false of the other 403s, which say this person may
 * not do that thing while still being signed in.
 */
export function expiredCredential(e: unknown): boolean {
  if (unrecognisedCaller(e)) return true;
  const refusal = e as RefusalShape | null;
  return (
    !!refusal &&
    typeof refusal.status === "number" &&
    refusal.status === 401 &&
    typeof refusal.detail === "string"
  );
}
