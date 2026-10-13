// What a phone may ask the mint for, and what it must not ask for.
//
// A bearer key is narrowed, never escalated: the mint checks every scope against
// the permission catalogue the kernel declares and against what the holder's own
// roles already grant, before any row exists (modules/auth/internal/tokens.go's
// IssueToken). This function is the same shape as that command: the catalogue
// arrives as an argument rather than being looked up, because a client that knew
// which permissions exist would know a catalogue it does not own — and, like the
// server's SetRole, one that checked against a list it had copied would refuse a
// key for a permission the installation added this morning. src/effects/api.ts
// hands over the declarations the pinned document prints for its operations
// (x-platformkit-auth); nothing here names a permission of its own.
//
// Two rules from the kernel decide the answer, and both are worth stating
// because they are the reason the identity's own list cannot be forwarded.
//
// The wildcard is not a permission. It is the rule that answers for every
// permission in a tenant and for no operator one (modules/auth/contracts/roles.go
// says so in the comment over Grants), and the mint refuses it by name. Meanwhile
// the built-in administrator role grants `*` and nothing else
// (modules/auth/internal/seed.go), and login answers a role's permissions as the
// role stores them (modules/auth/internal/service.go's identify). So the one
// account that is granted everything is answered with a scope the mint will not
// take, and a phone that forwarded the list would lock out every administrator it
// ever meets. What a wildcard holder has, spelled out, is every permission the
// catalogue declares for this phone's own surface — which is what the first
// branch below returns.
//
// An operator grant is the other half: held only by the installation's operator,
// answered for by nothing else, and refused outright outside that tenant
// (contracts.CheckedPermissions). A phone calls the app surface and no other, so
// it never asks for one, whether or not the account names it.
//
// Everything else is the account's own list unchanged: a member's key is what
// the sign-in said they hold, and no more.
/**
 * DeclaredPermission is the shape of a catalogue entry as the document prints it:
 * a permission, whether the installation's operator holds it alone, and the
 * surface that asks for it. src/generated/grants.gen.ts reads that out of the
 * pinned document and satisfies this shape; naming it here instead of importing
 * it is what keeps a rule about permissions a plain function over its arguments.
 */
export interface DeclaredPermission {
  readonly permission: string;
  readonly operator: boolean;
  readonly surface: string;
}

/** WILDCARD is the auth module's own name for the rule-permission (contracts.Wildcard). */
export const WILDCARD = "*";

/** PHONE_SURFACE is the only one of the kernel's surfaces this phone calls. */
export const PHONE_SURFACE = "app";

/**
 * delegableScopes answers what the phone may ask the mint for, given the
 * permissions its own sign-in named and the catalogue the operations it can call
 * declare. An empty answer is the honest one for an account granted nothing: the
 * caller refuses the sign-in with it rather than mint a key with no scope, which
 * the kernel refuses too.
 */
export function delegableScopes(
  permissions: readonly string[],
  declared: readonly DeclaredPermission[],
): string[] {
  const operator = new Set(
    declared.filter((grant) => grant.operator).map((grant) => grant.permission),
  );
  const named = permissions.filter((p) => p !== WILDCARD && !operator.has(p));
  if (!permissions.includes(WILDCARD)) return named;
  const granted = declared
    .filter((grant) => !grant.operator && grant.surface === PHONE_SURFACE)
    .map((grant) => grant.permission);
  return [...new Set([...named, ...granted])].sort();
}
