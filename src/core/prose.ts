// A rich text body arrives as the Markdown the server stored: the canonical
// serialisation of an AST it validated against 0069 §1, so the shape on the wire is
// what normalisation guarantees — blocks separated by a blank line, a figure a
// paragraph holding one image and nothing else, a fence carrying its own blank lines.
// Reading that shape needs a reader, not a parser: this file cuts a body into text
// runs and figures, plans which width of a file fits the slot it will draw in, and
// refuses a body whose shape says the server never stored it. It never repairs,
// rewrites or invents a construct: what it cannot place it names, and the caller
// draws the body as prose instead of drawing less of it.
//
// The width plan is here too rather than beside an image loader, because it is the
// catalogue's declared widths read from the outside. One rule, one owner, and
// the loader stays a loader.
import type { ImageSlotProps, MediaItem } from "./media";
import { build, type Validation } from "./shared";

/**
 * variantWidth chooses the smallest declared width covering a slot, or the widest declared width.
 * A known frame bounds that choice; zero requests the original when the slot or variant exceeds it.
 * Invalid slots and absent widths also request the original; an unknown frame leaves widths unbounded.
 */
export function variantWidth(
  slotPx: number,
  frameWidth: number,
  widths: readonly number[] = [],
): number {
  if (!Number.isFinite(slotPx) || slotPx <= 0 || widths.length === 0) return 0;
  const measured = Number.isSafeInteger(frameWidth) && frameWidth > 0;
  if (measured && frameWidth <= slotPx) return 0;
  const width = widths.find((width) => width >= slotPx) ?? widths[widths.length - 1]!;
  return measured && width > frameWidth ? 0 : width;
}

/** A figure is 0069 §1's block image: one image, its own paragraph, its title as the caption. */
export interface ProseFigure {
  readonly kind: "figure";
  /** file is the `pk-file:` reference whole — a uuid, and nothing else is a file address. */
  readonly file: string;
  /** alt is the image's own words; "" is 0069 §3's decorative image, not a missing label. */
  readonly alt: string;
  /** caption is the image title, "" when the author wrote none. */
  readonly caption: string;
  /** id is stable within one body: "fig-" and the figure's position in it. */
  readonly id: string;
}

/** A text run is the Markdown of one or more blocks drawn as prose. */
export interface ProseText {
  readonly kind: "markdown";
  readonly source: string;
  readonly id: string;
}

