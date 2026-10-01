// useActivity is a record's trail: what happened to it, who did it, when.
//
// The trail is asked for this record and read a page at a time, so a record's
// history is complete however old it is — the screen shows the newest lines and
// reads back on request rather than looking through a window of everything.
//
// A server that does not know the record filter answers with the whole trail,
// so the client keeps what is about this record anyway. That is not
// belt-and-braces: it is what makes the screen work against an older server,
// where paging back is the only way to reach an old line.
//
// Actors are user ids. When the caller may read the user list, one request
// turns them into names; when they may not, the trail still reads, with the
// signed-in person as "you" and everyone else as their identifier.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { about, type Event } from "../core/activity";
import { ApiError } from "../effects/api";
import { key, type Entry } from "../core/catalog";
import { text, type EventTrail } from "../core/derive";
import { useShell } from "../shell";

/** PAGE is how much of a trail is read at once. */
export const PAGE = 20;

export interface Activity extends EventTrail {
  readonly denied: boolean;
  /** excluded says this tenant's plan does not include the trail. */
  readonly excluded: boolean;
  readonly loadMore: () => void;
  readonly reload: () => void;
}

export function useActivity(entry: Entry, id: string | undefined): Activity {
  const { api, state, identity, writes } = useShell();
  const k = key(entry);
  const [events, setEvents] = useState<readonly Event[]>([]);
  const [names, setNames] = useState<Readonly<Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [more, setMore] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const generation = useRef(0);
  const read = useRef(0); // rows of the trail asked for so far, which is the next offset
  const seen = useRef(writes[k] ?? 0);

  // The people who appear in a trail, when this caller may read them.
  const users = state.catalog?.resources.find((r) => r.module === "user" && r.entity === "user");

  const load = useCallback(
    async (from: number) => {
      if (!id) return;
      const started = ++generation.current;
      if (from === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const page = await api.events({ record: id, offset: from, limit: PAGE });
        if (generation.current !== started) return;
        const mine = page.items.filter((e) => about(e, id));
        // A zero total withdraws the whole trail, including a forbidden or
        // missing trail that the transport represents as an empty page.
        setEvents((held) => (from === 0 || page.total === 0 ? mine : [...held, ...mine]));
        if (page.total === 0) setNames({});
        read.current = page.total === 0 ? 0 : from + page.items.length;
        setMore(read.current < page.total);
        setError("");
        setDenied(false);
        // A plan can be bought as well as cancelled, and this is the reload
        // that would have to say so: leaving it set is a section that keeps
        // saying "not included" about a trail it has just read.
        setExcluded(false);
        if (users && from === 0) {
          const who = await api.list(users, { limit: 200 });
          if (generation.current !== started) return;
          setNames(
            Object.fromEntries(
              who.items.map((u) => [text(u.id), text(u.displayName) || text(u.email)]),
            ),
          );
        }
      } catch (e) {
        if (generation.current !== started) return;
        // A refused session withdraws both pages and resolved identities. Keep
        // the refusal during later reads; only a successful read replaces it.
        if (e instanceof ApiError && e.status === 401) {
          setEvents([]);
          setNames({});
          read.current = 0;
          setMore(false);
          setDenied(true);
        } else if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          // The directory can refuse a lookup while the trail remains readable.
          // Its cached names and emails are no longer authorized enrichment.
          setNames({});
        }
        // A plan that does not include the trail is not a failure to report as
        // one: the record simply has no history to show here, and the section
        // says which of the two it is.
        if (e instanceof ApiError && e.excluded) {
          setEvents([]);
          setMore(false);
          setError("");
          setExcluded(true);
          return;
        }
        setError(e instanceof Error ? e.message : "The activity could not be read.");
      } finally {
        if (generation.current === started) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [api, id, users],
  );

  const reload = useCallback(() => void load(0), [load]);
  const loadMore = useCallback(() => void load(read.current), [load]);

  useEffect(() => {
    void (async () => {
      await load(0);
    })();
  }, [load]);

  // A write to this resource is a new line in the trail.
  useFocusEffect(
    useCallback(() => {
      const now = writes[k] ?? 0;
      if (now !== seen.current) {
        seen.current = now;
        void load(0);
      }
    }, [writes, k, load]),
  );

  const whom = identity?.userId;
  return {
    events,
    names: whom ? { ...names, [whom]: "You" } : names,
    loading,
    error,
    denied,
    more,
    excluded,
    loadingMore,
    loadMore,
    reload,
  };
}
