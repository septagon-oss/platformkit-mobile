// state.ts is the shell's lifecycle as a reducer: five phases, five events,
// one pure function. Effects (loading a session, fetching the catalog) happen
// outside and report in as events, so what the shell believes is always the
// result of a sequence a test can replay.
import type { Catalog } from "./catalog";

export type Phase = "booting" | "anonymous" | "loading" | "ready" | "failed";

export interface State {
  readonly phase: Phase;
  readonly catalog?: Catalog;
  readonly error?: string;
}

export type Event =
  | { readonly type: "no-session" }
  | { readonly type: "session" }
  | { readonly type: "catalog"; readonly catalog: Catalog }
  | { readonly type: "failed"; readonly error: string }
  | { readonly type: "signed-out" };

export const initial: State = { phase: "booting" };

export function reduce(_s: State, e: Event): State {
  switch (e.type) {
    case "no-session":
      return { phase: "anonymous" };
    case "session":
      return { phase: "loading" };
    case "catalog":
      return { phase: "ready", catalog: e.catalog };
    case "failed":
      return { phase: "failed", error: e.error };
    case "signed-out":
      return { phase: "anonymous" };
  }
}
