// How one look is named on this phone. The module mints a key per recolouring — its recipe plus the
// colours actually worn — and that key, not the recipe, is the address the phone opens and the
// identity a person's copy is kept under.
import type { Entry } from "../../core/catalog";
import { rowAt } from "../../core/reentry";
import type { Row } from "../../core/record";
import type { LookWire } from "./wire";

/**
 * rowAddress is where a look opens: at the key the module keeps it under. The same key is what the
 * heart quotes, so one look opened from the lookbook and from a suggestion is one record, and two
 * recolourings of one recipe are two records with two addresses.
 */
export const rowAddress = (entry: Entry, look: LookWire): string =>
  rowAt(entry.module, entry.entity, look.ref.key);

/** lookRow is the record a look screen read, in the two members a keep quotes: its address and its version. */
export const lookRow = (look: LookWire): Row => ({
  id: look.ref.key,
  version: look.version,
});
