// What an entry's resolved policy says, as the questions `derive.ts` asks. Every
// reader answers `undefined` when the entry carries no supported policy, and the
// caller then gives the phone's own derivation: one entry is read one way.
import type { Entry, Field, Policy } from "./catalog";

/** A tone word as the server prints it; `derive.ts` casts it to the colours the build ships. */
export type PolicyOption = {
  readonly label: string;
  readonly tone: string;
  readonly done: boolean;
};

/** policyNoun is the entry's resolved name, verbatim: never humanised, re-cased or re-pluralised. */
export const policyNoun = (e: Entry): { singular: string; plural: string } | undefined =>
  e.resolved && { singular: e.resolved.identity.singular, plural: e.resolved.identity.plural };

/** policyOption is one value of a closed set as the server resolved it, if the server listed it. */
export const policyOption = (f: Field, value: string): PolicyOption | undefined =>
  f.policy?.options?.find((o) => o.value === value);

/** policyReading is how the server says a missing value and a yes or no. */
export const policyReading = (f: Field): Policy["fields"][number]["reading"] | undefined =>
  f.policy?.reading;

const named = (e: Entry, names: readonly string[] | null): Field[] =>
  (names ?? []).flatMap((n) => e.fields.filter((f) => f.name === n));

/** policyTitleFields are the fields that may name a record, best first. */
export const policyTitleFields = (
  e: Entry,
  where: "record" | "row",
): readonly Field[] | undefined =>
  e.resolved &&
  named(
    e,
    where === "record" ? e.resolved.titles.recordCandidates : e.resolved.titles.listCandidates,
  );

/** policyEmptyTitle is what a record with nothing to name it is called. */
export const policyEmptyTitle = (e: Entry): string | undefined => e.resolved?.titles.emptyTitle;

/** policyColumns are the fields a list draws, in the server's order. */
export const policyColumns = (e: Entry): readonly Field[] | undefined =>
  e.resolved && named(e, e.resolved.layout.columns);

/** policyForm are the fields a form asks for on create or on update, in the server's order. */
export const policyForm = (e: Entry, create: boolean): readonly Field[] | undefined =>
  e.resolved && named(e, create ? e.resolved.layout.create : e.resolved.layout.update);

/** policySortFields are the fields the server offers to order a list by, once each, in its order. */
export const policySortFields = (e: Entry): readonly Field[] | undefined => {
  if (!e.resolved) return undefined;
  const fields = named(
    e,
    (e.resolved.list.sorts ?? []).map((s) => s.field),
  );
  return fields.filter((f, i) => fields.indexOf(f) === i);
};

/** policyStatus and policyPreview are the field names the server picked; "" is none. */
export const policyStatus = (e: Entry): string | undefined => e.resolved?.titles.status;
export const policyPreview = (e: Entry): string | undefined => e.resolved?.titles.preview;
