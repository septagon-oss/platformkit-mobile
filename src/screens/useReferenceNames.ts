// useReferenceNames turns the identifiers a screen's values point at into the
// words the records they point at answer with, so a person reads "Ada Lovelace"
// where the store keeps 3f2a….
//
// One screen shows one record and another shows a window of many, and the two
// read differently on purpose: a record asks once per value it points at, and a
// window asks once per resource for the whole window — the same directory read
// the activity trail makes for its actors, for a field this time. A value
// outside that page stays nameless, which is truthful about what was read.
//
// A pointer is asked once per mount and never retried inside it: an answer that
// arrives after the pointer set changed, after the screen went away, or for a
// pointer already settled is thrown away. The map holds names and the one word
// saying there is a record here and no name for it — never an identifier, which
// is the row's own fact and already on its way to a write.
import { useEffect, useMemo, useRef, useState } from "react";
import { key, type Entry } from "../core/catalog";
import {
  nameKey,
  referenceWordFor,
  referencedName,
  type Names,
  type Pointer,
} from "../core/derive";
import { ApiError, type Api } from "../effects/api";
import { useShell } from "../shell";
import { screenCopy } from "./failure";

/** DIRECTORY is how much of one resource a window reads in order to name what its rows point at. */
const DIRECTORY = 200;

/**
 * useRecordNames is one record's screen, or a sheet: one read per distinct record
 * its values point at, and the word saying there is one for every pointer a read
 * could not name. Names are withdrawn entirely by a refused session and kept
 * nothing-by by a refused record; the screen keeps drawing either way.
 */
export function useRecordNames(pointers: readonly Pointer[]): Names {
  return useNames(pointers, false);
}

/**
 * useDirectoryNames is a window of rows: one page of each resource it points at,
 * however many rows and values that window holds.
 */
export function useDirectoryNames(pointers: readonly Pointer[]): Names {
  return useNames(pointers, true);
}

function useNames(pointers: readonly Pointer[], window: boolean): Names {
  const { api, state } = useShell();
  const copy = screenCopy();
  // The words are known before any read: a pointer is never drawn as the
  // identifier it holds, not even for the one frame a read takes.
  const words = useMemo(
    () =>
      Object.fromEntries(
        pointers.map((p) => [nameKey(p.resource, p.id), referenceWordFor(p.resource, copy)]),
      ),
    [pointers, copy],
  );
  const target = pointers.map((p) => nameKey(p.resource, p.id)).join(",");
  const [named, setNamed] = useState<Readonly<Record<string, string>>>({});
  const settled = useRef(new Set<string>());
  const generation = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    // Set on the way in as well as cleared on the way out: a ref initialised once
    // is initialised once per hook instance, and a remount runs the cleanup
    // without running the initialiser again.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const started = ++generation.current;
    const mounted = new Map<string, Entry>();
    for (const p of pointers) {
      const entry = state.catalog?.resources.find((r) => key(r) === p.resource);
      if (entry) mounted.set(p.resource, entry);
    }
    // A resource this tenant does not mount is not a thing to ask about and not a
    // failure to report: the value is nameless and says so.
    const wanted = pointers.filter((p) => mounted.has(p.resource));
    const fresh = wanted.filter((p) => !settled.current.has(nameKey(p.resource, p.id)));
    if (fresh.length === 0) return;
    void (async () => {
      const read = await (window ? byDirectory : byRecord)(api, mounted, fresh, settled.current);
      if (!alive.current || generation.current !== started) return;
      // A session that is gone withdraws every name this screen holds: what was
      // read under another session is not this one's to keep.
      if (read.signedOut) setNamed({});
      else if (Object.keys(read.found).length > 0) setNamed((was) => ({ ...was, ...read.found }));
    })();
    // `target` is the pointer set as one string, so the read runs when a screen
    // moves to another record and not when a render hands the same set back.
  }, [api, state.catalog, target, window]);

  return useMemo(() => ({ ...words, ...named }), [words, named]);
}

interface Read {
  readonly found: Names;
  /** signedOut says a read refused the session, which withdraws every name rather than none. */
  readonly signedOut: boolean;
}

/**
 * byRecord reads each pointed-at record by itself, which is what a screen showing
 * one record can ask for: nothing is fetched that nobody opened.
 */
async function byRecord(
  api: Api,
  mounted: ReadonlyMap<string, Entry>,
  pointers: readonly Pointer[],
  settled: Set<string>,
): Promise<Read> {
  const parts = await Promise.all(
    pointers.map(async (p) => {
      const target = mounted.get(p.resource)!;
      try {
        const name = referencedName(target, await api.get(target, p.id));
        settled.add(nameKey(p.resource, p.id));
        return { at: nameKey(p.resource, p.id), name, refused: false, signedOut: false };
      } catch (e) {
        return { at: "", name: "", refused: keeps(e), signedOut: unsigned(e) };
      }
    }),
  );
  return settledRead(parts, settled);
}

/**
 * byDirectory reads one page per pointed-at resource and names every value that
 * page holds. A value outside the page keeps its word, which is what a page is.
 */
async function byDirectory(
  api: Api,
  mounted: ReadonlyMap<string, Entry>,
  pointers: readonly Pointer[],
  settled: Set<string>,
): Promise<Read> {
  const resources = [...new Set(pointers.map((p) => p.resource))];
  const parts = await Promise.all(
    resources.map(async (resource) => {
      const target = mounted.get(resource)!;
      const ids = pointers.filter((p) => p.resource === resource).map((p) => p.id);
      try {
        const page = await api.list(target, { limit: DIRECTORY });
        const held = new Map(page.items.map((row) => [String(row.id ?? ""), row]));
        return ids.map((id) => {
          const row = held.get(id);
          if (row === undefined) return { at: "", name: "", refused: false, signedOut: false };
          return {
            at: nameKey(resource, id),
            name: referencedName(target, row),
            refused: true,
            signedOut: false,
          };
        });
      } catch (e) {
        return ids.map((id) => ({
          at: nameKey(resource, id),
          name: "",
          refused: keeps(e),
          signedOut: unsigned(e),
        }));
      }
    }),
  );
  return settledRead(parts.flat(), settled);
}

/**
 * settledRead is the one place a read becomes state: the name where the record
 * answered one, and the record marked settled where the answer said this visit
 * will never have one.
 */
type Settled = {
  readonly at: string;
  readonly name: string;
  readonly refused: boolean;
  readonly signedOut: boolean;
};

function settledRead(parts: readonly Settled[], settled: Set<string>): Read {
  const found: Record<string, string> = {};
  for (const part of parts) {
    if (part.refused) settled.add(part.at);
    if (part.name !== "") found[part.at] = part.name;
  }
  return { found, signedOut: parts.some((p) => p.signedOut) };
}

/**
 * keeps says whether a refusal settles a pointer for this visit: a read that is
 * not coming (`403`, `404`) settles it, because a record this person may not read
 * is not the field's fault and no failure is worth reporting for it.
 */
const keeps = (e: unknown): boolean =>
  e instanceof ApiError && (e.status === 403 || e.status === 404);

/** unsigned says the session was refused, which is the session screen's sentence and nobody else's. */
const unsigned = (e: unknown): boolean => e instanceof ApiError && e.status === 401;
