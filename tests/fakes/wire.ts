// Public synthetic responses that satisfy the pinned auth contract.
export const loginIdentity = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "member@example.test",
  roles: [],
  permissions: [],
};
export const loginResponse = (init: ResponseInit = {}) =>
  new Response(JSON.stringify(loginIdentity), {
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
