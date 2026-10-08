// Public synthetic responses that satisfy the pinned auth contract.
// permissions is not empty because the phone mints its key from exactly this
// list, and an account granted nothing is refused the sign-in (§ src/effects/api.ts).
export const loginIdentity = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "member@example.test",
  roles: [],
  permissions: ["note.read"],
};

/**
 * issuedToken is auth-token-issue's answer: the key appears here and nowhere
 * else, and the id is what the revoke at sign-out addresses.
 */
export const issuedToken = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "This phone",
  createdAt: "2026-10-07T21:00:00Z",
  createdBy: loginIdentity.userId,
  expiresAt: "2026-11-06T21:00:00Z",
  lastUsedAt: "2026-10-07T21:00:00Z",
  scopes: loginIdentity.permissions,
  token: "pk_live_this_phone",
};
export const loginResponse = (init: ResponseInit = {}) =>
  new Response(JSON.stringify(loginIdentity), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
/**
 * issuedTokenResponse wraps that answer in the 201 the operation prints. `over`
 * replaces a member for a test that needs two distinct mints.
 */
export const issuedTokenResponse = (
  init: ResponseInit = {},
  over: Partial<typeof issuedToken> = {},
) =>
  new Response(JSON.stringify({ ...issuedToken, ...over }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
/** revokeResponse is auth-token-revoke's answer: the key is spent and says so. */
export const revokeResponse = (init: ResponseInit = {}) =>
  new Response(JSON.stringify({ done: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
export const logoutResponse = (init: ResponseInit = {}) =>
  new Response(JSON.stringify({ signedOut: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

/** Screen fixtures omit wire members their models do not display. Supply those
 * members here; transport-contract tests construct their Responses directly. */
export function pageResponse(body: unknown, status = 200): Response {
  let wire = body;
  if (body && typeof body === "object" && "items" in body && Array.isArray(body.items)) {
    wire = {
      limit: 20,
      offset: 0,
      ...body,
      items: body.items.map((item: Record<string, unknown>) => {
        if ("occurredAt" in item)
          return { eventId: "77777777-7777-4777-8777-777777777777", ...item };
        if ("displayName" in item) return { email: "directory@example.test", ...item };
        return item;
      }),
    };
  }
  return new Response(JSON.stringify(wire), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
