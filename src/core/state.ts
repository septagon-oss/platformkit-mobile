// The shell assigns each operation a generation before starting its effects.
// Only current operations may change the lifecycle or publish a catalog.
import type { Catalog } from "./catalog";

export type Phase = "booting" | "anonymous" | "signing-in" | "loading" | "ready" | "failed";

export interface State {
  readonly generation: number;
  readonly phase: Phase;
  readonly catalog?: Catalog;
  readonly error?: string;
}

export type Event = { readonly generation: number } & (
  | { readonly type: "no-session"; readonly error?: string }
  | { readonly type: "sign-in" }
  | { readonly type: "session" }
  | { readonly type: "catalog"; readonly catalog: Catalog }
  | { readonly type: "failed"; readonly error: string }
  | { readonly type: "signed-out"; readonly error?: string }
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
  }
}