export type ProseBlock = ProseFigure | ProseText;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The canonical figure line as normalisation writes it: the alt, the file, and an
// optional quoted title whose escaped quotes belong to the caption, not the syntax.
const FIGURE = /^!\[([^\]]*)\]\(\s*pk-file:([^\s)"]+)(?:\s+"((?:[^"\\]|\\.)*)"\s*)?\)\s*$/,
  FENCE = /^\s{0,3}(`{3,}|~{3,})/,
  HEADING = /^(#{1,6})\s/,
  IMAGE_SYNTAX = /!\[[^\]]*\]\([^)]*\)/,
  FILE_REFERENCE = /pk-file:/,
  QUOTE = /^\s*(?:>[\s]*)+/;

/** titleText unquotes a caption the way the format quoted it. */
function titleText(title: string | undefined): string {
  return title === undefined ? "" : title.replace(/\\(["\\])/g, "$1").trim();
}

/**
 * Group is one block of the body: its lines as the server stored them, and which of
 * them the format reads as code — a fenced block's delimiters and everything between
 * them. The second half is what the shape checks below read, because a line of code
 * says nothing about the shapes a body is allowed to hold: 0069 §1 stores a fenced
 * block and a code span verbatim, so a `# comment`, a quoted `![alt](url)` or the
 * scheme `pk-file:` inside code is code, not a heading, an image or a file reference.
 */
interface Group {
  readonly lines: readonly string[];
  readonly code: readonly boolean[];
}

/**
 * cut divides a body at its blank lines into blocks.
 *
 * A blank line inside a fence belongs to the fence, which may hold as many as it
 * likes; an unterminated fence answers null, because a body whose fence never closed
 * has no block boundaries left to trust.
 *
 * A fence ends on a marker of its own character at least as wide as the one that opened
 * it, which is what lets a body quote Markdown: a body that describes a fenced block
 * opens with four backticks, and the three inside it are literal code, not an ending.
 *
 * The marker says nothing else: a line of the same characters with words after it is
 * the code the author meant to keep, because the format gives a closing marker no
 * information to carry. A line that opens a fence may carry the language after it.
 */
function cut(source: string): readonly Group[] | null {
  const groups: Group[] = [];
  let lines: string[] = [],
    code: boolean[] = [],
    fence: string | undefined;
  const flush = () => {
    // A run of blank lines is a separator, never an empty paragraph of its own — a
    // body's trailing newline is not a block.
    if (lines.some((line) => line.trim() !== "")) groups.push({ lines, code });
    lines = [];
    code = [];
  };
  for (const line of source.split("\n")) {
    const marker = FENCE.exec(line);
    const opens = fence === undefined && marker !== null;
    // The whole run the author typed is the marker, not its first three characters: a
    // line of the same character shorter than the opening one is content, not an ending.
    const closes =
      fence !== undefined &&
      marker !== null &&
      marker[1]![0] === fence[0] &&
      marker[1]!.length >= fence.length &&
      line.slice(marker[0]!.length).trim() === "";
    if (opens) fence = marker![1]!;
    else if (closes) fence = undefined;
    else if (fence === undefined && line.trim() === "") {
      flush();
      continue;
    }
    lines.push(line);
    code.push(opens || closes || fence !== undefined);
  }
  flush();
  return fence === undefined ? groups : null;
}

/**
 * proseOnly is a block with its code left out: every fenced line, and every inline code
 * span. A span opens on a run of backticks and closes on the next run of the same width,
 * which may sit on a line below; a run that never closes is a literal backtick, which the
 * format draws and this reader still asks about. Newlines survive either way, so a shape
 * is still found on the line it was written on.
 */
function proseOnly(block: Group): readonly string[] {
  const spoken = block.lines.filter((_, index) => !block.code[index]).join("\n");
  let out = "",
    at = 0;
  for (;;) {
    const open = runAt(spoken, at);
    if (open === null) {
      out += spoken.slice(at);
      break;
    }
    const close = runOfWidth(spoken, open.width, open.end);
    if (close === null) {
      out += spoken.slice(at, open.end); // one lonely run is a backtick, not a span
      at = open.end;
      continue;
    }
    out += spoken.slice(at, open.at);
    out += spoken.slice(open.end, close).replace(/[^\n]/g, ""); // the code, minus its words
    at = close + open.width;
  }
  return out.split("\n");
}

/** runAt is the next run of backticks at or after `from`: where it starts, how wide it is, where it ends. */
function runAt(text: string, from: number): { at: number; width: number; end: number } | null {
  const at = text.indexOf("`", from);
  if (at < 0) return null;
  let width = 1;
  while (text[at + width] === "`") width += 1;
  return { at, width, end: at + width };
}

/** runOfWidth is where the next run of exactly that many backticks begins; a longer run does not close a span. */
function runOfWidth(text: string, width: number, from: number): number | null {
  for (let found = runAt(text, from); found !== null; found = runAt(text, found.end))
    if (found.width === width) return found.at;
  return null;
}

/** figureBlock is the one paragraph §1's image rule allows: a single image line, its file a uuid. */
function figureBlock(block: Group): Omit<ProseFigure, "id"> | undefined {
  if (block.lines.length !== 1 || block.code[0]) return undefined;
  const match = FIGURE.exec(block.lines[0]!);
  if (!match || !UUID.test(match[2]!)) return undefined;
  return { kind: "figure", file: match[2]!, alt: match[1] ?? "", caption: titleText(match[3]) };
}

/**
 * proseBlocks cuts a normalised body into text runs and figures.
 *
 * Blank lines separate blocks except inside a fenced code block, which may hold as
 * many as it likes. A block that is one image line is a figure; every other block is
 * handed on untouched. It refuses (`ok: false`, naming the constructs) a body the
 * server could not have stored under 0069 §1 — an image reference that is not a
 * figure of its own, a `pk-file:` that is not a uuid, a heading outside `##`–`####` —
 * because drawing what the server refuses to store would be this phone inventing a
 * format. Only the prose of a block is asked those questions: code is stored verbatim
 * and may look like any construct without being one. A body of plain text is no
 * refusal: plain text is paragraphs.
 */
export function proseBlocks(
  source: string,
):
  | { readonly ok: true; readonly blocks: readonly ProseBlock[] }
  | { readonly ok: false; readonly constructs: readonly string[] } {
  const groups = cut(source);
  if (groups === null) return { ok: false, constructs: ["code fence"] };

  const blocks: ProseBlock[] = [],
    constructs = new Set<string>();
  let figures = 0,
    runs = 0;
  for (const group of groups) {
    const figure = figureBlock(group);
    if (figure) {
      blocks.push({ ...figure, id: `fig-${figures++}` });
      continue;
    }
    const spoken = proseOnly(group);
    const words = spoken.join("\n");
    if (IMAGE_SYNTAX.test(words)) constructs.add("image");
    if (FILE_REFERENCE.test(words)) constructs.add("pk-file");
    for (const line of spoken) {
      const heading = HEADING.exec(line);
      if (heading && (heading[1]!.length < 2 || heading[1]!.length > 4)) constructs.add("heading");
    }
    blocks.push({
      kind: "markdown",
      source: group.lines.join("\n"),
      id: `run-${runs++}`,
    });
  }
  if (constructs.size > 0) return { ok: false, constructs: [...constructs] };
  return { ok: true, blocks };
}

/**
 * phoneEditorHolds names the constructs in a body this phone's rich editor cannot
 * hold — today "table", for which the editor's bridge set has no node. It reads the
 * same segmentation the reader uses, so a body the reader draws whole is offered as
 * rich text and a body the reader refuses is never called editable: the plain
 * Markdown box holds it instead, with a sentence naming what the phone cannot hold.
 * Empty means the rich editor is safe for this body.
 */
export function phoneEditorHolds(source: string): readonly string[] {
  const split = proseBlocks(source);
  if (!split.ok) return split.constructs;
  const held = new Set<string>();
  for (const group of cut(source) ?? []) if (tableRows(group)) held.add("table");
  return [...held];
}

/**
 * MARKED is the paired inline markup a normalised body can wear, in the order it is
 * removed: a picture's own name is read before a link, because a picture is what a link
 * would otherwise match. Each pair is removed only when it closes — `snake_case`, `2 * 3`
 * and a lone backtick keep their characters, because nothing marked them.
 */
const MARKED: readonly [RegExp, string][] = [
  [/!\[([^\]]*)\]\([^)]*\)/g, "$1"],
  [/\[([^\]]*)\]\([^)]*\)/g, "$1"],
  [/\*\*([^*]+)\*\*/g, "$1"],
  [/__([^_]+)__/g, "$1"],
  [/\*([^*]+)\*/g, "$1"],
  [/~~([^~]+)~~/g, "$1"],
  [/`([^`]+)`/g, "$1"],
];

/** LIST, TASK and TABLE_ROW are a block's own marks: where a line stops being a sentence. */
const LIST = /^(\s*)(?:[-*+]|\d+[.)])\s+/,
  TASK = /^(\s*)\[[ xX]\]\s+/,
  SEPARATOR = /^\s*\|?[\s:|-]*\|[\s:|-]*\|?\s*$/;

/**
 * proseSpoken is a body said aloud: every word its author wrote, and none of the
 * characters whose only job is to tell a screen how to draw them.
 *
 * It is the one place a body becomes speech — the drawn form belongs to `Prose` and the
 * face a screen supplies — so a person hearing a record is told its sentences rather than
 * the syntax that made them, and a row that shows native type never announces `##`. A
 * heading's words, a list item's words, a quote's words and a table's cells in row order
 * are kept; a fenced block is read exactly as written, because code is read as written;
 * a figure is named by its alt and its caption, and a decorative picture says nothing.
 * A body the segmentation refused comes back as it was stored, because that is the shape
 * on the screen and what a person hears should be what is drawn.
 *
 * The marks the eye uses for order and for a task checked off are dropped: they are how
 * the block looks, not what it says. Nothing here repairs or reorders a body.
 */
