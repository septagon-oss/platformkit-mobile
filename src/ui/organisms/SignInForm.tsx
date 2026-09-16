// SignInForm is the way in: where the server is, then who you are. Two
// distinct failures are offered two distinct ways out: a server that could
// not be reached is retried; a saved sign-in that could not be read is
// cleared. Before the form is wanted it shows the shell's two other states in
// the same frame: a saved sign-in being restored, and one that could not be
// opened, so a product need not draw those screens itself.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../atoms/Button";
import { Notice, retry } from "../atoms/Notice";
import { Spinner } from "../atoms/Spinner";
import { Text } from "../atoms/Text";
import { TextField } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";
import { Section } from "../molecules/Section";
import { ServerField } from "../molecules/ServerField";
import { Screen } from "../templates/Screen";
import { useStyles, useTheme, type Theme } from "../theme";

export interface Props {
  readonly baseURL: string;
  /** notice is the shell's own message, about a saved sign-in that could not be read or cleared. */
  readonly notice: string;
  readonly busy: boolean;
  /** error is what the last attempt answered. */
  readonly error: string;
  readonly onSubmit: (baseURL: string, email: string, password: string) => void;
  readonly onClear: () => void;
  /** title is the word over the form: the product's name, or "Sign in" when it has none to say. */
  readonly title?: string;
  /** booting says a saved sign-in is being restored: the form waits behind a spinner rather than asking again. */
  readonly booting?: boolean;
  /** failed is why a saved sign-in could not be opened; it is offered a retry and a way to another server. */
  readonly failed?: string;
  readonly onRetry?: () => void;
}

export function SignInForm({
  baseURL,
  notice,
  busy,
  error,
  onSubmit,
  onClear,
  title = "Sign in",
  booting = false,
  failed = "",
  onRetry,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const insets = useSafeAreaInsets();
  const [enteredURL, setURL] = useState<string>();
  const url = enteredURL ?? baseURL;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = () => {
    if (!busy) onSubmit(url.trim(), email.trim(), password);
  };
  const head = (text: string) => (
    <View style={[s.head, { paddingTop: insets.top + t.space.xl }]}>
      <Text role="display">{title}</Text>
      <Text tone="muted">{text}</Text>
    </View>
  );
  if (booting)
    return (
      <Screen testID="sign-in-booting">
        {head("Restoring your saved sign-in…")}
        <Spinner size="large" />
      </Screen>
    );
  if (failed)
    return (
      <Screen testID="sign-in-failed">
        {head("Your saved sign-in could not be opened.")}
        <Notice
          text={failed}
          {...(onRetry ? { action: retry(onRetry) } : {})}
          testID="sign-in-failed-notice"
        />
        <Button
          label="Sign in to another server"
          tone="secondary"
          onPress={onClear}
          testID="sign-in-elsewhere"
        />
      </Screen>
    );
  return (
    <Screen form testID="sign-in">
      {head("Use the address this tenant knows you by.")}
      {error ? <Notice text={error} action={retry(submit)} testID="sign-in-error" /> : null}
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
