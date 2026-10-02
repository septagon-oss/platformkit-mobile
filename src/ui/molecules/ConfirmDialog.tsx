// ConfirmDialog is the one place a refusal of a destructive write is said in
// the user's own terms: what will be lost, why it cannot be undone, the verb
// that does it, and a cancel that keeps the screen where it was. It is a
// decision surface, not a detail surface: DetailSheet stays for the record.
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import type { Motion } from "../../core/derive";
import { testable } from "../props";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly open: boolean;
  readonly title: string;
  readonly body: string;
  /** reason is why this write is refused or what it takes away; the rule itself, not a tone. */
  readonly reason?: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly tone?: "primary" | "destructive";
  readonly busy?: boolean;
  /** motion decides whether the sheet slides in or simply appears. */
  readonly motion?: Motion;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly testID?: string;
}

export function ConfirmDialog({
  open,
  title,
  body,
  reason,
  confirm,
  cancel,
  tone = "primary",
  busy = false,
  motion = "reduced",
  onConfirm,
  onCancel,
  testID,
}: Props) {
  const s = useStyles(styles);
  if (!open) return null;
  // A busy dialog cannot be cancelled by any route: the Button is off, and the
  // backdrop and the platform's back gesture are the same cancel written twice,
  // so they consult the same answer rather than each hoping the other checked.
  const stay = () => {
    if (!busy) onCancel();
  };
  return (
    <Modal
      visible
      transparent
      animationType={motion === "normal" ? "fade" : "none"}
      onRequestClose={stay}
      statusBarTranslucent
      testID={testID}
    >
      <Pressable
        style={s.backdrop}
        onPress={stay}
        accessible={false}
        accessibilityViewIsModal
        {...testable(testID ? `${testID}-backdrop` : undefined)}
      >
        <View
          {...testable(testID ? `${testID}-card` : undefined)}
          style={s.card}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={[title, body, reason].filter(Boolean).join(". ")}
          onStartShouldSetResponder={() => true}
        >
          <Text role="title">{title}</Text>
          <Text tone="muted">{body}</Text>
          {reason ? (
            <Text role="label" tone="danger">
              {reason}
            </Text>
          ) : null}
          <View style={s.actions}>
            <Button
              label={cancel}
              tone="secondary"
              onPress={stay}
              busy={busy}
              {...testable(testID ? `${testID}-cancel` : undefined)}
            />
            <Button
              label={confirm}
              tone={tone === "destructive" ? "destructive" : "primary"}
              onPress={onConfirm}
              busy={busy}
              {...(reason ? { hint: reason } : {})}
              {...testable(testID ? `${testID}-confirm` : undefined)}
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: t.space.lg,
      backgroundColor: t.state.scrim,
    },
    card: {
      width: "100%",
      maxWidth: t.extent.panel,
      gap: t.space.sm,
      padding: t.space.lg,
      borderRadius: t.radius.xl,
      backgroundColor: t.color.surfacePrimary,
      borderWidth: 1,
      borderColor: t.state.divider,
      ...t.state.raised,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: t.space.sm,
      paddingTop: t.space.sm,
    },
  });
