// choice.ts is the phone's reading of the `resolved` section the server prints on every
// catalogue entry (kit/entity/present/resolved.go). The section is the authoritative answer
// to "what does this field's finite choice draw, and what are its answers": the phone reads
// it and re-derives none of it. A field the section does not name keeps the reading the
// schema alone gives it, which is what every screen did before this section existed.
//
// It is read like `renderer` and `presentation` are read — as `unknown`, decided by hand —
// because it is presentation: a malformed member costs the one answer it names, never the
// entry, and never the app. Each defect names itself once through `HintNotice` and falls
// back to what an absent hint means, which the kernel states as chips
// (kit/entity/README.md, "Choices").
import type { HintNotice } from "./catalog";

/** ChoiceAppearance is the surface a choice is drawn on. The kernel's own four words. */
export type ChoiceAppearance = "tiles" | "chips" | "figure" | "swatch";

export const CHOICE_APPEARANCES: readonly ChoiceAppearance[] = [
  "tiles",
  "chips",
  "figure",
  "swatch",
];

/**
 * ChoicePicture is an answer's own artwork, as far as this build draws it. A colour arrives
 * as the hex the server was told to hold (`kit/entity.ChoicePicture`); a picture or a
 * reference is a record the phone reads through its picture door, which no appearance in
 * this build draws yet, so it is not stored and the answer is drawn with its word alone.
 */
export interface ChoicePicture {
  readonly colour: string;
}

/** ChoiceAnswer is one answer the server offers, in the order it offers it. */
export interface ChoiceAnswer {
  readonly id: string;
  readonly label: string;
  /** group is the key of the block this answer sits in, absent when it sits in none. */
  readonly group?: string;
  readonly picture?: ChoicePicture;
  /**
   * exclusive is the answer that means "no preference": choosing it means the whole question
   * was answered by answering it, so it is never held beside another (`kit/entity` keeps it
   * last for exactly that reason).
   */
  readonly exclusive?: true;
  /** done is the server's own reading of an answer that means finished. */
  readonly done?: true;
}

/**
 * FieldChoice is what this build reads of one field's resolved choice
 * (`kit/entity/present.ResolvedField.choice` plus its `options`, `figure` and `control`).
 * Members stay absent rather than `undefined`, so a field whose choice declares nothing
 * holds the smallest thing a screen can ask about.
 */
