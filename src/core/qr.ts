// qr.ts encodes one short text as a QR matrix, so a screen can show a link a phone can point a
// camera at: byte mode, error-correction level M, and the versions a link fits at that level —
// 1 to 4, which carry at most 62 bytes.
//
// The two decisions in this file are both refusals, and both are deliberate.
//
// A text longer than the version 4-M capacity is refused rather than encoded in a higher version.
// The sheet that draws the matrix sized its frame for what it holds, and a matrix with more
// modules than the frame can show is either clipped or shrunk below what a camera resolves —
// either way, an invite that scans as nothing. The link stays readable as text, which is what a
// person can do with it, and the screen says why no picture of it appeared.
//
// The mask is chosen by the standard penalty rule rather than fixed at zero, because the rule is
// what keeps a printed matrix scannable when its data happens to repeat. The matrices this
// encoder makes are compared against the ones `qrencode` makes for the same bytes (testdata/
// qr.json), which is the only way to prove both halves — the encoder and the mask choice — at
// once without a camera.
//
// ISO/IEC 18004 is the source of every number here: the codeword split of each version, the
// generator polynomial over GF(256) with the 0x11D primitive polynomial, the finder, separator,
// timing, alignment and format layouts, and the four penalty rules.

/** QrMatrix is one QR symbol: `size` modules a side, row-major, dark marked, with no quiet zone. */
export interface QrMatrix {
  readonly size: number;
  readonly modules: readonly boolean[];
}

/** qrByteLimit is the longest text this encoder carries, which is version 4's level-M byte capacity. */
export const qrByteLimit = 62;

/** LAYOUTS is one row per version this encoder reaches: data and error-correction codewords at level M. */
const LAYOUTS = [
  { data: 16, ec: 10 },
  { data: 28, ec: 16 },
  { data: 44, ec: 26 },
  { data: 64, ec: 36 },
] as const;

const MODE_BYTE = 0b0100;
const PAD_FIRST = 0xec;
const PAD_SECOND = 0x11;
/** QUIET_ZONE is the light border a reader needs around the symbol; the molecule draws it, the matrix does not hold it. */
export const QR_QUIET_ZONE = 4;

/**
 * encodeQr lays a text out as a QR symbol, or refuses: an empty text and a text longer than
 * `qrByteLimit` both answer nothing, because a QR of nothing and a QR too dense to scan are the
 * same lie about a link.
 */
export function encodeQr(text: string): QrMatrix | undefined {
  const bytes = utf8(text);
  if (bytes.length === 0 || bytes.length > qrByteLimit) return undefined;
  const version = LAYOUTS.findIndex((layout) => layout.data - 2 >= bytes.length) + 1;
  const layout = LAYOUTS[version - 1]!;
  const data = codify(bytes, layout.data);
  const codewords = [...data, ...remainder(data, divisor(layout.ec))];
  let best: { readonly score: number; readonly mask: number } | undefined;
  for (let mask = 0; mask < 8; mask++) {
    const grid = place(version, codewords, mask);
    const score = penalty(grid, version * 4 + 17);
    if (best === undefined || score < best.score) best = { score, mask };
  }
  const grid = place(version, codewords, best!.mask);
  const size = version * 4 + 17;
  return { size, modules: Array.from(grid, (cell) => cell === 1) };
}

/** utf8 is the byte mode's own encoding: a text is carried as the bytes a reader will receive. */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const character of text) {
    const point = character.codePointAt(0)!;
    if (point < 0x80) bytes.push(point);
    else if (point < 0x800) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    else if (point < 0x10000)
      bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    else
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
  }
  return bytes;
}

/** codify is the data bit stream: mode, length, payload, terminator, then the alternating pad bytes. */
function codify(bytes: readonly number[], dataCodewords: number): number[] {
  const bits: number[] = [];
  const emit = (count: number, value: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  emit(4, MODE_BYTE);
  emit(8, bytes.length);
  for (const byte of bytes) emit(8, byte);
  const capacity = dataCodewords * 8;
  emit(Math.min(4, capacity - bits.length), 0);
  while (bits.length % 8 !== 0) emit(1, 0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8)
    data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  for (let pad = 0; data.length < dataCodewords; pad++)
    data.push(pad % 2 === 0 ? PAD_FIRST : PAD_SECOND);
  return data;
}

// The two tables of GF(256) under the 0x11D primitive polynomial: every power of 2, and which
// power each non-zero byte is. They are built once, when this module is first read.
const EXPONENT = new Uint8Array(512);
const LOGARITHM = new Uint8Array(256);
{
  let value = 1;
  for (let power = 0; power < 255; power++) {
    EXPONENT[power] = value;
    LOGARITHM[value] = power;
    value <<= 1;
    if ((value & 0x100) !== 0) value ^= 0x11d;
  }
  for (let power = 255; power < 512; power++) EXPONENT[power] = EXPONENT[power - 255]!;
}

const times = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXPONENT[(LOGARITHM[a]! + LOGARITHM[b]!) % 255]!;

/** divisor is the monic Reed–Solomon generator of `degree`, without its leading coefficient. */
function divisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let power = 0; power < degree; power++) {
    for (let i = 0; i < degree; i++) {
      result[i] = times(result[i]!, root) ^ (i + 1 < degree ? result[i + 1]! : 0);
    }
    // Each factor of the generator is one more power of α, taken in the field rather than as a
    // left shift, which walks out of it at the ninth.
    root = ((root << 1) ^ ((root & 0x80) !== 0 ? 0x11d : 0)) & 0xff;
  }
  return result;
}

