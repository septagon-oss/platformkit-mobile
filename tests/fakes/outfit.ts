// The outfit service as a screen test sees it: one vocabulary — the owner's design — spelled the way
// the module spells it, answering the two reads this kit asks. The decisions held here are the
// service's rather than any one test's: the key grammar `of1:<recipe>:#HEX-#HEX-#HEX`, minted from
// the three colours the design's slots wear over the recipe id `rNN-<words>`, the uppercase hexes,
// the four-at-a-time window that rotates instead of running short, where that window ends, and the
// `c1.` picture reference a key composes to. A screen tested against them is tested against the
// answers the product will get.
import { createHash } from "node:crypto";
import type { Entry } from "../../src/core/catalog";
import { composedReference } from "../../src/core/pictures";
import type { LookWire, SuggestionWire } from "../../src/packs/outfit/wire";
import { fakeApi, note, type FakeApi } from "./shell";

/** looksEntry is the source entry as a catalogue would print it: read-only, one collection path. */
export const looksEntry: Entry = {
  ...note,
  module: "outfit",
  entity: "look",
  path: "/api/v1/outfit/looks",
  writable: true,
  operations: ["list", "read"],
};

export const answers = [
  { id: "terracotta", name: "Terracotta", hex: "#C8643F" },
  { id: "ivory", name: "Ivory", hex: "#EFE6D8" },
  { id: "denim", name: "Denim", hex: "#5B7DA8" },
];

/** Design is one look of the ranking: its recipe, its name, the pieces it wears and the line under its card. */
interface Design {
  readonly recipe: string;
  readonly name: string;
  readonly piecesLine: string;
  /** worn are the three palette colours this design's own slots take, in slot order: the colours a key is minted from, which are not the four a person reads — a garment the drawing keeps in its own material names no slot. */
  readonly worn: readonly string[];
  readonly pieces: readonly (readonly [line: string, hex: string])[];
}

// The owner's four, then two more so a window has an end to be reached.
const ranking: readonly Design[] = [
  {
    recipe: "r01-city-layers",
    name: "City layers",
    piecesLine: "Coat · trousers · boots",
    worn: ["#C8643F", "#EFE6D8", "#5B7DA8"],
    pieces: [
      ["Terracotta wool coat", "#C8643F"],
      ["Ivory straight trousers", "#EFE6D8"],
      ["Brown leather boots", "#3A2E28"],
      ["Denim-blue scarf", "#5B7DA8"],
    ],
  },
  {
    recipe: "r02-soft-weekend",
    name: "Soft weekend",
    piecesLine: "Knit · jeans · sneakers",
    worn: ["#EFE6D8", "#5B7DA8", "#C8643F"],
    pieces: [
      ["Ivory knit top", "#EFE6D8"],
      ["Denim jeans", "#5B7DA8"],
      ["Terracotta sneakers", "#C8643F"],
      ["Tan leather bag", "#B07A4A"],
    ],
  },
  {
    recipe: "r03-gallery-day",
    name: "Gallery day",
    piecesLine: "Knit · skirt · boots",
    worn: ["#5B7DA8", "#EFE6D8", "#C8643F"],
    pieces: [
      ["Denim knit top", "#5B7DA8"],
      ["Ivory midi skirt", "#EFE6D8"],
      ["Brown leather boots", "#3A2E28"],
      ["Terracotta bag", "#C8643F"],
    ],
  },
  {
    recipe: "r04-evening-walk",
    name: "Evening walk",
    piecesLine: "Coat · jeans · sneakers",
    worn: ["#EFE6D8", "#5B7DA8", "#C8643F"],
    pieces: [
      ["Ivory wool coat", "#EFE6D8"],
      ["Denim jeans", "#5B7DA8"],
      ["Terracotta sneakers", "#C8643F"],
      ["Brown knit beanie", "#3A2E28"],
    ],
  },
  {
    recipe: "r05-studio-lines",
    name: "Studio lines",
    piecesLine: "Shirt · trousers · sneakers",
    worn: ["#EFE6D8", "#5B7DA8", "#C8643F"],
    pieces: [
      ["Ivory poplin shirt", "#EFE6D8"],
      ["Denim trousers", "#5B7DA8"],
      ["Terracotta sneakers", "#C8643F"],
    ],
  },
  {
    recipe: "r06-market-run",
    name: "Market run",
    piecesLine: "Knit · jeans · boots",
    worn: ["#C8643F", "#5B7DA8", "#3A2E28"],
    pieces: [
      ["Terracotta knit top", "#C8643F"],
      ["Denim jeans", "#5B7DA8"],
      ["Brown leather boots", "#3A2E28"],
    ],
  },
];

