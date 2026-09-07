// TagsField is a list of words: each a chip that can go, and a place to add
// one. It speaks to the form in the comma-separated spelling the core already
// splits, so the API contract is untouched.
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { TextField } from "../atoms/TextField";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly testID?: string;
}

export const split = (v: string): string[] =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function TagsField({ label, value, onChange, disabled = false, testID }: Props) {
  const s = useStyles(styles);
  const [draft, setDraft] = useState("");
  const tags = split(value);

  const add = () => {
    const next = split(draft);
    if (next.length === 0) return;
    onChange([...tags, ...next.filter((n) => !tags.includes(n))].join(", "));
    setDraft("");
  };
  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag).join(", "));

  return (
    <View style={s.field} {...(testID ? { testID } : {})}>
      {tags.length > 0 ? (
        <View style={s.chips} accessibilityRole="list">
          {tags.map((tag) => (
            <View key={tag} style={s.chip}>
              <Text role="label">{tag}</Text>
              {disabled ? null : (
                <Pressable
                  onPress={() => remove(tag)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${tag}`}
                  hitSlop={8}
                >
                  <Icon name="close" size="sm" tone="muted" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : null}
      <TextField
        kind="mono"
        value={draft}
        onChangeText={(v) => (v.includes(",") ? (setDraft(v), add()) : setDraft(v))}
        onSubmitEditing={add}
        onBlur={add}
        blurOnSubmit={false}
        placeholder={`Add to ${label.toLowerCase()}`}
        accessibilityLabel={`Add to ${label}`}
        disabled={disabled}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    field: { gap: t.space.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.xs,
      borderRadius: 999,
      paddingLeft: t.space.md,
      paddingRight: t.space.sm,
      paddingVertical: t.space.xs,
      backgroundColor: t.color.surfaceMuted,
    },
  });
