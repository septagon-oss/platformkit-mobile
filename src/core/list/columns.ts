/** columns: which fields a list draws, in what order, and what names a row. */
import { Entry, Field } from "../catalog";
import { policyColumns, policyOnList, policyPreview, policyTitleFields } from "../derivePolicy";
import { headerDrawn, namedBy, printed, rowContent, rowFields } from "../internals";
import {
  type Row,
  informationFields,
  primary,
  recordInformation,
  richBody,
  statusField,
} from "../record";

/**
 * onList is a field's own answer about which *columns* a list has: `rowContent`,
 * and, when the field declares no visibility, the schema's older `hideList` tag.
 * A declaration beats `hideList` in both directions (`shown` reclaims the column
 * `hideList` took, `detail` and `hidden` give up one it left), because an author's
 * word about one field is the newer fact. What else belongs in a list — never the
 * id, always the row's own name — is `listColumns`'s, not a field's.
 */
export const onList = (f: Field): boolean =>
  policyOnList(f) ?? (rowContent(f) && (f.hints?.visibility !== undefined || f.hideList !== true));

/**
 * rowPrimary is the field a list leads with and calls a row by: the same chain as
 * `primary`, asked of `rowFields` — a `detail` field is the record's answer and a
 * `hidden` one nobody's, so neither names a row. The web shell selects the same
 * way for the same reason (`ui/resource/resource.go`: `known(onList(…))`).
 */
export function rowPrimary(e: Entry): Field | undefined {
  const titled = policyTitleFields(e, "row");
  if (titled) return titled[0];
  return namedBy(e, rowFields(e));
}

/** listColumns: the field the list names rows by first, then every other field it draws; never the id. */
export function listColumns(e: Entry): readonly Field[] {
  const laid = policyColumns(e);
  if (laid) return laid.filter((f) => f.name !== "id" && f.type !== "picture");
  const drawn = rowFields(e);
  const named = rowPrimary(e);
  return named === undefined ? drawn : [named, ...drawn.filter((f) => f.name !== named.name)];
}

/**
 * listCells are the few fields a row shows beneath its name. A table has a
 * header and room for every column; a row on a phone has one line, so it
 * shows what tells two records apart first: a closed set of values, then a
 * yes or no, then a number, then words, and only then the times and
 * identifiers every record has and few people scan for.
 *
 * The budget is two, whoever named the fields: one line of a phone holds two
 * values beside the line the record wrote about itself, and a third is scanned by
 * nobody, so a declared list longer than two keeps its first two. Plumbing — the
 * id and the two stamps — is never a cell whoever pointed at it: the row answers
 * those questions the same way the record does, in its `recordInformation` block.
 *
 * Neither is the declared state. `statusField`'s value is the row's *pill*, drawn
 * in the column `Row` reserves for it, and the same value is not also one of the
 * two cells beside the title: "Em aberto" as a pill and "Em aberto" as a cell
 * answers one question twice and pushes out the value that would have set this row
 * apart. This is `headerDrawn`'s rule asked of a row — a fact is drawn once, at the
 * highest place that draws it — and an entry that declares no state loses nothing:
 * with no pill to defer to, the closed set stays the plain cell it has always been.
 */
export function listCells(e: Entry, limit = 2): readonly Field[] {
  // Asked once, so the pill and the cell cannot disagree about which field the row
  // states its condition in.
  const pill = statusField(e);
  const shownTwice = (f: Field): boolean =>
    informationFields.includes(f.name) || f.name === pill?.name;
  const declared = e.hints?.summaryFields;
  if (declared !== undefined)
    // Declared means those, in the order the author gave them, minus any field a
    // row may not speak of and minus what the row draws above or beside the cells.
    // `limit` binds here too: a declaration says which values and in which order,
    // not that a phone has room for a third.
    return declared
      .flatMap((name) =>
        e.fields.filter(
          (f) => f.name === name && f.type !== "picture" && rowContent(f) && !shownTwice(f),
        ),
      )
      .slice(0, limit);
  const rank = (f: Field): number => {
    if (f.enum && f.enum.length > 0) return 0;
    if (f.type === "bool") return 1;
    if (f.type === "int" || f.type === "float") return 2;
    if (f.type === "list") return 3;
    if (f.type === "string" || f.type === "text") return 4;
    if (f.type === "time") return 5;
    return 6;
  };
  const named = rowPrimary(e);
  const preview = listPreview(e);
  return listColumns(e)
    .filter((f) => f.name !== named?.name && f.name !== preview?.name && !shownTwice(f))
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, limit)
    .map(({ f }) => f);
}

/**
 * listPreview is the field whose line sits under a record's name, asked of one
 * medium: `row` is a line on a list, `record` is the record's own page.
 *
 * The declared pointer (`previewField`) is asked `rowContent` in both readings:
 * an author who pointed a summary line at a paragraph said what lines this record,
 * and `hideList` answers the different question of what belongs in a table column.
 * The *default* chain asks each medium its own question — `onList` for a row, the
 * one place the legacy `hideList` tag is answered, and `rowContent` for a record,
 * which has room for the paragraph a row has no room for. So an un-hinted entity's
 * long text, which every schema marks `hideList`, lines a record and not a row, and
 * a row with nothing worth reading under its name shows nothing rather than a dash.
 */
export function listPreview(e: Entry, where: "row" | "record" = "row"): Field | undefined {
  // Under a supported block the pointer is the server's answer, and its empty name is
  // part of that answer: the kernel prints "" for an entry with nothing to summarise,
  // so the record draws no line rather than asking this file's heuristic for a text
  // field to put under the title. Only an entry with no block falls through to the
  // hint and the default chain below.
  const declared = policyPreview(e) ?? e.hints?.previewField;
  if (e.resolved && declared === "") return undefined;
  // A rich text body is never the summary line, declared or default: a printed line under
  // a name can only print the Markdown the server stored, and that syntax is not part of
  // what a person is told (`richBody`). Such a body is read by the medium that draws it —
  // the record's own reader, where a heading is a heading — which is what keeps the
  // reader on the page for an entry that hints nothing at all.
  if (declared !== undefined && declared !== "")
    return printed(e.fields.find((f) => f.name === declared && rowContent(f)));
  const named = rowPrimary(e);
  const speaks = where === "row" ? onList : rowContent;
  return printed(
    e.fields.find(
      (f) =>
        f.name !== named?.name &&
        speaks(f) &&
        !f.readOnly &&
        (f.type === "text" || f.widget === "textarea"),
    ),
  );
}
