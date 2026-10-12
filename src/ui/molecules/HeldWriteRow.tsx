// HeldWriteRow is one write this phone is still holding: what it says, when the
// phone last changed it, and the two acts that belong to the person — send it
// again, throw it away. It takes a view model in and calls two functions out;
// it never reads a store, a transport or the shell.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

interface Props {
  /** view is one held write as src/core/outbox.ts says it: no rule lives here. */
  readonly view: {
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly when?: string;
    readonly retry: string;
    readonly discard: string;
    readonly busy: boolean;
  };
  readonly onRetry: (id: string) => void;
  readonly onDiscard: (id: string) => void;
}

export function HeldWriteRow({ view, onRetry, onDiscard }: Props) {
  const s = useStyles(styles);
  return (
    <View
      style={s.row}
      accessible
      accessibilityLabel={[view.title, view.body, view.when].filter(Boolean).join(", ")}
      {...testable(`held-write-${view.id}`)}
    >
      <View style={s.words}>
        <Text weight="semibold">{view.title}</Text>
        <Text role="caption" tone="muted">
          {view.body}
        </Text>
        {view.when ? (
          <Text role="caption" tone="muted" nativeID={`held-write-${view.id}-when`}>
            {view.when}
          </Text>
        ) : null}
      </View>
      <View style={s.acts}>
        <Button
          label={view.retry}
          tone="primary"
          busy={view.busy}
          disabled={view.busy}
          {...(view.busy ? { reason: view.body } : {})}
          onPress={() => onRetry(view.id)}
          testID={`held-write-${view.id}-retry`}
        />
        <Button
          label={view.discard}
          tone="plain"
          disabled={view.busy}
          {...(view.busy ? { reason: view.body } : {})}
          onPress={() => onDiscard(view.id)}
          testID={`held-write-${view.id}-discard`}
        />
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.md,
      paddingVertical: t.space.sm,
    },
    words: { flex: 1, gap: t.space.xs / 2 },
    acts: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
  });
