// SignIn is the way in, composed: the shell's sign-in, clear and refresh, the
// form that asks, and no header, because there is nothing to go back to. It
// draws the shell's phases itself — restoring a saved sign-in, failing to
// open one — so a product composes this screen rather than forking it.
import { Stack } from "expo-router";
import { useFeedback } from "./useFeedback";
import { useSignOut } from "./useSignOut";
import React, { useState } from "react";
import { useShell } from "../shell";
import { SignInForm } from "../ui/organisms/SignInForm";

// A constant, so the navigator is told the same thing rather than an equal one.
const options = { headerShown: false } as const;

interface Props {
  /** title is the product's name over the form; the reference app says "Sign in". */
  readonly title?: string;
}

export function SignIn({ title }: Props = {}) {
  const feedback = useFeedback();
  const { state, baseURL, signIn, refresh, returning } = useShell();
  // Both ways off this screen — the failed phase's way to another server and the
  // anonymous phase's clearing of a saved sign-in — leave through the one door
  // that asks while this phone holds a write. Signing out clears what is held,
  // and a screen that reached for `signOut` itself would throw that work away
  // on a button whose label only said "another server".
  const leave = useSignOut();
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
  // A saved sign-in that could not be opened is the shell's failed phase; a
  // saved sign-in that could not be read or cleared is its notice while
  // anonymous. The form draws one or the other, never both.
  const failed = state.phase === "failed";
  return (
    <>
      <Stack.Screen options={options} />
      <SignInForm
        feedback={feedback}
        baseURL={baseURL}
        notice={failed ? "" : (state.error ?? "")}
        booting={state.phase === "booting" || state.phase === "loading"}
        failed={failed ? (state.error ?? feedback.copy.failure.loadCatalog) : ""}
        expired={state.reason === "expired" ? feedback.copy.failure.signedOut : ""}
        {...(returning ? { initialEmail: returning.email } : {})}
        onRetry={() => void refresh()}
        busy={busy}
        error={error}
        onSubmit={(u, e, p) => void submit(u, e, p)}
        onClear={leave}
        {...(title ? { title } : {})}
      />
    </>
  );
}
