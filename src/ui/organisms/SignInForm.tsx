// SignInForm is the way in: where the server is, then who you are. Two
// distinct failures are offered two distinct ways out: a server that could
// not be reached is retried; a saved sign-in that could not be read is
// cleared. Before the form is wanted it shows the shell's two other states in
// the same frame: a saved sign-in being restored, and one that could not be
// opened, so a product need not draw those screens itself.
import type { Feedback } from "../../core/derive";
import type { Remembered, Workspace } from "../../core/workspace";
import React, { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../atoms/Button";
import { Notice, retry } from "../atoms/Notice";
import { Spinner } from "../atoms/Spinner";
import { Text } from "../atoms/Text";
import { TextField } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";
import { Row } from "../molecules/Row";
import { Section } from "../molecules/Section";
import { ServerField } from "../molecules/ServerField";
import { testable } from "../props";
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
  readonly step?: "address" | "credentials" | "code";
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
  /**
   * workspace is the face of the place this password is offered at: the name to say over the
   * fields and the host to say under it. The screen resolves the name — the workspace's own
   * word, the address, or the copy table's word for a workspace — so the form and the header
   * can never call the same place two things. Absent is a form with nothing to say about
   * the place yet — no line and no way back to the address.
   */
  readonly workspace?: { readonly name: string; readonly host: string } | undefined;
  /**
   * mark is the workspace's own image, built by the composition that owns an image view;
   * this frame only says where it sits. Absent — or a mark that never arrived — is no image.
   */
  readonly mark?: ReactNode;
  /**
   * remembered are the workspaces this device has been pointed at, newest first. Absent is
   * a build with no table for them; an empty list is a person who has connected nowhere.
   */
  readonly remembered?: readonly Remembered[] | undefined;
  /** connecting says the address the person typed is being asked what it is. */
  readonly connecting?: boolean;
  /**
   * onContinue asks what the workspace at an address is, and onContinue's answer decides
   * whether the password is asked there. The address goes as it was typed.
   */
  readonly onContinue?: (baseURL: string) => void;
  /** onEditAddress goes back from the workspace's face to the address, with what was typed kept. */
  readonly onEditAddress?: () => void;
}

/**
 * slug is an address turned into the safe half of a testID: a remembered row is named for
 * the host it points at, so a test can reach one workspace without knowing the others.
 */
const slug = (server: string): string =>
  server
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

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
  workspace,
  mark,
  remembered,
  connecting = false,
  onContinue,
  onEditAddress,
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
   * types and taps in one gesture submits what they typed. The frame a form draws
   * writes this object too, so the values it shows without being asked for — a
   * returning person's address, the server's own address — and a code the caller
   * takes back (a refusal empties the field) are held the same way as a value
   * that was typed: what a control sends is what the person saw. ActionControl
   * keeps its current model the same way.
   */
  const typed = useRef({ url: "", email: "", password: "", code: "" });
  useLayoutEffect(() => {
    typed.current.url = url;
    typed.current.email = email;
    typed.current.password = password;
    typed.current.code = code;
  }, [url, email, password, code]);
  const submit = () => {
    if (!busy)
      onSubmit(typed.current.url.trim(), typed.current.email.trim(), typed.current.password);
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
  if (step === "address") {
    // One door for both ways onto an address: typed in the field or remembered on the list.
    // The value is written where a pressed control reads it, so the address the lookup asks
    // about is the one the person saw, not the one before they typed.
    const go = (server: string) => {
      typed.current.url = server;
      setURL(server);
      onContinue?.(server);
    };
    return (
      <Screen form testID="sign-in">
        {head(kit.connectTitle, kit.connectIntro)}
        {remembered === undefined || remembered.length === 0 ? null : (
          <Section title={kit.rememberedWorkspaces} testID="sign-in-remembered">
            {remembered.map((entry) => (
              <Row
                key={entry.host}
                title={entry.name}
                summary={entry.host}
                opens
                onPress={() => go(entry.host)}
                testID={`workspace-remembered-${slug(entry.host)}`}
              />
            ))}
          </Section>
        )}
        <Section>
          <ServerField
            caption={kit.workspaceAddress}
            value={url}
            onChange={(v) => {
              typed.current.url = v;
              setURL(v);
            }}
            disabled={busy || connecting}
          />
        </Section>
        <Button
          label={connecting ? kit.checking : kit.continueLabel}
          onPress={() => go(typed.current.url.trim())}
          busy={connecting}
          testID="continue"
        />
      </Screen>
    );
  }
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
      <View style={s.here}>
        {mark ? (
          <View style={s.mark} {...testable("workspace-mark")}>
            {mark}
          </View>
        ) : null}
        {workspace ? (
          <View style={s.named}>
            {/* The name the workspace used for itself, and the address under it: a person
              aims at a place they recognise, and can still tell which one this is. */}
            <Text role="title" numberOfLines={1} testID="workspace-name">
              {workspace.name}
            </Text>
            {workspace.host === "" ? null : (
              <Text role="caption" tone="muted" numberOfLines={1} testID="workspace-host">
                {workspace.host}
              </Text>
            )}
          </View>
        ) : null}
        <Button
          label={kit.changeWorkspace}
          tone="secondary"
          onPress={() => onEditAddress?.()}
          testID="change-workspace"
        />
      </View>
      <Section>
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
    here: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.sm,
      paddingVertical: t.space.sm,
    },
    named: { flexShrink: 1, flexGrow: 1, gap: t.space.xs },
    mark: {
      width: t.extent.avatar,
      height: t.extent.avatar,
      borderRadius: t.radius.md,
      overflow: "hidden",
    },
  });
