// The two models the outfit screens draw. Each is one call to the kit's own derivation, so the wall's
// states, its foot control and its picture slots have one owner, and a look's lines are drawn from
// the same body the heart quotes.
import type { PictureStates } from "../../core/pictures";
import { deriveMedia, deriveMediaHero, type MediaItem } from "../../core/media";
import { deriveState, readPhase } from "../../core/present";
import { build, type Content, type Page, type Validation } from "../../core/shared";
import type { Presentation } from "../../core/presentation";
import { captionOf, lookItem } from "./read";
import type { LookWire, PieceWire } from "./wire";

/** The wall's inputs: what the read answered, and what this phone can ask a picture of. */
export interface WallInput {
  readonly looks: readonly LookWire[];
  readonly error: string;
  readonly asking: boolean;
  /** ended is the module's word for there being nothing further to ask for. */
  readonly ended: boolean;
  readonly pictures: boolean;
  readonly states: PictureStates;
}

/**
 * refusal is the sentence a read that answered no puts in words, with the one action that asks for
 * it again. `path` names what the person was reading, so the sentence is about the thing on their
 * screen; the message itself is the server's, in the reader's language.
 */
export const refusal = (error: string, path: string, p: Presentation) =>
  deriveState(
    {
      kind: "error",
      issue: { code: "read-failed", path, recovery: "correctable", message: error },
      action: {
        intent: "retry-read",
        control: { id: "refresh", label: p.copy.state.retry, tone: "plain", state: "ready" },
      },
    },
    p,
  );

/**
 * deriveWall is the wall of looks as one model: one cell per look, in the order the module ranked
 * them, the state that answers when nothing arrived, and the foot control that asks for the next
 * window — drawn only while the module says a further window exists.
 */
export function deriveWall(input: WallInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const phase = readPhase(
      input.asking && input.looks.length === 0,
      input.looks.length,
      input.error,
    );
    const content: Content<readonly MediaItem[]> =
      phase === "loading"
        ? { phase: "loading" }
        : phase === "empty"
          ? { phase: "empty", state: v.take(deriveState({ kind: "empty" }, p)) }
          : phase === "error"
            ? { phase: "error", state: v.take(refusal(input.error, "looks", p)) }
            : {
                phase: "ready",
                value: input.looks.map((look) =>
                  lookItem(look, input.pictures, input.states, look.piecesLine),
                ),
                refresh: input.error !== "" ? "error" : input.asking ? "loading" : "idle",
                // A window that refused while an earlier one is on screen is a sentence above the
                // cards, not a wall that emptied.
                ...(input.error === "" ? {} : { notice: v.take(refusal(input.error, "looks", p)) }),
              };
    const page: Page = { more: phase === "ready" && !input.ended, loading: input.asking };
    return v.take(deriveMedia({ content, page, moreLabel: p.copy.outfit.moreIdeas }, p));
  });
}

/** pieceLine is one garment as the module described it, with the colour that paints it. */
export interface PieceLine {
  readonly id: string;
  readonly line: string;
  readonly hex: string;
}

const pieceLine = (piece: PieceWire, index: number): PieceLine => ({
  id: `${piece.part}-${index}`,
  line: piece.line,
  hex: piece.hex,
});

/**
 * deriveLook is one look as its page draws it: the flat-lay as a hero, the name, the two answers it
 * was composed under, one line per piece in the order the module laid them out, the look's own
 * ground for the frame to hold while the picture arrives, and the sentence a refused read left.
 *
 * A refresh that refused is a notice above the look, never a look that emptied: what stays on screen
 * is the last copy this phone read, and the page says so instead of letting it pass for current.
 */
export function deriveLook(
  input: {
    readonly look: LookWire;
    readonly error: string;
    readonly pictures: boolean;
    readonly states: PictureStates;
  },
  p: Presentation,
) {
  const look = input.look;
  return build(p, (v: Validation) => ({
    hero: v.take(deriveMediaHero({ item: lookItem(look, input.pictures, input.states) }, p)),
    caption: captionOf([...look.seasons, look.style]),
    pieces: look.pieces.map(pieceLine),
    background: look.background,
    ...(input.error === "" ? {} : { notice: v.take(refusal(input.error, "look", p)) }),
  }));
}
