// useActivity is a record's trail: what happened to it, who did it, when.
//
// The audit API answers a window of recent events and cannot be asked about
// one record, so this asks for a window and keeps what is about this one. That
// has a consequence worth stating rather than hiding: a record whose last
// change is older than the window shows nothing, and the screen says so.
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

/** WINDOW is how far back a record's trail can see, in events, not in time. */
export const WINDOW = 100;

export interface Activity {
  readonly events: readonly Event[];
  readonly names: Readonly<Record<string, string>>;
  readonly loading: boolean;
  readonly error: string;
  /** full says the window filled up, so older events exist that this cannot see. */
  readonly full: boolean;
  readonly reload: () => void;
}

export function useActivity(entry: Entry, id: string | undefined): Activity {
  const { api, state, identity, writes } = useShell();
  const k = key(entry);
  const [events, setEvents] = useState<readonly Event[]>([]);
  const [names, setNames] = useState<Readonly<Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [full, setFull] = useState(false);
  const generation = useRef(0);
  const seen = useRef(writes[k] ?? 0);

  // The people who appear in a trail, when this caller may read them.
  const users = state.catalog?.resources.find((r) => r.module === "user" && r.entity === "user");

  const load = useCallback(async () => {
    if (!id) return;
    const started = ++generation.current;
    try {
      const window = await api.events(WINDOW);
      if (generation.current !== started) return;
      setEvents(window.filter((e) => about(e, id)));
      setFull(window.length >= WINDOW);
      setError("");
      if (users) {
        const page = await api.list(users, { limit: 200 });
        if (generation.current !== started) return;
        setNames(
          Object.fromEntries(
            page.items.map((u) => [text(u.id), text(u.displayName) || text(u.email)]),
          ),
        );
      }
    } catch (e) {
      if (generation.current !== started) return;
      setError(e instanceof Error ? e.message : "The activity could not be read.");
    } finally {
      if (generation.current === started) setLoading(false);
    }
  }, [api, id, users]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // A write to this resource is a new line in the trail.
  useFocusEffect(
    useCallback(() => {
      const now = writes[k] ?? 0;
      if (now !== seen.current) {
        seen.current = now;
        void load();
      }
    }, [writes, k, load]),
  );

  const whom = identity?.userId;
  return {
    events,
    names: whom ? { ...names, [whom]: "You" } : names,
    loading,
    error,
    full,
    reload: load,
  };
}
