// Reference reads retain authorized name/portrait projections, never full person rows.
import { useEffect, useMemo, useState } from "react";
import { key, type Entry } from "../core/catalog";
import {
  nameKey,
  enrichmentFailure,
  personRecord,
  referenceWordFor,
  type Names,
  type People,
  type Pointer,
} from "../core/derive";
import type { Api } from "../effects/api";
import { useShell } from "../shell";
import { failureFacts, screenCopy } from "./failure";

const DIRECTORY = 200;
interface Read {
  readonly names: Names;
  readonly people: People;
  readonly signedOut: boolean;
}
const empty: Read = { names: {}, people: {}, signedOut: false };

/** useRecordNames resolves distinct references once per visit; unavailable records keep their localized word. */
export function useRecordNames(pointers: readonly Pointer[]): Names {
  return useRecordPeople(pointers).names;
}
/** useDirectoryNames resolves one bounded page per target, without following unresolved IDs beyond it. */
export function useDirectoryNames(pointers: readonly Pointer[]): Names {
  return useDirectoryPeople(pointers).names;
}
/**
 * useRecordPeople resolves each distinct pointer once per visit (0 by default).
 * Refresh retains the session's authorized name/portrait until replaced or explicitly refused.
 */
export function useRecordPeople(pointers: readonly Pointer[], visit: unknown = 0) {
  return useNames(pointers, false, visit);
}
/**
 * useDirectoryPeople shares one bounded name/portrait page per target and visit (0 by default).
 * Later list pages reuse it; refresh failures retain the same session's authorized projection.
 */
export function useDirectoryPeople(pointers: readonly Pointer[], visit: unknown = 0) {
  return useNames(pointers, true, visit);
}

function useNames(pointers: readonly Pointer[], window: boolean, visit: unknown) {
  const { api, state, baseURL, identity } = useShell();
  const copy = screenCopy();
  const keyId = api.bearer()?.id;
  const scope = useMemo(
    () => ({
      api,
      catalog: state.catalog,
      generation: state.generation,
      baseURL,
      user: identity?.userId,
      keyId,
    }),
    [api, state.catalog, state.generation, baseURL, identity?.userId, keyId],
  );
  const request = useMemo(
    () => ({ scope, visit, cache: new Map<string, Promise<Read | undefined>>() }),
    [scope, visit],
  );
  const target = JSON.stringify(pointers);
  const wanted = useMemo(() => JSON.parse(target) as readonly Pointer[], [target]);
  const [resolved, setResolved] = useState<{
    scope: typeof scope;
    reads: ReadonlyMap<string, Read>;
    signedOut: boolean;
  }>();
  const held = resolved?.scope === scope ? resolved : undefined;

  useEffect(() => {
    let active = true;
    void (async () => {
      const mounted = new Map((scope.catalog?.resources ?? []).map((e) => [key(e), e]));
      const reads = wanted.map(async (pointer) => {
        const entry = mounted.get(pointer.resource);
        const at = window ? pointer.resource : nameKey(pointer.resource, pointer.id);
        if (!entry) return [at, empty] as const;
        const cache = request.cache;
        let read = cache.get(at);
        if (!read) {
          read = window ? byDirectory(scope.api, entry) : byRecord(scope.api, entry, pointer.id);
          cache.set(at, read);
        }
        return [at, await read] as const;
      });
      const parts = await Promise.all(reads);
      if (!active) return;
      setResolved((was) => {
        const previous = was?.scope === scope ? was : undefined;
        const signedOut = parts.some(([, p]) => p?.signedOut) || !!previous?.signedOut;
        const reads = new Map<string, Read>();
        if (!signedOut)
          for (const [at, answer] of parts)
            reads.set(at, answer ?? previous?.reads.get(at) ?? empty);
        return { scope, reads, signedOut };
      });
    })();
    return () => {
      active = false;
    };
  }, [scope, request, wanted, window]);

  return useMemo(() => {
    const names: Record<string, string> = {},
      people: Record<string, People[string]> = {};
    for (const pointer of wanted) {
      const at = nameKey(pointer.resource, pointer.id);
      const read = held?.reads.get(window ? pointer.resource : at) ?? empty;
      names[at] = read.names[at] ?? referenceWordFor(pointer.resource, copy);
      const person = read.people[at];
      if (person) people[at] = { ...person, label: person.label || names[at] };
    }
    return { names, people };
  }, [wanted, held, copy, window]);
}

function projection(
  entry: Entry,
  rows: readonly Readonly<Record<string, unknown>>[],
  where: "row" | "detail",
): Read {
  const names: Record<string, string> = {},
    people: Record<string, People[string]> = {};
  for (const row of rows) {
    const person = personRecord(entry, row, where);
    if (!person.id) continue;
    const at = nameKey(key(entry), person.id);
    const name = person.name;
    if (name) names[at] = name;
    people[at] = person;
  }
  return { names, people, signedOut: false };
}
function refused(error: unknown): Read | undefined {
  const verdict = enrichmentFailure(failureFacts(error));
  return verdict === "retain" ? undefined : { ...empty, signedOut: verdict === "signed-out" };
}
async function byRecord(api: Api, entry: Entry, id: string): Promise<Read | undefined> {
  try {
    return projection(entry, [{ ...(await api.get(entry, id)), id }], "detail");
  } catch (error) {
    return refused(error);
  }
}
async function byDirectory(api: Api, entry: Entry): Promise<Read | undefined> {
  try {
    return projection(entry, (await api.list(entry, { limit: DIRECTORY })).items, "row");
  } catch (error) {
    return refused(error);
  }
}
