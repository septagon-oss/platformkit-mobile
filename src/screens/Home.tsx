// Home is what there is: one row per resource the caller may reach, which is
// the dashboard's cards without the counts.
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Entry } from "../core/catalog";
import { humanize, screenPath } from "../core/derive";
import { color, font, radius, space } from "./theme";

interface Props {
  readonly entries: readonly Entry[];
  readonly onOpen: (path: string) => void;
  readonly onSignOut: () => void;
  readonly onRefresh: () => void;
}

export function Home({ entries, onOpen, onSignOut, onRefresh }: Props) {
  return (
    <View style={styles.page}>
      <View style={styles.bar}>
        <Text style={styles.title}>PlatformKit</Text>
        <View style={styles.actions}>
          <Pressable onPress={onRefresh} accessibilityRole="button">
            <Text style={styles.link}>Refresh</Text>
          </Pressable>
          <Pressable onPress={onSignOut} accessibilityRole="button">
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(e) => `${e.module}/${e.entity}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nothing you may reach here yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => onOpen(screenPath(item))}
            accessibilityRole="link"
          >
            <Text style={styles.cardTitle}>{humanize(item.entity)}s</Text>
            <Text style={styles.cardSub}>
              In {item.module}
              {item.writable ? "" : " · read only"}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
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
  actions: { flexDirection: "row", gap: space.lg },
  title: { fontSize: font.lg, fontWeight: "700", color: color.text },
  link: { color: color.accent, fontWeight: "600" },
  list: { padding: space.lg, gap: space.md },
  empty: { color: color.textMuted, textAlign: "center", padding: space.xl },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  cardTitle: { fontSize: font.md, fontWeight: "600", color: color.text },
  cardSub: { fontSize: font.sm, color: color.textMuted, marginTop: space.xs },
});
