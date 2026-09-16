// ServerField is where the server is: a row that names it and lets it be
// changed, the way a self-hosted product asks for its host before it asks who
// you are.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { TextField } from "../atoms/TextField";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  /** testID names the field; the input inside it is always "server", which the sign-in flow types into. */
  readonly testID?: string;
}

export function ServerField({ value, onChange, disabled = false, testID }: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.field} {...testable(testID)}>
      <View style={s.head}>
        <Icon name="server" size="sm" tone="muted" />
        <Text role="caption" tone="muted" weight="semibold">
          Server
        </Text>
      </View>
      <TextField
        kind="url"
        value={value}
        onChangeText={onChange}
        placeholder="https://acme.example.com"
        accessibilityLabel="Server"
        textContentType="URL"
        disabled={disabled}
        testID="server"
      />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    field: { gap: t.space.xs, paddingVertical: t.space.sm },
    head: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
  });
