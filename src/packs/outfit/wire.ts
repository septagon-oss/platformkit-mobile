// The outfit pack reads the module's own JSON projections, which the pinned document prints no route
// for. Each validator below is the shape the module answers with, so a body outside it is refused at
// the transport rather than drawn as a card with a missing member.
import { z } from "zod";
import { composedReference } from "../../core/pictures";

/** hex is the module's own spelling: it uppercases every colour it prints. */
const hex = z.string().regex(/^#[0-9A-F]{6}$/);

/** PaletteColourWire is one colour of the palette a look was composed from. */
export const paletteColourWire = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hex,
});

/** PieceWire is one garment of a look, in the order the module laid them out. */
export const pieceWire = z.object({
  part: z.string().min(1),
  garment: z.string().min(1),
  /** colour is the word for the shade this piece wears — the fill's own word, or the slot colour's. */
  colour: z.string().min(1),
  /** line is the module's whole sentence about the piece: its colour word and its noun. */
  line: z.string().min(1),
  /** hex is what the flat-lay paints this piece in, and what a line beside it paints its disc in. */
  hex,
});

/**
 * LookWire is one composed look. `ref.key` is the look's address — the recipe plus the three colours
 * actually worn — and a look whose key is missing can be neither opened nor kept, so it is required
 * here rather than defaulted. `version` is what a keep quotes: an empty quote says this phone saw no
 * version, so the module's own quote is required too.
 */
export const lookWire = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: z.string().min(1),
  seasons: z.array(z.string().min(1)).default([]),
  /** pieces: the garments laid out, top to accessory. A look with none was not composed. */
  pieces: z.array(pieceWire).min(1),
  /** piecesLine is the module's own join of its piece nouns; the phone never re-joins them. */
  piecesLine: z.string().min(1),
  /** background is the look's own ground, which is what a frame holds while its picture arrives. */
  background: hex,
  picture: z.unknown().refine(composedReference, "a composed picture reference"),
  ref: z.object({ module: z.string().min(1), kind: z.string().min(1), key: z.string().min(1) }),
  version: z.string().min(1),
});

/**
 * SuggestionWire is one window of the ranking: the looks it holds, the answers it completed itself
 * from, where the window sits (`skip`) and whether anything follows it (`ended`). A response is the
 * authority on where the window is, so both of the last two are required.
 */
export const suggestionWire = z.object({
  looks: z.array(lookWire),
  colours: z.array(paletteColourWire).default([]),
  season: z.string().default(""),
  style: z.string().default(""),
  skip: z.number().int().nonnegative(),
  ended: z.boolean(),
});

export type PaletteColourWire = Readonly<z.output<typeof paletteColourWire>>;
export type PieceWire = Readonly<z.output<typeof pieceWire>>;
export type LookWire = Readonly<z.output<typeof lookWire>>;
export type SuggestionWire = Readonly<z.output<typeof suggestionWire>>;
