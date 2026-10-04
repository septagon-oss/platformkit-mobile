// SearchField is a query the person can see the effect of: what is typed, a
// mark while the answer is coming, a clear that returns the whole set, and the
// count the query narrowed to. It asks for nothing: debounce, request order and
// the result set are the screen's, exactly as they are for every other control.
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import type { SearchModel } from "../../core/navigation";
import { testable } from "../props";
import { Icon } from "../atoms/Icon";
import { Spinner } from "../atoms/Spinner";
import { Text } from "../atoms/Text";
import { TextField } from "../atoms/TextField";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  readonly model: SearchModel;
  readonly onChangeText: (value: string) => void;
  readonly onSubmit?: () => void;
  /** onClear empties the query and asks for the whole set again. */
  readonly onClear?: () => void;
  readonly testID?: string;
}

export function SearchField({ model, onChangeText, onSubmit, onClear, testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      // The strip is the field's chrome: a tap anywhere in it puts the caret in
      // the text, and hover, focus and the waiting mark are three readings of it.
      onPress={() => input.current?.focus()}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        s.field,
        focused && s.focused,
        hovered && !focused && !model.busy && s.hover,
        model.busy && s.busy,
        pressed && s.press,
      ]}
      {...testable(testID)}
    >
      <Icon name="search" size="sm" tone="muted" />
      <View style={s.input}>
        <TextField
          ref={input}
          kind="search"
          plain
          value={model.value}
          onChangeText={onChangeText}
          // A query that is still being answered owns the next one: while the
          // model is busy the field keeps the caret and the typed text, but a
          // submit asks for nothing, exactly as a busy button asks for nothing.
          onSubmitEditing={model.busy ? undefined : onSubmit}
          accessibilityLabel={model.label}
          placeholder={model.placeholder}
          returnKeyType="search"
          accessibilityRole="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {model.busy ? (
        <Spinner label={model.searching} motion="reduced" />
      ) : model.value.length > 0 && onClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={model.clearLabel}
          hitSlop={t.space.sm}
          {...testable(`${testID ?? "search"}-clear`)}
          style={({ pressed }) => [s.clear, pressed && s.press]}
        >
          <Icon name="close" size="sm" tone="muted" />
        </Pressable>
      ) : null}
      {(model.countText ?? (model.narrowed ? model.searching : undefined)) ? (
        <Text role="caption" tone="muted">
          {model.countText ?? model.searching}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    field: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.sm,
      minHeight: t.hit,
      paddingHorizontal: t.space.md,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.state.outline,
      backgroundColor: t.color.surfacePrimary,
    },
    input: { flex: 1 },
    focused: { borderColor: t.color.focus },
    hover: { backgroundColor: t.state.hovered },
    busy: { backgroundColor: t.color.surfaceMuted },
    press: { backgroundColor: t.state.pressed },
    clear: { padding: t.space.xs, borderRadius: t.radius.full },
  });