export function proseSpoken(source: string): string {
  const split = proseBlocks(source);
  if (!split.ok) return source;
  const groups = cut(source) ?? [];
  const said: string[] = [];
  split.blocks.forEach((block, at) => {
    if (block.kind === "figure") {
      const named = [block.alt, block.caption].filter((word) => word !== "").join(", ");
      if (named !== "") said.push(named);
      return;
    }
    const group = groups[at];
    if (group === undefined) return;
    group.lines.forEach((line, index) => {
      const spoken = speakLine(line, group.code[index] === true);
      if (spoken !== "") said.push(spoken);
    });
  });
  return said.join("\n").trim();
}

/**
 * speakLine is one line said. A fence marker line says nothing and its code is kept whole;
 * a prose line loses its block marks, then its paired inline markup, and a table row is
 * read cell by cell because "vertical bar" is not a word of the sentence.
 */
function speakLine(line: string, code: boolean): string {
  if (FENCE.test(line)) return "";
  if (code) return line;
  const bare = line.replace(QUOTE, "").replace(HEADING, "").replace(LIST, "$1").replace(TASK, "");
  const row = bare.trim();
  if (row.includes("-") && SEPARATOR.test(row)) return "";
  const cells =
    row.startsWith("|") || row.endsWith("|")
      ? row
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell !== "")
          .join(", ")
      : bare;
  return MARKED.reduce((text, [mark, words]) => text.replace(mark, words), cells).trim();
}

