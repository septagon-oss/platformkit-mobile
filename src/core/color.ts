// color.ts is the arithmetic a colour is a number through. The design export
// hands out hex strings (tokens.ts); what a component needs from them is two
// things the web standards already answer: a weighted blend done in linear
// light, and WCAG 2.2 §1.4.3's contrast ratio. Both live here, in the core, so
// the theme that mixes a role and the test that measures it read one rule.
// No colour is named here: a name belongs to the generated palette.

export type Channels = readonly [number, number, number, number];

/** Refused rather than guessed: a silent grey is a wrong screen nobody sees. */
const invalid = (token: string) => new Error(`invalid color: ${token}`);

const HEX = /^(?:#)?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9]*\.?[0-9]+)\s*)?\)$/;

/** parseColor reads the two forms the palette and a mix can produce. */
export function parseColor(color: string): Channels {
  const hex = HEX.exec(color.trim());
  if (hex) {
    const body = hex[1]!;
    // A three-digit hex is the four-digit one written shorter: each face repeats.
    const digits =
      body.length === 3
        ? body
            .split("")
            .map((pair) => `${pair}${pair}`)
            .join("")
        : body;
    const part = (i: number) => Number.parseInt(digits.slice(i, i + 2), 16);
    return [part(0), part(2), part(4), digits.length === 8 ? part(6) / 255 : 1] as const;
  }
  const rgb = RGBA.exec(color.trim());
  if (rgb)
    return [
      Number(rgb[1]),
      Number(rgb[2]),
      Number(rgb[3]),
      rgb[4] === undefined ? 1 : Number(rgb[4]),
    ] as const;
  throw invalid(color);
}

/** encodeColor writes the shortest form that keeps the alpha it carries. */
export function encodeColor([r, g, b, a]: Channels): string {
  if (a >= 1) {
    const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${round(a)})`;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

const toLinear = (byte: number): number => {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (light: number): number => {
  const s = light <= 0.0031308 ? light * 12.92 : 1.055 * light ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, s * 255));
};

/**
 * mix blends two colours in linear light, which is the only way a 6% accent
 * over paper stays the pale tint the reference screens show: blending the
 * bytes themselves muddies the result. weight 0 keeps `from`, 1 keeps `to`.
 */
export function mix(from: string, to: string, weight: number): string {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw invalid(`weight ${weight}`);
  const a = parseColor(from);
  const b = parseColor(to);
  return encodeColor([
    toSrgb(toLinear(a[0]) * (1 - weight) + toLinear(b[0]) * weight),
    toSrgb(toLinear(a[1]) * (1 - weight) + toLinear(b[1]) * weight),
    toSrgb(toLinear(a[2]) * (1 - weight) + toLinear(b[2]) * weight),
    a[3] * (1 - weight) + b[3] * weight,
  ]);
}

/** alpha sets how much of a colour shows through, for a scrim over a screen. */
export const alpha = (color: string, amount: number): string => {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) throw invalid(`alpha ${amount}`);
  const [r, g, b] = parseColor(color);
  return encodeColor([r, g, b, amount]);
};

/** relativeLuminance is WCAG 2.2's, on the sRGB values it names. */
export function relativeLuminance(color: string): number {
  const [r, g, b] = parseColor(color);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** contrastRatio is the standard's (L1 + 0.05) / (L2 + 0.05), lighter first. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return round((light + 0.05) / (dark + 0.05));
}

/**
 * AA is the minimum the acceptance names: body text, large text (which this
 * kit reaches at type.display, 26px), and a border or glyph that carries
 * meaning rather than decoration.
 */
export const AA = { text: 4.5, large: 3, graphic: 3 } as const;
export type AAKind = keyof typeof AA;

export const meetsAA = (ratio: number, kind: AAKind): boolean => ratio >= AA[kind];