export interface FieldChoice {
  readonly appearance: ChoiceAppearance;
  /** many is the declared cardinality: one answer is a word, many are an ordered set. */
  readonly many: boolean;
  readonly answers: readonly ChoiceAnswer[];
  readonly groups?: readonly { readonly key: string; readonly label: string }[];
  /**
   * answerless is the declared empty policy: the question may be left unanswered. Absent
   * means it may not, and `reason` is the sentence that says so.
   */
  readonly answerless?: true;
  /** reason is the sentence the server declares for the answer it refuses. */
  readonly reason?: string;
  readonly maximum?: {
    readonly count: number;
    readonly replacesOldest?: true;
    readonly reason?: string;
  };
  readonly searchable?: true;
  readonly searchAfter?: number;
  /** artwork is the compiled figure, and which answers its marks name. */
  readonly artwork?: { readonly svg: string; readonly answers: readonly string[] };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const word = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

/**
 * readChoice reads one resolved field's choice, or says that this field names none.
 *
 * A field whose `kind` is not a choice names none: the section resolves every field of the
 * entry, and `control` for a text field says `text`, which is no appearance. An unknown
 * appearance word, a broken cardinality, an empty answer list or a figure with no artwork all
 * fall back — to chips, to one answer, to no choice at all — and say so once at the member
 * that is wrong.
 */
export function readChoice(
  v: unknown,
  at: string,
  notice: HintNotice,
): { readonly name: string; readonly choice: FieldChoice } | undefined {
  if (!isRecord(v)) return undefined;
  if (v.kind !== "choice") return undefined;
  const name = word(v.name);
  if (name === undefined) {
    notice(`${at}.name`, "names no field: its choice is not read");
    return undefined;
  }
  const appearance = readAppearance(v.control, `${at}.control`, notice);
  const card = v.cardinality;
  const many = isRecord(v.choice) ? card === "many" : false;
  if (isRecord(v.choice) && card !== "one" && card !== "many")
    notice(`${at}.choice.cardinality`, `is ${JSON.stringify(card)}: one answer is asked for`);
  const answers = readAnswers(v.options, `${at}.options`, notice);
  if (answers.length === 0) {
    notice(
      `${at}.options`,
      "offers no answer that reads: the field keeps the schema's own reading",
    );
    return undefined;
  }
  const choice = v.choice;
  const empty = isRecord(choice) ? readEmpty(choice.empty, `${at}.choice.empty`, notice) : {};
  const maximum = isRecord(choice)
    ? readMaximum(choice.maximum, `${at}.choice.maximum`, notice)
    : {};
  const groups = isRecord(choice) ? readGroups(choice.groups, `${at}.choice.groups`, notice) : {};
  const artwork =
    appearance === "figure" ? readArtwork(v.figure, `${at}.figure`, notice) : undefined;
  const search =
    isRecord(choice) && choice.searchEnabled === true ? { searchable: true as const } : {};
  const threshold = isRecord(choice) ? number(choice.searchThreshold) : undefined;
  return {
    name,
    choice: {
      appearance,
      many,
      answers,
      ...groups,
      ...empty,
      ...maximum,
      ...search,
      ...(threshold === undefined ? {} : { searchAfter: threshold }),
      ...(artwork === undefined ? {} : { artwork }),
    },
  };
}

/**
 * readResolved reads one entry's resolved section and hands back its choices by field name.
 * `names` is the entry's own field list: a choice naming a field the entry does not have is no
 * reading of anything, so it is dropped and says so. An entry with no section (a server too old
 * to print one) answers with nothing and says nothing.
 */
export function readResolved(
  v: unknown,
  at: string,
  names: readonly string[],
  notice: HintNotice,
): Readonly<Record<string, FieldChoice>> {
  if (v === undefined || v === null) return {};
  if (!isRecord(v)) {
    notice(at, "is not an object: every field keeps the reading its schema gives it");
    return {};
  }
  const fields = v.fields;
  if (!Array.isArray(fields)) {
    if (v.fields !== undefined)
      notice(`${at}.fields`, "is not a list: every field keeps the reading its schema gives it");
    return {};
  }
  const read: Record<string, FieldChoice> = {};
  for (const [i, f] of fields.entries()) {
    const one = readChoice(f, `${at}.fields[${i}]`, notice);
    if (one === undefined) continue;
    if (!names.includes(one.name)) {
      notice(`${at}.fields[${i}].name`, "names no field of this entry: its choice is not read");
      continue;
    }
    read[one.name] = one.choice;
  }
  return read;
}

function readAppearance(v: unknown, at: string, notice: HintNotice): ChoiceAppearance {
  if (typeof v === "string" && (CHOICE_APPEARANCES as readonly string[]).includes(v))
    return v as ChoiceAppearance;
  notice(at, `is ${JSON.stringify(v)}: the choice is drawn as chips`);
  return "chips";
}

function readAnswers(v: unknown, at: string, notice: HintNotice): readonly ChoiceAnswer[] {
  if (!Array.isArray(v)) {
    if (v !== undefined) notice(at, "is not a list: no answer is offered");
    return [];
  }
  const answers: ChoiceAnswer[] = [];
  for (const [i, o] of v.entries()) {
    if (!isRecord(o) || typeof o.value !== "string" || o.value === "") {
      notice(`${at}[${i}]`, "names no answer: it is not offered");
      continue;
    }
    if (answers.some((a) => a.id === o.value)) {
      notice(`${at}[${i}].value`, "repeats an answer: the first one is offered");
      continue;
    }
    const label = typeof o.label === "string" ? o.label : o.value;
    if (typeof o.label !== "string") notice(`${at}[${i}].label`, "is not a word: the id is shown");
    const picture = readPicture(o.picture, `${at}[${i}].picture`, notice);
    const group = word(o.group);
    answers.push({
      id: o.value,
      label,
      ...(group === undefined ? {} : { group }),
      ...(picture === undefined ? {} : { picture }),
      ...(o.noPreference === true ? { exclusive: true as const } : {}),
      ...(o.done === true ? { done: true as const } : {}),
    });
  }
  return answers;
}

function readPicture(v: unknown, at: string, notice: HintNotice): ChoicePicture | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isRecord(v)) {
    notice(at, "is not a picture: the answer is drawn with its word alone");
    return undefined;
  }
  if (v.kind === "colour" && typeof v.value === "string" && HEX.test(v.value))
    return { colour: v.value };
  notice(at, `is a ${JSON.stringify(v.kind)}: the answer is drawn with its word alone`);
  return undefined;
}