/**
 * tableRows says whether a block holds a GFM table: a delimiter row under a header
 * row. It reads the block's prose, so a fence that quotes a table is not one, and
 * reads past a blockquote marker, so a table quoted into a blockquote still is one —
 * the editor loses a table in either case only if it holds one.
 */
function tableRows(block: Group): boolean {
  const rows = proseOnly(block).map((line) => line.replace(QUOTE, "").trim());
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (row.includes("-") && /^\|?[\s:-]*\|[\s:|-]*\|?$/.test(row) && rows[i - 1]!.includes("|"))
      return true;
  }
  return false;
}

export interface ProseInput {
  /** source is the body exactly as the server stored it. */
  readonly source: string;
  /**
   * figures holds what this screen knows of each figure, keyed by the figure's own id.
   * Absent means the file's own row has not been read yet: a figure still arriving,
   * with no frame to reserve its box against — never a broken one.
   */
  readonly figures: Readonly<Record<string, MediaItem>>;
  /** openId is the figure whose full-screen viewer is open. */
  readonly openId?: string;
}

/**
 * deriveProse is a rich text body as this kit draws it: the segmentation, every figure
 * carrying the image slot a screen's renderer is handed, and the viewer question
 * answered. An empty body is an empty model. A body the segmentation refuses is the
 * `unsupported-format` issue the caller falls back on, so a screen draws the whole
 * body as prose rather than drawing less of it.
 */
