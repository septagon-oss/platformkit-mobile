// The part of a refused request a rule in core may read. src/core names no
// transport, so the predicates in signInOutcome.ts ask about this shape and
// ApiError (src/effects/api.ts) satisfies it without being imported.
export interface RefusalShape {
  readonly status: number;
  readonly detail: string;
  /** type is the problem document's `type` member, absent when the body said none. */
  readonly type?: string | undefined;
}
