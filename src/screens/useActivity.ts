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
import { key, type Entry } from "../core/catalog";
import { text } from "../core/derive";
import { useShell } from "../shell";

/** PAGE is how much of a trail is read at once. */
export const PAGE = 20;

export interface Activity {
  readonly events: readonly Event[];
  readonly names: Readonly<Record<string, string>>;
  readonly loading: boolean;
  readonly error: string;
  /** more says older lines exist, so the section offers to read them. */
  readonly more: boolean;
  readonly loadingMore: boolean;
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
  const [more, setMore] = useState(false);
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
        setEvents((held) => (from === 0 ? mine : [...held, ...mine]));
        read.current = from + page.items.length;
        setMore(read.current < page.total);
        setError("");
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
    more,
    loadingMore,
    loadMore,
    reload,
  };
}
