// SignInForm is the way in: where the server is, then who you are. Two
// distinct failures are offered two distinct ways out: a server that could
// not be reached is retried; a saved sign-in that could not be read is
// cleared.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { TextField } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";
import { Section } from "../molecules/Section";
import { ServerField } from "../molecules/ServerField";
import { Screen } from "../templates/Screen";
import { useStyles, type Theme } from "../theme";

export interface Props {
  readonly baseURL: string;
  /** notice is the shell's own message, about a saved sign-in that could not be read or cleared. */
  readonly notice: string;
  readonly busy: boolean;
  /** error is what the last attempt answered. */
  readonly error: string;
  readonly onSubmit: (baseURL: string, email: string, password: string) => void;
  readonly onClear: () => void;
}

export function SignInForm({ baseURL, notice, busy, error, onSubmit, onClear }: Props) {
  const s = useStyles(styles);
  const insets = useSafeAreaInsets();
  const [enteredURL, setURL] = useState<string>();
  const url = enteredURL ?? baseURL;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = () => {
    if (!busy) onSubmit(url.trim(), email.trim(), password);
  };
  return (
    <Screen form testID="sign-in">
      <View style={[s.head, { paddingTop: insets.top + 24 }]}>
        <Text role="display">Sign in</Text>
        <Text tone="muted">Use the address this tenant knows you by.</Text>
      </View>
      {error ? (
        <Notice text={error} action={{ label: "Retry", onPress: submit }} testID="sign-in-error" />
      ) : null}
      {notice ? (
        <Notice
          tone="warning"
          text={notice}
          action={{ label: "Clear saved sign-in", onPress: onClear }}
          testID="sign-in-notice"
        />
      ) : null}
      <Section>
        <ServerField value={url} onChange={setURL} disabled={busy} />
        <FormField label="Email">
          <TextField
            kind="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoComplete="username"
            textContentType="username"
            accessibilityLabel="Email"
            disabled={busy}
            returnKeyType="next"
            testID="email"
          />
        </FormField>
        <FormField label="Password">
          <TextField
            kind="password"
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel="Password"
            disabled={busy}
            onSubmitEditing={submit}
            returnKeyType="go"
            testID="password"
          />
        </FormField>
      </Section>
      <Button
        label={busy ? "Signing in…" : "Sign in"}
        onPress={submit}
        busy={busy}
        testID="submit"
      />
    </Screen>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    head: { gap: t.space.xs, paddingBottom: t.space.sm },
  });