export function deriveProse(input: ProseInput, p: Parameters<typeof build>[0]) {
  return build(p, (v: Validation) => {
    const blocks = accepted(v, proseBlocks(input.source)).map((block) =>
      block.kind === "figure"
        ? { ...block, ...figureView(input.figures[block.id], block, v) }
        : block,
    );
    const figures = blocks.filter((block) => block.kind === "figure");
    const open = figures.find((figure) => figure.id === input.openId);
    v.need(open === undefined || open.canOpen, "openId");
    return {
      blocks,
      figures,
      ...(input.openId === undefined ? {} : { openId: input.openId }),
      ...(open === undefined ? {} : { open }),
      labels: { open: p.copy.kit.open, retry: p.copy.kit.retryImage },
      motion: p.motion,
    };
  });
}

/**
 * accepted is the segmentation's blocks, or the refusal the caller reads as a body in
 * a shape this phone does not draw — the `unsupported-format` issue says which.
 */
function accepted(v: Validation, split: ReturnType<typeof proseBlocks>): readonly ProseBlock[] {
  if (!split.ok) v.need(false, "source", "unsupported-format");
  return (split as { readonly blocks: readonly ProseBlock[] }).blocks;
}

/**
 * figureView is one figure as the reader draws it: the slot a loader fills, sized by
 * the frame the server measured so the box is reserved before a byte arrives, and the
 * words that say what it is. The caption is drawn as the figure's own line, so the
 * slot is told not to repeat it. A figure with no row read yet reserves nothing and
 * says it is loading. A figure that can no longer be painted — the file's row was
 * refused, or this server names no file module at all — has no frame to reserve and gets
 * no slot: it says what it is, keeps its caption, and the rest of the body keeps reading.
 */
function figureView(item: MediaItem | undefined, figure: ProseFigure, v: Validation) {
  if (item === undefined)
    return {
      state: "loading" as const,
      slot: undefined,
      caption: figure.caption,
      canOpen: false,
      canRetry: false,
      openLabel: v.p.copy.kit.open,
      loadingLabel: v.p.copy.state.loading,
      retryLabel: v.p.copy.kit.retryImage,
      motion: v.p.motion,
    };
  v.text(item.id, "figure.file");
  v.need(["loading", "ready", "error", "unavailable"].includes(item.state), "figure.state");
  const decorative = item.decorative || figure.alt === "";
  const failed = item.state === "error" || item.state === "unavailable";
  // Only a figure that can still be painted needs a frame: measurements are what a box is
  // reserved against, and a file nobody read has none. Asking for them anyway would refuse
  // the whole body, which is the phone destroying a person's prose because one picture
  // went away.
  const measured =
    Number.isSafeInteger(item.width) &&
    item.width > 0 &&
    Number.isSafeInteger(item.height) &&
    item.height > 0;
  v.need(measured || failed, "figure.dimensions");
  // The box a loader fills, or nothing where no frame was ever measured to reserve one.
  const slot: ImageSlotProps | undefined = measured
    ? {
        id: item.id,
        description: item.description,
        decorative,
        fit: "contain",
        // Aspect ratio is variant-invariant, so the frame the server measured is what
        // the box reserves at every width: choosing 960 or 1440 never moves a line.
        aspectRatio: item.width / item.height,
        // The figure writes its own caption line, so the slot does not repeat it.
        caption: false,
        ...(item.scene === undefined ? {} : { scene: item.scene }),
      }
    : undefined;
  return {
    state: item.state,
    slot,
    caption: figure.caption || (item.caption ?? ""),
    canOpen: !decorative && item.state === "ready",
    canRetry: failed,
    openLabel: v.p.copy.kit.open,
    reason: failed ? (item.reason ?? v.p.copy.kit.imageUnavailable) : undefined,
    loadingLabel: v.p.copy.state.loading,
    retryLabel: v.p.copy.kit.retryImage,
    motion: v.p.motion,
  };
}

export type ProseModel = Extract<ReturnType<typeof deriveProse>, { ok: true }>["value"];
export type ProseBlockModel = ProseModel["blocks"][number];
