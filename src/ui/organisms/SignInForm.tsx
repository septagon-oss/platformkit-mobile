// SignInForm is the way in: where the server is, then who you are. Two
// distinct failures are offered two distinct ways out: a server that could
// not be reached is retried; a saved sign-in that could not be read is
// cleared. Before the form is wanted it shows the shell's two other states in
// the same frame: a saved sign-in being restored, and one that could not be
// opened, so a product need not draw those screens itself.
import type { Feedback } from "../../core/derive";
import React, { useLayoutEffect, useRef, useState } from "react";
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
  readonly feedback: Feedback;
  readonly baseURL: string;
  /** notice is the shell's own message, about a saved sign-in that could not be read or cleared. */
  readonly notice: string;
  readonly busy: boolean;
  /** error is what the last attempt answered. */
  readonly error: string;
  readonly onSubmit: (baseURL: string, email: string, password: string) => void;
  readonly onClear: () => void;
  /**
   * step is where the person is: their password, or the code the server asked
   * about. It is a step of this one form, not a state of the session — the
   * window a challenge opens is the server's five minutes, and the phone keeps
   * no copy of it.
   */
  readonly step?: "credentials" | "code";
  /** code is what is typed now, held by the caller so a refusal can empty the field. */
  readonly code?: string;
  readonly onCodeChange?: (code: string) => void;
  readonly onSubmitCode?: (code: string) => void;
  /** onEditCredentials goes back to the password, the only way to open another challenge. */
  readonly onEditCredentials?: () => void;
  /** title is the word over the form: the product's name, or "Sign in" when it has none to say. */
  readonly title?: string;
  /** booting says a saved sign-in is being restored: the form waits behind a spinner rather than asking again. */
  readonly booting?: boolean;
  /** failed is why a saved sign-in could not be opened; it is offered a retry and a way to another server. */
  readonly failed?: string;
  /** expired is the line for a session the server refused while it was in use: this person is
   * not signing in here, they are signing back in, and nothing about the form asks them to
   * start over. It carries no action, because signing in is what the form below does. */
  readonly expired?: string;
  /** initialEmail is who that session belonged to, so the address is not asked for twice. */
  readonly initialEmail?: string;
  readonly onRetry?: () => void;
}

export function SignInForm({
  feedback,
  baseURL,
  notice,
  busy,
  error,
  onSubmit,
  onClear,
  title = "Sign in",
  booting = false,
  failed = "",
  expired = "",
  initialEmail = "",
  onRetry,
  step = "credentials",
  code = "",
  onCodeChange,
  onSubmitCode,
  onEditCredentials,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const insets = useSafeAreaInsets();
  const kit = feedback.copy.kit;
  const [enteredURL, setURL] = useState<string>();
  const url = enteredURL ?? baseURL;
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  /**
   * typed is what each field holds the moment a control is pressed. A pressed
   * control is handed the callback from the render the person saw, so a value
   * read from that closure is the value from before they typed: each field's own
   * handler writes this object and each control reads it back, so a person who
   * types and taps in one gesture submits what they typed. A code the caller
   * takes back — a refusal empties the field — is reconciled in the frame the
   * form draws it empty, the way ActionControl keeps its current model.
   */
  const typed = useRef({ url: "", email: "", password: "", code: "" });
  useLayoutEffect(() => {
    typed.current.code = code;
  }, [code]);
  const submit = () => {
    if (!busy)
      onSubmit(
        (typed.current.url || url).trim(),
        typed.current.email.trim(),
        typed.current.password,
      );
  };
  const head = (heading: string, text: string) => (
    <View style={[s.head, { paddingTop: insets.top + t.space.xl }]}>
      <Text role="display">{heading}</Text>
      <Text tone="muted">{text}</Text>
    </View>
  );
  if (booting)
    return (
      <Screen testID="sign-in-booting">
        {head(title, "Restoring your saved sign-in…")}
        <Spinner label={feedback.loadingLabel} motion={feedback.motion} size="large" />
      </Screen>
    );
  if (failed)
    return (
      <Screen testID="sign-in-failed">
        {head(title, "Your saved sign-in could not be opened.")}
        <Notice
          announcement="urgent"
          text={failed}
          {...(onRetry ? { action: retry(feedback, onRetry) } : {})}
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
  if (step === "code") {
    const sendCode = () => {
      if (!busy) onSubmitCode?.(typed.current.code);
    };
    return (
      <Screen form testID="challenge">
        {head(kit.confirmItIsYou, kit.codePrompt)}
        {error ? (
          <Notice
            announcement="urgent"
            text={error}
            // Built here rather than by retry(feedback, sendCode): the control
            // that re-sends must read the field as it is pressed, and a call
            // during render may not hand a ref-reading callback to a helper.
            action={{ label: feedback.retryLabel, onPress: () => sendCode() }}
            testID="challenge-error"
          />
        ) : null}
        <Section>
          <FormField label={kit.code}>
            <TextField
              // A recovery code is not six digits, so the field stays text: a
              // number pad would close the door a person whose authenticator is
              // dead comes through. The only rules are the document's own
              // maxLength and the server's trim.
              kind="text"
              value={code}
              onChangeText={(v) => {
                typed.current.code = v;
                onCodeChange?.(v);
              }}
              maxLength={40}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              accessibilityLabel={kit.code}
              disabled={busy}
              onSubmitEditing={sendCode}
              returnKeyType="go"
              testID="code"
            />
          </FormField>
        </Section>
        <Button
          label={busy ? kit.checking : kit.checkCode}
          onPress={sendCode}
          busy={busy}
          testID="verify"
        />
        <Button
          label={kit.backToPassword}
          tone="secondary"
          onPress={() => onEditCredentials?.()}
          testID="back-to-password"
        />
      </Screen>
    );
  }
  return (
    <Screen form testID="sign-in">
      {head(title, feedback.copy.kit.signInIntro)}
      {error ? (
        <Notice
          announcement="urgent"
          text={error}
          action={{ label: feedback.retryLabel, onPress: () => submit() }}
          testID="sign-in-error"
        />
      ) : null}
      {expired ? (
        <Notice announcement="polite" tone="warning" text={expired} testID="sign-in-expired" />
      ) : null}
      {notice ? (
        <Notice
          announcement="polite"
          tone="warning"
          text={notice}
          action={{ label: "Clear saved sign-in", onPress: onClear }}
          testID="sign-in-notice"
        />
      ) : null}
      <Section>
        <ServerField
          caption={feedback.copy.kit.workspaceAddress}
          value={url}
          onChange={(v) => {
            typed.current.url = v;
            setURL(v);
          }}
          disabled={busy}
        />
        <FormField label="Email">
          <TextField
            kind="email"
            value={email}
            onChangeText={(v) => {
              typed.current.email = v;
              setEmail(v);
            }}
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
            onChangeText={(v) => {
              typed.current.password = v;
              setPassword(v);
            }}
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
