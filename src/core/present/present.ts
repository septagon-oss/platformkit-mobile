/** present: one entry's fields read as that entry's resolved policy says they read. */
import type { Entry, Field } from "../catalog";
import type { Formatting } from "../presentation";
import { badgeTone, enumTone } from "./tones";
import { fieldLabel, humanize, saidValue, text } from "./words";

/** Presented is one field read for a person: its word, its value, and the shade it carries. */
export interface Presented {
  readonly label: string;
  readonly value: string;
  /** spoken is what a reader says aloud when the cell shows less: an instant's whole date-time. */
  readonly spoken?: string;
  readonly tone: "ok" | "warning" | "danger" | "info" | "neutral";
}

/** Present reads one field of the entry it is bound to — by name or by the Field itself. */
export type Present = (field: Field | string, value: unknown) => Presented;

/**
 * presentFor binds those readings to one entry and one formatting, so a screen asks
 * `present("status", row.status)` and gets the server's own word for the value, the
 * value as the eye reads it and the tone the policy gave it. A name the entry carries
 * no field for reads as the name's own words beside the plain value in no shade — the
 * same way a policy column naming no field is dropped rather than guessed at — and a
 * field that points at another record reads as the pointer word, because resolving the
 * other record's name costs a read that is the screen's to ask, not this one's.
 */
export const presentFor =
  (entry: Entry, format: Formatting): Present =>
  (field, value) => {
    const named = typeof field === "string" ? entry.fields.find((f) => f.name === field) : field;
    if (!named)
      return {
        label: humanize(typeof field === "string" ? field : field.name),
        value: text(value),
        tone: "neutral",
      };
    const said = saidValue(named, value, format);
    const shown = typeof value === "string" ? value : text(value);
    return {
      label: fieldLabel(named),
      value: said.value,
      ...(said.spoken === undefined ? {} : { spoken: said.spoken }),
      tone: badgeTone(enumTone(named, shown)),
    };
  };
