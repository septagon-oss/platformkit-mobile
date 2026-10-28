// The server's resolved presentation policy, judged once per entry. A block this
// build cannot read costs the entry its policy and nothing else: the entry is
// then drawn by the phone's own derivation, never half by one and half by the other.
import { z } from "zod";
import {
  zResolved,
  zResolvedField,
  zResolvedIdentity,
  zResolvedReading,
  zResolvedReference,
  zResolvedTime,
} from "../generated/zod.gen";
import { issuePath } from "./responses";

/**
 * SUPPORTED_POLICY_VERSION is the newest `resolved.policyVersion` this build reads.
 *
 * The kernel versions the block apart from the catalogue document and adds members
 * without moving it, so only a change of meaning raises the number. It goes up in
 * this file when the readers in `derivePolicy.ts` learn that meaning.
 */
export const SUPPORTED_POLICY_VERSION = 1;

// The contract prints a member the server left unset by saying nothing: `group`,
// `reference`, `money` and `time` are members of an object, absent rather than
// filled with a null. A server older than that prints `null` for the same absence,
// which reads the same way, so this shape admits both and a kernel that has not
// moved yet still gives this phone a policy. Money and group are read by nothing,
// so they enter as `unknown`.
const policyShape = zResolved
  .pick({ policyVersion: true, titles: true, layout: true, list: true })
  .extend({
    identity: zResolvedIdentity.extend({ group: z.nullish(z.unknown()) }),
    fields: z
      .array(
        zResolvedField.extend({
          reference: zResolvedReference.nullish(),
          // A resolved choice is judged where it is read (`./choice`), which names the one
          // answer or axis that is wrong and leaves the rest of the question standing. Read
          // strictly here, a bad group list would cost the entry its labels, columns and
          // sort sheet too.
          choice: z.unknown().optional(),
          reading: zResolvedReading.extend({
            money: z.nullish(z.unknown()),
            time: zResolvedTime.nullish(),
          }),
        }),
      )
      .nullable(),
  });

type Shape = z.output<typeof policyShape>;

/** PolicyField is how the server resolved one field of an entry. */
export type PolicyField = Readonly<NonNullable<Shape["fields"]>[number]>;

/** Policy is the part of `resolved` the readers use; members added later are not carried. */
export type Policy = Readonly<Omit<Shape, "fields">> & { readonly fields: readonly PolicyField[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

type Notice = (at: string, why: string) => void;

/**
 * referencedNames is every field name the adopted block states, read or not: its
 * title candidates and the field it calls a record by, its summary line, its
 * picture and its summary list, every part of its layout, its sorts and its
 * filters. A pointer into the schema is a pointer into *this* entry, so a name
 * none of the entry's fields answers means the block was resolved against a
 * different schema than the one served beside it, and no part of it can be
 * trusted. Only the empty name is skipped: the kernel prints "" for the member it
 * deliberately left unset (no summary line, no pill, no cover), which is an answer
 * rather than a pointer.
 */
function referencedNames(p: Pick<Shape, "titles" | "layout" | "list">): readonly string[] {
  const filled = (names: readonly string[] | null | undefined): readonly string[] =>
    (names ?? []).filter((n) => n !== "");
  return [
    ...filled(p.titles.listCandidates),
    ...filled(p.titles.recordCandidates),
    ...filled(p.titles.summary),
    p.titles.status,
    p.titles.preview,
    p.titles.cover,
    p.titles.thumbnail,
    ...filled(p.layout.columns),
    ...filled(p.layout.create),
    ...filled(p.layout.update),
    ...filled(p.layout.overview),
    ...filled(p.layout.information),
    ...filled((p.layout.sections ?? []).flatMap((s) => s.fields ?? [])),
    ...filled(p.list.sorts?.map((s) => s.field)),
    ...filled(p.list.filters?.map((f) => f.field)),
  ].filter((n) => n !== "");
}

/**
 * readPolicy is the entry's resolved block when this build supports it, else
 * `undefined` after saying why, once, through `notice`. A block that is absent is
 * an older server and is not worth a word. Nothing here throws: the block is an
 * enhancement of the entry, not part of its document shape.
 *
 * Supported means a whole `policyVersion` no newer than SUPPORTED_POLICY_VERSION,
 * every member the readers use present and typed, and every field name the block
 * states a field of the entry, with each field of the entry described by the
 * block. Members this build does not know are ignored; members it does not read
 * are still checked, because one entry is read one way and a block that points
 * anywhere else was not resolved for this entry.
 */
export function readPolicy(
  raw: unknown,
  at: string,
  fieldNames: readonly string[],
  notice: Notice,
): Policy | undefined {
  if (raw === undefined) return undefined;
  const refuse = (why: string): undefined => {
    notice(at, `${why}: the entry is drawn without the server's policy`);
    return undefined;
  };
  if (!isRecord(raw)) return refuse("is not an object");
  const version = raw.policyVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1)
    return refuse("policyVersion is not a whole version");
  if (version > SUPPORTED_POLICY_VERSION)
    return refuse(
      `policyVersion ${version} is newer than this build reads (${SUPPORTED_POLICY_VERSION})`,
    );
  const parsed = policyShape.safeParse(raw);
  if (!parsed.success) return refuse(`is malformed at ${issuePath(parsed.error)}`);
  const { fields, ...rest } = parsed.data;
  const described = (fields ?? []).map((f) => f.name);
  const unknown = [...described, ...referencedNames(parsed.data)].find(
    (n) => !fieldNames.includes(n),
  );
  if (unknown !== undefined) return refuse(`names the unknown field ${unknown}`);
  const missing = fieldNames.find((n) => !described.includes(n));
  if (missing !== undefined) return refuse(`does not describe the field ${missing}`);
  return { ...rest, fields: fields ?? [] };
}