/** page is how many looks the module answers at once — its own count, quoted from its contract. */
export const page = 4;

/**
 * lookKeyOf mints one look's address the way `outfit` does: `of1:`, the recipe id, and the three
 * colours its slots wear, each still carrying the `#` that makes it a colour.
 */
export const lookKeyOf = (design: Design): string =>
  `of1:${design.recipe}:${design.worn.join("-")}`;

/** composedOf is the picture a look's key composes to: `c1.` and the key, base64url-encoded. */
const composedOf = (key: string): string => `c1.${Buffer.from(key, "utf8").toString("base64url")}`;

/** versionOf is the quote the module prints for one look: `of1-` and a digest of it, opaque here because it is opaque to this phone. */
const versionOf = (key: string): string => `of1-${createHash("sha256").update(key).digest("hex")}`;

/** lookOf is one look whole, in the shape the module answers with. */
export const lookOf = (design: Design): LookWire => {
  const key = lookKeyOf(design);
  return {
    id: design.recipe,
    name: design.name,
    style: "Minimal",
    seasons: ["Autumn"],
    pieces: design.pieces.map(([line, hex], at) => ({
      part: ["top", "bottom", "shoes", "accessory"][at] ?? "accessory",
      garment: line.split(" ").at(-1) ?? line,
      colour: line.split(" ")[0] ?? line,
      line,
      hex,
    })),
    piecesLine: design.piecesLine,
    background: "#ECE8E1",
    picture: composedOf(key),
    ref: { module: "outfit", kind: "look", key },
    version: versionOf(key),
  };
};

/**
 * suggestionAt is the window that starts at `skip`, cut the way the module cuts one: `page` looks
 * read round the ranking from that position, so a window near the end rotates back to the looks at
 * its front rather than running short, and `ended` says the ranking holds nothing past this window.
 */
export const suggestionAt = (skip: number): SuggestionWire => {
  const last = ranking.length;
  const looks: LookWire[] = [];
  for (let at = 0; at < page && at < last; at += 1)
    looks.push(lookOf(ranking[(skip + at) % last]!));
  return {
    looks,
    colours: answers,
    season: "Autumn",
    style: "Minimal",
    skip,
    ended: skip + page >= last,
  };
};

/** everyKey is each look's address, so a test can name one without spelling it. */
export const everyKey = (): string[] => ranking.map(lookKeyOf);

export const firstKey = (): string => lookKeyOf(ranking[0]!);

/**
 * outfitApi answers both reads over the transport's own validators and records every path it was
 * asked for, so a test can read where the window the screen holds came from. A body named in `over`
 * is answered verbatim instead, which is how the malformed-body cases reach the validator rather than
 * the screen; an Error named there is what that path answers with, which is how a window that refused
 * is a refusal the screen has to live with rather than a mock bolted onto the transport from outside.
 */
export function outfitApi(over: Readonly<Record<string, unknown>> = {}): FakeApi & {
  readonly asks: () => readonly string[];
} {
  const api = fakeApi();
  const asked: string[] = [];
  api.request.mockImplementation(async (_method, path, validate) => {
    asked.push(path);
    const held = Object.entries(over).find(([at]) => path.includes(at));
    if (held?.[1] instanceof Error) throw held[1];
    const body =
      held !== undefined
        ? held[1]
        : /\/looks\//.test(path)
          ? lookOf(ranking.find((design) => path.includes(encodeURIComponent(lookKeyOf(design))))!)
          : suggestionAt(
              Number(new URL(path, "https://fake.test").searchParams.get("skip") ?? "0"),
            );
    return validate(body);
  });
  return { ...api, asks: () => asked };
}

/** composedPictureRef is the token one of these looks' pictures arrives as, checked the way the kit checks it. */
export const composedPictureRef = (key: string): string => {
  const token = composedOf(key);
  if (!composedReference(token))
    throw new Error(`the fake composed an unusable reference: ${token}`);
  return token;
};
