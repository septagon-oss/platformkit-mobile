// gesture.ts holds the one decision a swiped surface makes: where a drag has got.
// The surface that moves the ink, the surface a test drives and every threshold
// read this one answer, so a reveal width written in src/ui/scale.ts cannot mean
// one thing to the phone and another to the suite that checks it.

/** SwipeRead is where a trailing-edge drag has got. */
export interface SwipeRead {
  /** open is how much of the surface stands uncovered: never more than stands open, never less than nothing. */
  readonly open: number;
  /** armed says a release here runs what the surface holds. */
  readonly armed: boolean;
}

/**
 * readSwipe reads one drag of `travel` against the surface's `reveal` width.
 *
 * Both numbers are density-independent lengths from the same system: `travel` is
 * how far the finger has moved from where it landed, `reveal` how wide the
 * revealed surface is, which is also the threshold — what a person sees is exactly
 * what the phone requires. A drag past `reveal` still opens `reveal` and nothing
 * more, and is armed; one that stopped short is not.
 *
 * A drag that was never measured is a surface that shows nothing: a non-finite
 * `travel`, or a `reveal` that is not a positive length, answers closed and unarmed
 * rather than arming on a missing measurement.
 */
export function readSwipe(travel: number, reveal: number): SwipeRead {
  if (!Number.isFinite(travel) || !Number.isFinite(reveal) || reveal <= 0)
    return { open: 0, armed: false };
  return { open: Math.min(Math.max(travel, 0), reveal), armed: travel >= reveal };
}
