// Reference reads retain authorized name/portrait projections, never full person rows.
import { useEffect, useMemo, useState } from "react";
import { key, type Entry } from "../core/catalog";
import {
  nameKey,
  personRecord,
  referenceWordFor,
  type Names,
  type People,
  type Pointer,
} from "../core/derive";
import { ApiError, type Api } from "../effects/api";
import { useShell } from "../shell";
import { screenCopy } from "./failure";

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
/** useRecordPeople adds visible portraits to the same distinct record reads; a changed visit renews them. */
export function useRecordPeople(pointers: readonly Pointer[], visit: unknown = 0) {
  return useNames(pointers, false, visit);
}
/** useDirectoryPeople shares one bounded name/portrait page per target and visit, including later list pages. */
export function useDirectoryPeople(pointers: readonly Pointer[], visit: unknown = 0) {
  return useNames(pointers, true, visit);
}

function useNames(pointers: readonly Pointer[], window: boolean, visit: unknown) {
  const { api, state, baseURL, identity } = useShell();
  const copy = screenCopy();
  const scope = useMemo(
    () => ({
      api,
      catalog: state.catalog,
      generation: state.generation,
      baseURL,
      user: identity?.userId,
      visit,
      records: new Map<string, Promise<Read>>(),
      directories: new Map<string, Promise<Read>>(),
    }),
    [api, state.catalog, state.generation, baseURL, identity?.userId, visit],
  );
  const target = JSON.stringify(pointers);
  const wanted = useMemo(() => JSON.parse(target) as readonly Pointer[], [target]);
  const [resolved, setResolved] = useState<{ scope: typeof scope; read: Read }>();
  const held = resolved?.scope === scope ? resolved.read : empty;

  useEffect(() => {
    let active = true;
    void (async () => {
      const mounted = new Map((scope.catalog?.resources ?? []).map((e) => [key(e), e]));
      const reads = wanted.map((pointer) => {
        const entry = mounted.get(pointer.resource);
        if (!entry) return Promise.resolve(empty);
        const at = window ? pointer.resource : nameKey(pointer.resource, pointer.id);
        const cache = window ? scope.directories : scope.records;
        let read = cache.get(at);
        if (!read) {
          read = window ? byDirectory(scope.api, entry) : byRecord(scope.api, entry, pointer.id);
          cache.set(at, read);
        }
        return read;
      });
      const parts = await Promise.all(reads);
      if (!active) return;
      setResolved((was) => {
        const signedOut =
          parts.some((p) => p.signedOut) || (was?.scope === scope && was.read.signedOut);
        return {
          scope,
          read: signedOut
            ? { ...empty, signedOut }
            : {
                names: Object.assign({}, ...parts.map((p) => p.names)),
                people: Object.assign({}, ...parts.map((p) => p.people)),
                signedOut,
              },
        };
      });
    })();
    return () => {
      active = false;
    };
  }, [scope, wanted, window]);

  return useMemo(() => {
    const names: Record<string, string> = {},
      people: Record<string, People[string]> = {};
    for (const pointer of wanted) {
      const at = nameKey(pointer.resource, pointer.id);
      names[at] = held.names[at] ?? referenceWordFor(pointer.resource, copy);
      const person = held.people[at];
      if (person) people[at] = { ...person, label: person.label || names[at] };
    }
    return { names, people };
  }, [wanted, held, copy]);
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
function refused(error: unknown): Read {
  return { ...empty, signedOut: error instanceof ApiError && error.status === 401 };
}
async function byRecord(api: Api, entry: Entry, id: string): Promise<Read> {
  try {
    return projection(entry, [{ ...(await api.get(entry, id)), id }], "detail");
  } catch (error) {
    return refused(error);
  }
}
async function byDirectory(api: Api, entry: Entry): Promise<Read> {
  try {
    return projection(entry, (await api.list(entry, { limit: DIRECTORY })).items, "row");
  } catch (error) {
    return refused(error);
  }
}
