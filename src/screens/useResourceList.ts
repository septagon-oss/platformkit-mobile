// useResourceList is the list's imperative shell: pages from the API in an
// order, each response tagged with the generation it was asked with so a late
// one cannot overwrite a newer one, and a reload when this app wrote to the
// resource since the list last read it, done in place so the pages already
// loaded and the scroll position survive.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { key, type Entry } from "../core/catalog";
import { mergePage, type Row } from "../core/derive";
import { noOrder, queryFilters, type Order } from "../ui/organisms/ResourceList";
import { useShell } from "../shell";

type Why = "first" | "more" | "refresh" | "stale";

export function useResourceList(entry: Entry) {
  const { api, writes } = useShell();
  const k = key(entry);
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<Order>(noOrder);
  const [ordering, setOrdering] = useState(false);
  const generation = useRef(0);
  const seen = useRef(writes[k] ?? 0);

  const load = useCallback(
    async (p: number, why: Why) => {
      const started = ++generation.current;
      if (why === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const got = await api.list(entry, p, order.sort, queryFilters(order));
        if (generation.current !== started) return;
        setRows((prev) =>
          p > 1
            ? [...prev, ...got.items]
            : why === "stale"
              ? mergePage(got.items, prev)
              : got.items,
        );
        setTotal(got.total);
        setPage(p);
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

  // The first page, and again whenever the order changes.
  useEffect(() => {
    void load(1, "first");
  }, [load]);

  // Coming back to a list this app wrote to since: the first page again, in place.
  useFocusEffect(
    useCallback(() => {
      const now = writes[k] ?? 0;
      if (now !== seen.current) {
        seen.current = now;
        void load(1, "stale");
      }
    }, [writes, k, load]),
  );

  return {
    rows,
    total,
    error,
    loading,
    refreshing,
    more: rows.length < total && !loading,
    order,
    ordering,
    setOrder,
    toggleOrdering: () => setOrdering((on) => !on),
    refresh: () => load(1, "refresh"),
    loadMore: () => load(page + 1, "more"),
  };
}
