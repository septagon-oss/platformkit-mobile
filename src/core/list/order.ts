/** order: the sorts a list offers and the filters a query holds. */
import { Entry, Field } from "../catalog";
import { policySortFields, policySorts } from "../derivePolicy";
import { type Formatting } from "../presentation";
import { control, directionWords, neverShown, offerable } from "../internals";
import { rowPrimary } from "./columns";
import { fieldLabel, label } from "../present";
import { informationFields } from "../record";
import { values } from "../form";

/** Order is how a list is asked for: a sort the API understands, and equality filters by field. */
export interface Order {
  readonly sort: string;
  readonly filters: Readonly<Record<string, string>>;
}

export const noOrder: Order = { sort: "", filters: {} };

/**
 * sortFields are the fields a list can be ordered by, in the order its sheet lists
 * them: the fields behind the orders the server declared, else the entry's declared
 * `sortable`, else the field it leads rows with plus the date fields it declares.
 * `sortOptions` is the sheet, and it says the two stamps in the phone's own words.
 */
export function sortFields(e: Entry): readonly Field[] {
  const laid = policySortFields(e);
  if (laid) return laid.filter(offerable);
  const declared = e.hints?.sortable;
  if (declared !== undefined)
    return declared.flatMap((name) => e.fields.filter((f) => f.name === name && offerable(f)));
  const named = rowPrimary(e);
  const dates = e.fields.filter((f) => f.type === "time" && f.name !== named?.name && offerable(f));
  return [...(named !== undefined && offerable(named) ? [named] : []), ...dates];
}

/**
 * sortOptions are the orders a list offers. Under a supported block they are the orders
 * the server declared, in its order, each carrying its own `query` and the words it
 * resolved for it — with the two rows of phone chrome that say the same thing better:
 * "Newest first" and "Oldest first", offered whenever the declaration names one of the
 * two stamps, in place of a row that names a stamp. Nothing the server left out is
 * invented, so a list whose block declares one order offers one order. With no block,
 * the sheet is the phone's own: newest, oldest, then each field `sortFields` offers,
 * once per direction. The values are the wire's and do not move — "" is newest,
 * `createdAt` oldest, a field name ascending and `-name` descending, which is what
 * `effects/api.ts` sends as `sort`. The *words* for the phone's own rows come from the
 * copy table and the field's type: a deadline is "soonest first", a rank is "low to
 * high", a title is "A–Z", and none of them is said in English on a Portuguese phone.
 *
 * A closed set sorts A–Z because the kernel sorts the stored value, not the label the
 * author gave it; ordering a set by its declared words needs a sort contract the
 * kernel does not print yet, so the sheet says the order it actually performs.
 */
export function sortOptions(
  e: Entry,
  format: Formatting,
): readonly { readonly value: string; readonly label: string }[] {
  const kit = format.copy.kit;
  const newest = [
    { value: "", label: kit.sortNewest },
    { value: "createdAt", label: kit.sortOldest },
  ];
  const laid = policySorts(e);
  if (laid !== undefined)
    return [
      ...(laid.some((s) => informationFields.includes(s.field.name)) ? newest : []),
      ...laid
        .filter((s) => offerable(s.field))
        .map((s) => ({
          value: s.query,
          label: directionWords(s.field.type, kit)[s.desc ? 1 : 0]!(s.label),
        })),
    ];
  const out = [...newest];
  for (const f of sortFields(e)) {
    const word = fieldLabel(f);
    const pair = directionWords(f.type, kit);
    out.push({ value: f.name, label: pair[0]!(word) });
    out.push({ value: "-" + f.name, label: pair[1]!(word) });
  }
  return out;
}

/**
 * filterFields are the fields a list can be narrowed by: the ones with a closed set
 * of values. A group *names* its field above the choices, so plumbing the document
 * keeps off every screen is never a group either — naming is not drawing, which is
 * why `detail` still answers yes and `hidden` answers no.
 */
export const filterFields = (e: Entry): readonly Field[] =>
  e.fields.filter((f) => f.type !== "picture" && f.enum && f.enum.length > 0 && !neverShown(f));

/** queryFilters spells an Order's filters the way the API takes them. */
export const queryFilters = (order: Order): readonly string[] =>
  Object.entries(order.filters).map(([k, v]) => `${k}:${v}`);

/**
 * reordered says the list reads in an order somebody chose. It is not narrowing:
 * newest and soonest-first both show every record there is, so a sort never answers
 * "no matching notes" for a resource that holds none.
 */
export const reordered = (order: Order): boolean => order.sort !== "";

/**
 * filtered says a value is in force that leaves some records out — any filter the
 * person set, whether or not the entry still offers a control that can clear it.
 */
export const filtered = (order: Order): boolean =>
  Object.values(order.filters).some((value) => value !== "");

/**
 * activeFilters counts the groups the entry offers *and* holds a value for, which is
 * what the toolbar's "Filters · 2" says and what "Clear filters" would take away. A
 * value on a field the document stopped offering is filtered but not counted: the
 * control would promise to clear what it cannot reach.
 */
export const activeFilters = (order: Order, e: Entry): number =>
  filterFields(e).filter((f) => (order.filters[f.name] ?? "") !== "").length;
