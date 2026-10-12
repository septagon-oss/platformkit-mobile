// reentry.ts is the rule behind coming back in: who a session belonged to, and
// where the person was standing when the server refused it. The shell holds the
// answer; this file decides it, so the comparison — the one privacy line in this
// app — is a function a test can ask directly rather than a branch inside a
// component. A session is bound to the server it was made against and the user
// id that server named for it: the catalogue answers no tenant, so no tenant is
// invented here, and two sign-ins at two servers are two identities even for one
// user id.
import type { Entry } from "./catalog";
import { screenPath } from "./derive";

/** Who is who the server said a session belongs to, in one string. */
export type Who = string;

/**
 * who is that binding, or undefined for a session the server never identified.
 * `GET /auth/me` answering nothing is not "the same person" as anything, so an
 * unknown session gets no identity rather than a guessed one.
 */
export function who(baseURL: string, userId: string | undefined): Who | undefined {
  if (!userId) return undefined;
  try {
    return `${new URL(baseURL).origin}|${userId}`;
  } catch {
    return undefined;
  }
}

/**
 * samePerson is the whole line: what one person left behind goes to that person
 * and nobody else. Unknown on either side is never "the same", which is the
 * conservative side of a line drawn in memory rather than on a screen.
 */
export const samePerson = (previous: Who | undefined, next: Who | undefined): boolean =>
  previous !== undefined && next !== undefined && previous === next;

/** Remembered is what a refused session leaves for the person it belonged to: where they
 * were, who they were, and the email to start the sign-in form on. */
export interface Remembered {
  readonly href: string;
  readonly who: Who;
  readonly email: string;
}

/** ScreenKind is which of the four generated screens an address is. It is named here rather
 * than taken from `src/renderers.ts` because the core names no component type; `ResourceRoute`
 * passes its own `kind: keyof Renderer` into `address`, so a fifth renderer kind that this
 * union does not name stops the build rather than drawing a blank address. */
export type ScreenKind = "list" | "detail" | "form" | "command";

/**
 * address spells one screen's route, once, in the words the router uses:
 * `screenPath` for a list (which for a singleton is the record itself), the row
 * for a detail, `new` or the row's `edit` for a sheet, and `run/<verb>` — at the
 * row or at the collection — for a command.
 */
export function address(kind: ScreenKind, e: Entry, id?: string, verb?: string): string {
  const at = screenPath(e);
  const row = id === undefined ? undefined : encodeURIComponent(id);
  switch (kind) {
    case "list":
      return at;
    case "detail":
      return `${at}/${row ?? ""}`;
    case "form":
      return row === undefined ? `${at}/new` : `${at}/${row}/edit`;
    case "command":
      return row === undefined
        ? `${at}/run/${encodeURIComponent(verb ?? "")}`
        : `${at}/${row}/run/${encodeURIComponent(verb ?? "")}`;
  }
}
