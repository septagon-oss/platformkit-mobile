// ResourceDetail is one row: every field, in schema order, and the two write
// affordances for a caller who may.
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { detailItems, label, screenPath, type Row } from "../core/derive";
import type { ScreenProps } from "../renderers";
import { useShell } from "../shell";
import { color, font, radius, space } from "./theme";

export function ResourceDetail({ entry, id }: ScreenProps) {
  const { api } = useShell();
  const router = useRouter();
  const [row, setRow] = useState<Row | undefined>();
  const [error, setError] = useState("");
  const at = screenPath(entry);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setRow(await api.get(entry, id));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This record could not be read.");
    }
  }, [api, entry, id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = () => {
    if (!id) return;
    Alert.alert("Are you sure?", `This deletes the ${entry.entity}. It cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.remove(entry, id);
            router.replace(at);
          } catch (e) {
            setError(e instanceof Error ? e.message : "That could not be deleted.");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{row ? label(entry, row) : "…"}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {entry.writable && id ? (
        <View style={styles.actions}>
          <Pressable
            style={styles.button}
            onPress={() => router.push(`${at}/${encodeURIComponent(id)}/edit`)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.danger]}
            onPress={remove}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Delete</Text>
          </Pressable>
        </View>
      ) : null}
      {row ? (
        <View style={styles.list}>
          {detailItems(entry, row).map((item) => (
            <View key={item.label} style={styles.item}>
              <Text style={styles.term}>{item.label}</Text>
              <Text style={styles.value}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space.lg, gap: space.lg },
  title: { fontSize: font.xl, fontWeight: "700", color: color.text },
  error: {
    color: color.danger,
    backgroundColor: color.dangerBg,
    padding: space.md,
    borderRadius: radius.md,
  },
  actions: { flexDirection: "row", gap: space.sm },
  button: {
    backgroundColor: color.accent,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  danger: { backgroundColor: color.danger },
  buttonText: { color: color.accentOn, fontWeight: "600" },
  list: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  item: { padding: space.md, borderBottomWidth: 1, borderColor: color.border, gap: space.xs },
  term: { fontSize: font.xs, color: color.textMuted, textTransform: "uppercase" },
  value: { fontSize: font.md, color: color.text },
});
