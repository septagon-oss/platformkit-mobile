// What a formatting control does to a draft, and nothing else. A keyboard toolbar is a
// text editor's own instrument: it takes the body as stored, the caret the box last
// reported, and the marks one control carries, and answers a body and a caret. It holds no
// state, no Markdown parser and no notion of which record it is writing — the person is
// still the author of every character, and the marks are the ones `src/core/prose.ts`
// reads back. A body the reader refuses is the form's to say so about, not this file's to
// repair.
/** Caret is the selection a box reports: where it starts and where it ends. */
export interface Caret {
  readonly start: number;
  readonly end: number;
}

/** Draft is what an editing control holds: the body, and the caret inside it. */
export interface Draft {
  readonly text: string;
  readonly caret: Caret;
}

/** NO_CARET is a box that never reported one: the end of the body, where typing goes. */
export const NO_CARET: Caret = { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };

/** chosen is where the person's words are: the selection, or the one word at a bare caret. */
function chosen(text: string, caret: Caret): Caret {
  const at = Math.max(0, Math.min(caret.start, caret.end, text.length));
  const through = Math.max(at, Math.min(Math.max(caret.start, caret.end), text.length));
  if (through !== at) return { start: at, end: through };
  // A bare caret marks what it sits in, so "Bold" over a word is the word, not a pair of
  // markers with nothing between them.
  const word = /[A-Za-z0-9\u00C0-\u024F_]/;
  let from = at,
    to = at;
  while (from > 0 && word.test(text[from - 1]!)) from -= 1;
  while (to < text.length && word.test(text[to]!)) to += 1;
  return to > from ? { start: from, end: to } : { start: at, end: at };
}

/**
 * marked puts a pair of inline marks around the chosen words: `**` around a phrase, `_`
 * around another. Pressing it again where the marks already stand takes them off, so one
 * control is a toggle and not a way to pile syntax on syntax. Nothing between the marks is
 * looked at: what the person wrote is what the body keeps.
 */
export function marked(draft: Draft, open: string, close: string): Draft {
  const at = chosen(draft.text, draft.caret);
  const inside = draft.text.slice(at.start, at.end);
  const wears = (source: string) =>
    source.startsWith(open) &&
    source.endsWith(close) &&
    source.length >= open.length + close.length;
  if (wears(inside)) {
    const words = inside.slice(open.length, inside.length - close.length);
    return {
      text: draft.text.slice(0, at.start) + words + draft.text.slice(at.end),
      caret: { start: at.start, end: at.start + words.length },
    };
  }
  const before = draft.text.slice(0, at.start),
    after = draft.text.slice(at.end);
  if (before.endsWith(open) && after.startsWith(close)) {
    const rest = { start: before.length - open.length, end: after.length - close.length };
    return {
      text: before.slice(0, before.length - open.length) + inside + after.slice(close.length),
      caret:
        at.start === at.end
          ? { start: rest.start, end: rest.start + inside.length }
          : { start: rest.start, end: rest.end },
    };
  }
  return {
    text: before + open + inside + close + after,
    // The caret lands on the marked words, so the next press is about the same words.
    caret: { start: before.length + open.length, end: before.length + open.length + inside.length },
  };
}

/**
 * lined puts a line mark (`## `, `- `) at the start of every chosen line, or takes it off
 * where every one of them already wears it. A mark is a line's, so a selection is rounded
 * to the lines it touches. The body is the person's: a line that already carries another
 * mark is left as it was written.
 */
export function lined(draft: Draft, mark: string): Draft {
  const lines = draft.text.split("\n");
  const spans: Caret[] = [];
  for (let at = 0, index = 0; index < lines.length; index += 1) {
    const width = lines[index]!.length + 1;
    spans.push({ start: at, end: at + lines[index]!.length });
    at += width;
  }
  const touched = spans.filter(
    (line) => line.end >= draft.caret.start && line.start <= draft.caret.end,
  );
  const from = touched.length === 0 ? 0 : spans.indexOf(touched[0]!);
  const count = touched.length === 0 ? lines.length : touched.length;
  const picked = lines.slice(from, from + count);
  const worn = picked.every((line) => line.startsWith(mark));
  const next = picked.map((line) => (worn ? line.slice(mark.length) : mark + line));
  const shift = (worn ? -mark.length : mark.length) * count;
  return {
    text: [...lines.slice(0, from), ...next, ...lines.slice(from + count)].join("\n"),
    caret: { start: draft.caret.start + shift, end: draft.caret.end + shift },
  };
}

/**
 * figureLine is the one body member a picture is: an image, its own words as its alt, and
 * the file it points at. The address is the file module's own uuid — nothing else is a
 * file address (`src/core/prose.ts`) — so a figure is inserted for a file this server
 * holds rather than typed from memory. The words keep every character the person wrote:
 * the two the format would otherwise read as syntax are escaped.
 */
export function figureLine(name: string, file: string): string {
  const words = name.replace(/[[\]]/g, (mark) => `\\${mark}`);
  return `![${words}](pk-file:${file})`;
}

/** insertLine puts a block of its own where the caret is, on lines of its own either side. */
export function insertLine(draft: Draft, line: string): Draft {
  const at = Math.max(0, Math.min(draft.caret.start, draft.caret.end, draft.text.length));
  const before = draft.text.slice(0, at),
    after = draft.text.slice(at);
  const head =
    before === "" || before.endsWith("\n\n")
      ? before
      : before.endsWith("\n")
        ? `${before}\n`
        : `${before}\n\n`;
  const tail =
    after === ""
      ? "\n"
      : after.startsWith("\n\n")
        ? after
        : after.startsWith("\n")
          ? `\n${after}`
          : `\n\n${after}`;
  return {
    text: head + line + tail,
    caret: { start: head.length + line.length, end: head.length + line.length },
  };
}
