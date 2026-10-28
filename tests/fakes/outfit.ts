// The outfit service as a screen test sees it: one vocabulary — the owner's design — spelled the way
// the module spells it, answering the two reads this kit asks. The decisions held here are the
// service's rather than any one test's: the key spelling (`of1:<recipe>:<HEX-HEX-HEX>`), the
// uppercase hexes, the four-at-a-time window, where the last window is, and the `c1.` picture
// reference a key composes to. A screen tested against them is tested against the answers the
// product will get.
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
  readonly pieces: readonly (readonly [line: string, hex: string])[];
}

// The owner's four, then two more so a window has an end to be reached.
const ranking: readonly Design[] = [
  {
    recipe: "CITY-LAYERS",
    name: "City layers",
    piecesLine: "Coat · trousers · boots",
    pieces: [
      ["Terracotta wool coat", "#C8643F"],
      ["Ivory straight trousers", "#EFE6D8"],
      ["Brown leather boots", "#3A2E28"],
      ["Denim-blue scarf", "#5B7DA8"],
    ],
  },
  {
    recipe: "SOFT-WEEKEND",
    name: "Soft weekend",
    piecesLine: "Knit · jeans · sneakers",
    pieces: [
      ["Ivory knit top", "#EFE6D8"],
      ["Denim jeans", "#5B7DA8"],
      ["Terracotta sneakers", "#C8643F"],
      ["Tan leather bag", "#B07A4A"],
    ],
  },
  {
    recipe: "GALLERY-DAY",
    name: "Gallery day",
    piecesLine: "Knit · skirt · boots",
    pieces: [
      ["Denim knit top", "#5B7DA8"],
      ["Ivory midi skirt", "#EFE6D8"],
      ["Brown leather boots", "#3A2E28"],
      ["Terracotta bag", "#C8643F"],
    ],
  },
  {
    recipe: "EVENING-WALK",
    name: "Evening walk",
    piecesLine: "Coat · jeans · sneakers",
    pieces: [
      ["Ivory wool coat", "#EFE6D8"],
      ["Denim jeans", "#5B7DA8"],
      ["Terracotta sneakers", "#C8643F"],
      ["Brown knit beanie", "#3A2E28"],
    ],
  },
  {
    recipe: "STUDIO-LINES",
    name: "Studio lines",
    piecesLine: "Shirt · trousers · sneakers",
    pieces: [
      ["Ivory poplin shirt", "#EFE6D8"],
      ["Denim trousers", "#5B7DA8"],
      ["Terracotta sneakers", "#C8643F"],
    ],
  },
  {
    recipe: "MARKET-RUN",
    name: "Market run",
    piecesLine: "Knit · jeans · boots",
    pieces: [
      ["Terracotta knit top", "#C8643F"],
      ["Denim jeans", "#5B7DA8"],
      ["Brown leather boots", "#3A2E28"],
    ],
  },
];

/** page is how many looks the module answers at once — its own count, quoted from its contract. */
export const page = 4;

/** lookKeyOf spells one look's address: the recipe and the colours it wears, upper-cased as the module prints them. */
export const lookKeyOf = (design: Design): string =>
  `of1:${design.recipe}:${design.pieces
    .slice(0, 3)
    .map(([, hex]) => hex.replace("#", "").toUpperCase())
    .join("-")}`;

/** composedOf is the picture a look's key composes to: `c1.` and the key, base64url-encoded. */
const composedOf = (key: string): string => `c1.${Buffer.from(key, "utf8").toString("base64url")}`;

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
    version: `v-${design.recipe.toLowerCase()}`,
  };
};

/** suggestionAt is the window that starts at `skip`: the looks there, the answers they were made from, and whether anything follows. */
export const suggestionAt = (skip: number): SuggestionWire => {
  const looks = ranking.slice(skip, skip + page).map(lookOf);
  return {
    looks,
    colours: answers,
    season: "Autumn",
    style: "Minimal",
    skip,
    ended: skip + page >= ranking.length,
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
