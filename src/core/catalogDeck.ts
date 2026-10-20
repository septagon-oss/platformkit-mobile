import type { Command, Field, HintNotice, HintTone } from "./catalog";
import { drawnIcon } from "./pictures";

export const deckDirections = ["left", "down", "up", "right"] as const;
export type DeckDirection = (typeof deckDirections)[number];
export type DeckChoice =
  | { readonly skip: true }
  | {
      readonly command: string;
      readonly label: string;
      readonly tone: HintTone;
      readonly icon: string;
    };
export interface Deck {
  readonly queue: readonly string[];
  readonly order: string;
  readonly directions: Readonly<Partial<Record<DeckDirection, DeckChoice>>>;
}

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const word = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const scalar = (f: Field) =>
  ["string", "text", "int", "float", "bool", "uuid", "time"].includes(f.type);

/** readDeck keeps a complete, resolvable declaration or reports its first fault and omits it. */
export function readDeck(
  raw: unknown,
  fields: readonly Field[],
  sortable: readonly string[] | undefined,
  commands: readonly Command[],
  tones: readonly string[],
  at: string,
  notice: HintNotice,
): Deck | undefined {
  if (raw === undefined || raw === null) return undefined;
  const refuse = (member: string) => {
    notice(`${at}${member}`, "is not a supported review deck: the ordinary list is used");
    return undefined;
  };
  if (!object(raw)) return refuse("");
  const queue: string[] = [];
  if (raw.queue !== undefined && raw.queue !== null) {
    if (!Array.isArray(raw.queue) || raw.queue.length === 0) return refuse(".queue");
    for (const filter of raw.queue) {
      if (typeof filter !== "string" || !filter.includes(":")) return refuse(".queue");
      const name = filter.slice(0, filter.indexOf(":"));
      if (!fields.some((f) => f.name === name && scalar(f))) return refuse(".queue");
      queue.push(filter);
    }
  }
  if (!word(raw.order)) return refuse(".order");
  const name = raw.order.replace(/^-/, "");
  if (
    name.startsWith("-") ||
    name.startsWith("+") ||
    !sortable?.includes(name) ||
    !fields.some((f) => f.name === name && scalar(f) && f.hints?.visibility !== "hidden")
  )
    return refuse(".order");
  if (!object(raw.directions)) return refuse(".directions");
  if (Object.keys(raw.directions).some((d) => !deckDirections.includes(d as DeckDirection)))
    return refuse(".directions");
  const directions: Partial<Record<DeckDirection, DeckChoice>> = {};
  for (const direction of deckDirections) {
    const value = raw.directions[direction];
    if (value === undefined) continue;
    const path = `.directions.${direction}`;
    if (!object(value)) return refuse(path);
    if (value.skip === true) {
      if (
        direction !== "down" ||
        ["command", "label", "tone", "icon"].some((k) => value[k] !== undefined)
      )
        return refuse(path);
      directions[direction] = { skip: true };
      continue;
    }
    if (value.skip !== undefined && value.skip !== false) return refuse(path);
    const command = commands.find((c) => c.verb === value.command);
    if (
      !word(value.command) ||
      !command ||
      command.collection ||
      command.hints?.system ||
      command.fields.some((f) => typeof f.default !== "string" || f.default === "")
    )
      return refuse(`${path}.command`);
    if (
      !word(value.label) ||
      !tones.includes(String(value.tone)) ||
      !drawnIcon(value.icon as string)
    )
      return refuse(path);
    directions[direction] = {
      command: value.command,
      label: value.label,
      tone: value.tone as HintTone,
      icon: value.icon as string,
    };
  }
  return { queue, order: raw.order, directions };
}
