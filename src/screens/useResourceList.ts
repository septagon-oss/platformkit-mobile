// useResourceList is the list's imperative shell: a window of rows in an
// order, each response tagged with the generation it was asked with so a late
// one cannot overwrite a newer one, and a re-read when this app wrote to the
// resource since the list last looked. A re-read asks for as many rows as are
// shown and replaces them, so a row somebody deleted goes and the place a
// person scrolled to stays.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { key, type Entry } from "../core/catalog";
import { noOrder, queryFilters, type Order, type Row } from "../core/derive";
import { PER_PAGE } from "../effects/api";
import { useShell } from "../shell";

// The API's own ceiling on one request; a list that has grown past it re-reads
// the first pages only, which is what a person has scrolled through anyway.
const MAX_ROWS = 200;

type Why = "first" | "more" | "refresh" | "stale";

export function useResourceList(entry: Entry) {
  const { api, writes } = useShell();
  const k = key(entry);
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
      } catch (e) {
        if (generation.current !== started) return;
        setError(e instanceof Error ? e.message : "The list could not be read.");
      } finally {
        if (generation.current === started) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api, entry, order],
  );

  // The first window, and again whenever the order changes.
  useEffect(() => {
    shown.current = 0;
    void load("first");
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
    toggleOrdering: () => setOrdering((on) => !on),
    refresh: () => !busy && void load("refresh"),
    loadMore: () => !busy && void load("more"),
  };
}