/** remainder is what one pass of long division leaves: the error-correction codewords. */
function remainder(data: readonly number[], generator: readonly number[]): number[] {
  const result = new Array<number>(generator.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0]!;
    result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] = result[i]! ^ times(generator[i]!, factor);
  }
  return result;
}

/** formatBits is the 15-bit format information: level M is 0b00, then the mask, then its BCH remainder. */
function formatBits(mask: number): number {
  const data = mask;
  let value = data << 10;
  for (let i = 4; i >= 0; i--) if ((value & (1 << (i + 10))) !== 0) value ^= 0b10100110111 << i;
  return (((data << 10) | value) ^ 0b101010000010010) & 0x7fff;
}

/**
 * place lays one symbol out: the function patterns first, then the format information over the
 * strip reserved beside them, then the codewords in the two-module zigzag the standard spells,
 * each data module flipped by the chosen mask. A module the layout already decided is never
 * written twice, which is what the `fixed` marks are for.
 */
function place(version: number, codewords: readonly number[], mask: number): Uint8Array {
  const size = version * 4 + 17;
  const dark = new Uint8Array(size * size);
  const fixed = new Uint8Array(size * size);
  const set = (row: number, column: number, on: boolean) => {
    if (row < 0 || column < 0 || row >= size || column >= size) return;
    dark[row * size + column] = on ? 1 : 0;
    fixed[row * size + column] = 1;
  };
  const corners: readonly (readonly [number, number])[] = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  for (const [row, column] of corners)
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = inFinder && (r === 0 || r === 6 || c === 0 || c === 6);
        const core = inFinder && r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(row + r, column + c, ring || core);
      }
  for (let i = 8; i <= size - 9; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  if (version >= 2)
    for (let r = -2; r <= 2; r++)
      for (let c = -2; c <= 2; c++)
        set(size - 7 + r, size - 7 + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  const info = formatBits(mask);
  for (let bit = 0; bit < 15; bit++) {
    const on = ((info >> bit) & 1) === 1;
    if (bit < 6) set(bit, 8, on);
    else if (bit < 8) set(bit + 1, 8, on);
    else set(size - 15 + bit, 8, on);
    if (bit < 8) set(8, size - bit - 1, on);
    else if (bit === 8) set(8, 7, on);
    else set(8, 14 - bit, on);
  }
  set(size - 8, 8, true);

  // The codewords run up and down two-module columns from the lower right. The vertical timing
  // pattern sits in one of those columns, so that column carries codewords on one side only and
  // the pair is stepped over rather than narrowed: narrowing it would put the same module in the
  // stream twice and leave the leftmost column out of it.
  const pairs: [number, number][] = [];
  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) column -= 1;
    pairs.push([column, column - 1]);
  }
  const bits = codewords.length * 8;
  let index = 0;
  let upward = true;
  for (const [right, left] of pairs) {
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const column of [right, left]) {
        if (fixed[row * size + column] === 1) continue;
        const value =
          index < bits ? ((codewords[index >> 3]! >> (7 - (index & 7))) & 1) === 1 : false;
        index++;
        dark[row * size + column] = value !== masked(mask, row, column) ? 1 : 0;
      }
    }
    upward = !upward;
  }
  return dark;
}

/** masked is one of the eight standard mask patterns. */
function masked(mask: number, row: number, column: number): boolean {
  switch (mask) {
    case 0:
      return (row + column) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return column % 3 === 0;
    case 3:
      return (row + column) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5:
      return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6:
      return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    default:
      return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0;
  }
}

/**
 * penalty is the standard's own measure of how hard a symbol is to read: long runs of one colour,
 * blocks of four, a finder's own shape reproduced inside the data, and how far the symbol strays
 * from half dark. The lowest-scoring mask is the one `encodeQr` prints.
 */
function penalty(grid: Uint8Array, size: number): number {
  const line = (index: (at: number) => number): string =>
    Array.from({ length: size }, (_, i) => (grid[index(i)] === 1 ? "1" : "0")).join("");
  let score = 0;
  for (let k = 0; k < size; k++) {
    for (const words of [line((i) => k * size + i), line((i) => i * size + k)])
      score += runPenalty(words) + shapePenalty(words);
  }
  for (let row = 0; row + 1 < size; row++)
    for (let column = 0; column + 1 < size; column++) {
      const cell = grid[row * size + column]!;
      if (
        grid[row * size + column + 1] === cell &&
        grid[(row + 1) * size + column] === cell &&
        grid[(row + 1) * size + column + 1] === cell
      )
        score += 3;
    }
  const dark = grid.reduce((total, cell) => total + cell, 0);
  const percent = (dark * 100) / (size * size);
  return score + 10 * Math.floor(Math.abs(percent - 50) / 5);
}

/** runPenalty counts each run of five or more modules of one colour in one line. */
function runPenalty(words: string): number {
  let score = 0;
  let run = 1;
  for (let i = 1; i <= words.length; i++) {
    if (i < words.length && words[i] === words[i - 1]) run++;
    else {
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
  }
  return score;
}

/** shapePenalty counts a finder's own 1:1:3:1:1 outline, with four light modules beside it, anywhere in a line. */
function shapePenalty(words: string): number {
  const shapes = ["10111010000", "00001011101"];
  let score = 0;
  for (const shape of shapes) {
    for (let i = words.indexOf(shape); i >= 0; i = words.indexOf(shape, i + 1)) score += 40;
  }
  return score;
}
