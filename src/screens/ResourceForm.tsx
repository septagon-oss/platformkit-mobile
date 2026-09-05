// ResourceForm is the create and edit screen: one control per writable field,
// derived from the schema, the refusal on the control it is about, and Save
// posting exactly what the API takes.
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formControls, humanize, screenPath, text, values, type Row } from "../core/derive";
import { ApiError } from "../effects/api";
import type { ScreenProps } from "../renderers";
import { useShell } from "../shell";
import { ControlView } from "./controls";
import { color, font, radius, space } from "./theme";

export function ResourceForm({ entry, id }: ScreenProps) {
  const { api } = useShell();
  const router = useRouter();
  const create = !id;
  const [row, setRow] = useState<Row | undefined>();
  const [held, setHeld] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const at = screenPath(entry);

  useEffect(() => {
    if (!id) return;
    api
      .get(entry, id)
      .then(setRow)
      .catch((e: unknown) =>
        setDetail(e instanceof Error ? e.message : "This record could not be read."),
      );
  }, [api, entry, id]);

  const controls = useMemo(() => formControls(entry, row, create), [entry, row, create]);
  const current = (name: string, fallback: string) => held[name] ?? fallback;

  const save = async () => {
    setBusy(true);
    setDetail("");
    try {
      const body = values(controls, held);
      const saved = id ? await api.update(entry, id, body) : await api.create(entry, body);
      router.replace(`${at}/${encodeURIComponent(text(saved.id))}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setDetail(e.detail || "That could not be saved.");
      } else {
        setDetail(e instanceof Error ? e.message : "That could not be saved.");
      }
    } finally {
      setBusy(false);
    }
  };

  const title = (create ? "New " : "Edit ") + entry.entity;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {detail ? (
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>That could not be saved</Text>
          <Text style={styles.alertText}>{detail}</Text>
        </View>
      ) : null}
      {controls.map((c) => (
        <ControlView
          key={c.field.name}
          control={c}
          value={current(c.field.name, c.value)}
          {...(errors[c.field.name] ? { error: errors[c.field.name] } : {})}
          onChange={(v) => setHeld((h) => ({ ...h, [c.field.name]: v }))}
        />
      ))}
      <View style={styles.actions}>
        <Pressable
          style={styles.secondary}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.button, busy && styles.busy]}
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{busy ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
      <Text style={styles.footnote}>
        {humanize(entry.entity)} in {entry.module}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space.lg },
  title: { fontSize: font.xl, fontWeight: "700", color: color.text, marginBottom: space.lg },
  alert: {
    backgroundColor: color.dangerBg,
    padding: space.md,
    borderRadius: radius.md,
    marginBottom: space.lg,
  },
  alertTitle: { color: color.danger, fontWeight: "600" },
  alertText: { color: color.danger },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm, marginTop: space.sm },
  button: {
    backgroundColor: color.accent,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  busy: { opacity: 0.6 },
  buttonText: { color: color.accentOn, fontWeight: "600" },
  secondary: {
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  secondaryText: { color: color.text, fontWeight: "600" },
  footnote: { color: color.textMuted, fontSize: font.xs, marginTop: space.xl },
});
