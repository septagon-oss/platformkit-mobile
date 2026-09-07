// SignIn is the way in, composed: the shell's sign-in and clear, the form
// that asks, and no header, because there is nothing to go back to.
import { Stack } from "expo-router";
import React, { useState } from "react";
import { useShell } from "../shell";
import { SignInForm } from "../ui/organisms/SignInForm";

export function SignIn() {
  const { state, baseURL, signIn, signOut } = useShell();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (url: string, email: string, password: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn(url, email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Those credentials are not right.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SignInForm
        baseURL={baseURL}
        notice={state.error ?? ""}
        busy={busy}
        error={error}
        onSubmit={(u, e, p) => void submit(u, e, p)}
        onClear={() => void signOut()}
      />
    </>
  );
}
