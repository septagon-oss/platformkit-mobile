// The shell assigns each operation a generation before starting its effects.
// Only current operations may change the lifecycle or publish a catalog.
import type { Catalog } from "./catalog";

export type Phase = "booting" | "anonymous" | "signing-in" | "loading" | "ready" | "failed";

export interface State {
  readonly generation: number;
  readonly phase: Phase;
  readonly catalog?: Catalog;
  readonly error?: string;
  /** reason names the anonymous the person is standing in. "expired" is the one the
   * server refused: this app still knows who they were and where they were, and asks
   * to be signed in again rather than signed in for the first time. Absent means the
   * ordinary sign-in screen, which is every path that never had a session to lose. */
  readonly reason?: "expired";
}

export type Event = { readonly generation: number } & (
  | { readonly type: "no-session"; readonly error?: string }
  | { readonly type: "sign-in" }
  | { readonly type: "session" }
  | { readonly type: "catalog"; readonly catalog: Catalog }
  | { readonly type: "failed"; readonly error: string }
  | { readonly type: "signed-out"; readonly error?: string }
  | { readonly type: "expired" }
);

export const initial: State = { phase: "booting", generation: 0 };

export function reduce(s: State, e: Event): State {
  if (e.generation < s.generation) return s;
  const generation = e.generation;
  switch (e.type) {
    case "no-session":
    case "signed-out":
      return { phase: "anonymous", generation, ...(e.error ? { error: e.error } : {}) };
    case "sign-in":
      return { phase: "signing-in", generation };
    case "session":
      return generation > s.generation || s.phase === "booting" || s.phase === "signing-in"
        ? { phase: "loading", generation }
        : s;
    case "catalog":
      return generation === s.generation && s.phase === "loading"
        ? { phase: "ready", generation, catalog: e.catalog }
        : s;
    case "failed":
      return generation === s.generation && s.phase === "loading"
        ? { phase: "failed", generation, error: e.error }
        : s;
    case "expired":
      // The server refused a session this app was using. Only a phase that has
      // one may lose it: a refusal that describes a shell which is booting,
      // anonymous, signing in or failed was answered by a session that is
      // already gone, and moves nobody. The catalogue goes with the session;
      // what the person was doing stays with the shell, not the state.
      return s.phase === "ready" || s.phase === "loading"
        ? { phase: "anonymous", generation, reason: "expired" }
        : s;
  }
}