function readEmpty(
  v: unknown,
  at: string,
  notice: HintNotice,
): { answerless?: true; reason?: string } {
  if (v === undefined || v === null) return {};
  if (!isRecord(v) || (v.mode !== "allow" && v.mode !== "refuse")) {
    notice(at, "says nothing about an empty answer: it is refused");
    return {};
  }
  if (v.mode === "allow") return { answerless: true };
  return typeof v.message === "string" && v.message !== "" ? { reason: v.message } : {};
}

function readMaximum(
  v: unknown,
  at: string,
  notice: HintNotice,
): { maximum?: { count: number; replacesOldest?: true } } {
  if (v === undefined || v === null) return {};
  if (!isRecord(v)) {
    notice(at, "is not a maximum: any number of answers may be held");
    return {};
  }
  const count = number(v.count);
  if (count === undefined || count < 1) {
    notice(at, "names no count: any number of answers may be held");
    return {};
  }
  const declared = typeof v.message === "string" && v.message !== "" ? { reason: v.message } : {};
  if (v.behaviour !== "replace-oldest" && v.behaviour !== "refuse")
    notice(`${at}.behaviour`, `is ${JSON.stringify(v.behaviour)}: a further answer is refused`);
  return {
    maximum: {
      count,
      ...(v.behaviour === "replace-oldest" ? { replacesOldest: true as const } : {}),
      ...declared,
    },
  };
}

function readGroups(
  v: unknown,
  at: string,
  notice: HintNotice,
): { groups?: readonly { key: string; label: string }[] } {
  if (v === undefined || v === null) return {};
  if (!Array.isArray(v)) {
    notice(at, "is not a list: the answers are drawn ungrouped");
    return {};
  }
  const groups: { key: string; label: string }[] = [];
  for (const [i, g] of v.entries()) {
    if (!isRecord(g) || typeof g.key !== "string" || g.key === "") {
      notice(`${at}[${i}]`, "names no block: it is not drawn");
      continue;
    }
    if (groups.some((b) => b.key === g.key)) continue;
    groups.push({ key: g.key, label: typeof g.label === "string" ? g.label : g.key });
  }
  return groups.length === 0 ? {} : { groups };
}

function readArtwork(
  v: unknown,
  at: string,
  notice: HintNotice,
): { svg: string; answers: readonly string[] } | undefined {
  if (!isRecord(v) || typeof v.svg !== "string" || v.svg === "") {
    notice(at, "names no compiled artwork: the choice is drawn as chips");
    return undefined;
  }
  const answers = Array.isArray(v.choiceIDs)
    ? v.choiceIDs.filter((id): id is string => typeof id === "string" && id !== "")
    : [];
  if (answers.length === 0) notice(`${at}.choiceIDs`, "names no answer: its marks say nothing");
  return { svg: v.svg, answers };
}

function number(v: unknown): number | undefined {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
