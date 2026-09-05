// ResourceList is the generated list: the row's name, then up to three of the
// columns the schema does not hide, a page at a time. The New button is drawn
// only when the caller may write — a person who may not is not offered a form
// that would refuse them.
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { display, humanize, label, listColumns, screenPath, text, type Row } from "../core/derive";
import { PER_PAGE } from "../effects/api";
import type { ScreenProps } from "../renderers";
import { useShell } from "../shell";
import { color, font, radius, space } from "./theme";

export function ResourceList({ entry }: ScreenProps) {
  const { api } = useShell();
  const router = useRouter();
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const columns = listColumns(entry).slice(1, 4);
  const at = screenPath(entry);

  const load = useCallback(
    async (p: number) => {
      setBusy(true);
      try {
        const got = await api.list(entry, p, "");
        setRows((prev) => (p === 1 ? got.items : [...prev, ...got.items]));
        setTotal(got.total);
        setPage(p);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "The list could not be read.");
      } finally {
        setBusy(false);
      }
    },
    [api, entry],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const more = rows.length < total && !busy;
  const title = humanize(entry.entity) + "s";
  return (
    <View style={styles.page}>
      <View style={styles.bar}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{plural(total, entry.entity)}</Text>
        </View>
        {entry.writable ? (
          <Pressable
            style={styles.button}
            onPress={() => router.push(`${at}/new`)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>New {entry.entity}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => text(r.id)}
        contentContainerStyle={styles.list}
        refreshing={busy && page === 1}
        onRefresh={() => load(1)}
        onEndReached={() => more && load(page + 1)}
        ListEmptyComponent={busy ? null : <Text style={styles.empty}>No {entry.entity}s yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`${at}/${encodeURIComponent(text(item.id))}`)}
            accessibilityRole="link"
          >
            <Text style={styles.name}>{label(entry, item)}</Text>
            <Text style={styles.cells}>
              {columns.map((f) => `${humanize(f.name)}: ${display(f, item[f.name])}`).join(" · ")}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          more ? (
            <Pressable
              style={styles.more}
              onPress={() => load(page + 1)}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Load {Math.min(PER_PAGE, total - rows.length)} more</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

function plural(total: number, noun: string): string {
  return total === 1 ? `1 ${noun}` : `${total} ${noun}s`;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: space.lg,
    borderBottomWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  title: { fontSize: font.lg, fontWeight: "700", color: color.text },
  sub: { fontSize: font.sm, color: color.textMuted },
  button: {
    backgroundColor: color.accent,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  buttonText: { color: color.accentOn, fontWeight: "600" },
  error: {
    color: color.danger,
    backgroundColor: color.dangerBg,
    padding: space.md,
    margin: space.lg,
    borderRadius: radius.md,
  },
  list: { padding: space.lg, gap: space.sm },
  empty: { color: color.textMuted, textAlign: "center", padding: space.xl },
  row: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  name: { fontSize: font.md, fontWeight: "600", color: color.text },
  cells: { fontSize: font.xs, color: color.textMuted, marginTop: space.xs },
  more: { alignItems: "center", padding: space.md },
  link: { color: color.accent, fontWeight: "600" },
});
