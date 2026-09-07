// TagsField is a list of words: each a chip that can go, and a place to add
// one. What is typed but not yet committed is part of the value, not state of
// its own, so a save that never blurred the input still carries it. The
// spelling is the comma-separated one the core splits, so the API contract is
// untouched.
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { splitList } from "../../core/derive";
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

export function TagsField({ label, value, onChange, disabled = false, testID }: Props) {
  const s = useStyles(styles);
  // What is being typed is held here and written into the value on every
  // keystroke, so a save that never blurred the input still carries it. The
  // chips are whatever the value holds beyond that draft, which means a record
  // as the server has it arrives as chips and nothing half-typed.
  const [draft, setDraft] = useState("");
  const base = value.endsWith(draft) ? value.slice(0, value.length - draft.length) : value;
  const tags = splitList(base);

  const write = (next: readonly string[], typing: string) => {
    setDraft(typing);
    onChange(next.length > 0 ? `${next.join(", ")}, ${typing}` : typing);
  };

  return (
    <View style={s.field} {...(testID ? { testID } : {})}>
      {tags.length > 0 ? (
        <View style={s.chips} accessibilityRole="list">
          {tags.map((tag) => (
            <View key={tag} style={s.chip}>
              <Text role="label">{tag}</Text>
              {disabled ? null : (
                <Pressable
                  onPress={() =>
                    write(
                      tags.filter((x) => x !== tag),
                      draft,
                    )
                  }
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
        onChangeText={(typed) => write(tags, typed)}
        blurOnSubmit={false}
        placeholder={`Add to ${label.toLowerCase()}`}
        accessibilityLabel={`Add to ${label}`}
        disabled={disabled}
        returnKeyType="done"
        testID={`tags-${label.toLowerCase()}`}
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
