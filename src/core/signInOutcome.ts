// Two decisions about a credential that did not work, and they are not the
// same decision. A 401 from the password leg means "one more thing is
// missing" and the person answers it on the same screen; a 401 from a request
// made while signed in means the key is dead and the only way out is the
// sign-in screen. Each is drawn once, here, so no screen invents its own.
//
// The kernel answers both with `application/problem+json`, a 401 and
// `type: "about:blank"` (kit/problem/problem.go gives every problem that type
// — "the status code says everything there is to say"), so a factor challenge
// and a wrong password differ only in their sentence until the server names a
// type of its own. The drift test in tests/sign-in-outcome.test.ts reads the
// pinned document and refuses this fallback the day it does.
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

/**
 * expiredCredential is true of the answer every signed-in request can get
 * once its key is dead: revoked on the server, past its lifetime, or deleted
 * with the account. It is false of 402, which is a pricing answer with its
 * own sentence and its own way out (ApiError.excluded), and false of 403,
 * which says this person may not do that thing while still being signed in.
 */
export function expiredCredential(e: unknown): boolean {
  const refusal = e as RefusalShape | null;
  return (
    !!refusal &&
    typeof refusal.status === "number" &&
    refusal.status === 401 &&
    typeof refusal.detail === "string"
  );
}
