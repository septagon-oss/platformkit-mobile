// SignIn is the way in: where the server is, and the two things it asks for.
// It posts to the auth module's own route through the shell; there is no second
// way to mint a session.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { color, font, radius, space } from "./theme";

interface Props {
  readonly baseURL: string;
  readonly notice: string;
  readonly onClear: () => Promise<void>;
  readonly onSignIn: (baseURL: string, email: string, password: string) => Promise<void>;
}

export function SignIn({ baseURL, onSignIn, notice, onClear }: Props) {
  const [enteredURL, setURL] = useState<string>();
  const url = enteredURL ?? baseURL;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSignIn(url.trim(), email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Those credentials are not right.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.sub}>Use the address this tenant knows you by.</Text>
      {error || notice ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error || notice}
        </Text>
      ) : null}
      {notice ? (
        <Pressable style={styles.button} onPress={onClear} accessibilityRole="button">
          <Text style={styles.buttonText}>Clear saved sign-in</Text>
        </Pressable>
      ) : null}
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setURL}
        placeholder="https://acme.example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel="Server"
      />
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="username"
        keyboardType="email-address"
        accessibilityLabel="Email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoComplete="current-password"
        accessibilityLabel="Password"
        onSubmitEditing={submit}
      />
      <Pressable
        style={[styles.button, busy && styles.busy]}
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: space.xl,
    gap: space.md,
    backgroundColor: color.canvas,
    justifyContent: "center",
  },
  title: { fontSize: font.xl, fontWeight: "700", color: color.text },
  sub: { fontSize: font.sm, color: color.textMuted, marginBottom: space.md },
  error: {
    color: color.danger,
    backgroundColor: color.dangerBg,
    padding: space.md,
    borderRadius: radius.md,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: font.md,
    backgroundColor: color.surface,
    color: color.text,
  },
  button: {
    backgroundColor: color.accent,
    padding: space.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  busy: { opacity: 0.6 },
  buttonText: { color: color.accentOn, fontWeight: "600", fontSize: font.md },
});
