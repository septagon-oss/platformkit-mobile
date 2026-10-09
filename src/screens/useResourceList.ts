// useResourceList is the list's imperative shell: a window of rows in an
// order, each response tagged with the generation it was asked with so a late
// one cannot overwrite a newer one, and a re-read when this app wrote to the
// resource since the list last looked. A re-read asks for as many rows as are
// shown and replaces them, so a row somebody deleted goes and the place a
// person scrolled to stays.
//
// A refusal is classified, not printed: the verdict decides whether the window
// stays, so a refresh answered 403 takes the rows away and one answered 503
// keeps them under the instant they were last read — which is why the hook
// remembers that instant and formats it in the reader's own words.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { key, type Entry } from "../core/catalog";
import {
  failureSubject,
  instantValue,
  noOrder,
  presentedTime,
  queryFilters,
  type Clock,
  type Formatting,
  type Order,
  type Row,
} from "../core/derive";
import { refusalOf } from "./failure";
import { systemClock } from "./clock";
import { PER_PAGE } from "../effects/api";
import { useShell } from "../shell";

// The API's own ceiling on one request; a list that has grown past it re-reads
// the first pages only, which is what a person has scrolled through anyway.
const MAX_ROWS = 200;

type Why = "first" | "more" | "refresh" | "stale";

export function useResourceList(entry: Entry, format: Formatting, clock: Clock = systemClock) {
  const { api, writes } = useShell();
  const k = key(entry);
  // Strings and a frozen bundle, so they stay stable between renders; the
  // `format` object itself is new every render, and a load keyed by it would
  // re-read the window forever.
  const { copy, locale, timeZone, ownZone } = format;
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<Order>(noOrder);
  const [ordering, setOrdering] = useState(false);
  const generation = useRef(0);
  const shown = useRef(0);
  const seen = useRef(writes[k] ?? 0);
  // The instant of the last window that answered: a refresh names it, and while
  // it is empty there is nothing to name, which is what makes it a first read.
  const read = useRef("");

  const load = useCallback(
    async (why: Why) => {
      const started = ++generation.current;
      const more = why === "more";
      const offset = more ? shown.current : 0;
      const limit =
        why === "stale" ? Math.min(MAX_ROWS, Math.max(PER_PAGE, shown.current)) : PER_PAGE;
      if (why === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const got = await api.list(entry, {
          offset,
          limit,
          sort: order.sort,
          filters: queryFilters(order),
        });
        if (generation.current !== started) return;
        setRows((prev) => {
          const next = more ? [...prev, ...got.items] : got.items;
          shown.current = next.length;
          return next;
        });
        setTotal(got.total);
        setError("");
        read.current = clock.now();
      } catch (e) {
        if (generation.current !== started) return;
        // Rows already shown stay under a failure to get more of them; a read
        // that named no rows, or one the server took away, leaves none.
        const at = instantValue(read.current);
        const lastSeen = at ? presentedTime(at, { locale, timeZone, ownZone }) : "";
        const said = refusalOf(
          e,
          why === "first" ? "read" : "refresh",
          failureSubject(entry, "", lastSeen),
          copy,
        );
        if (said.verdict.outcome === "silent") return;
        if (said.withdraws) {
          setRows([]);
          shown.current = 0;
          setTotal(0);
          // Nothing is on screen to call "the last update" any more.
          read.current = "";
        }
        setError(said.text);
      } finally {
        if (generation.current === started) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api, entry, order, copy, locale, timeZone, ownZone, clock],
  );

  // The first window, and again whenever the order changes.
  useEffect(() => {
    shown.current = 0;
    // The await is spelled out here rather than hidden behind a call, so it is
    // plain that nothing is set during the render this effect runs after.
    void (async () => {
      await load("first");
    })();
  }, [load]);

  // Coming back to a list this app wrote to since: the same rows, read again.
  useFocusEffect(
    useCallback(() => {
      const now = writes[k] ?? 0;
      if (now !== seen.current) {
        seen.current = now;
        void load("stale");
      }
    }, [writes, k, load]),
  );

  const busy = loading || refreshing;
  // Stable, because the screen puts them in the navigator's options.
  const toggleOrdering = useCallback(() => setOrdering((on) => !on), []);
  const refresh = useCallback(() => {
    if (!busy) void load("refresh");
  }, [busy, load]);
  const loadMore = useCallback(() => {
    if (!busy) void load("more");
  }, [busy, load]);

  return {
    rows,
    total,
    error,
    loading,
    refreshing,
    // Nothing is asked for while something is on its way, so a late answer
    // cannot be the one that is dropped.
    more: rows.length < total && !busy,
    order,
    ordering,
    setOrder,
    toggleOrdering,
    refresh,
    loadMore,
  };
}
