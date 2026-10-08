// SignIn is the way in, composed: the shell's sign-in, its answer to a second
// factor, clear and refresh, the form that asks, and no header, because there
// is nothing to go back to. It draws the shell's phases itself — restoring a
// saved sign-in, failing to open one — so a product composes this screen rather
// than forking it. Which step the person is on is this screen's own: the server
// holds the five-minute window a challenge opens and the phone keeps no copy of
// it, so "credentials" and "code" are how far one sign-in got, not a state of
// the session.
import { Stack } from "expo-router";
import { useFeedback } from "./useFeedback";
import React, { useState } from "react";
import { useShell } from "../shell";
import { ApiError } from "../effects/api";
import { SignInForm } from "../ui/organisms/SignInForm";

// A constant, so the navigator is told the same thing rather than an equal one.
const options = { headerShown: false } as const;

interface Props {
  /** title is the product's name over the form; the reference app says "Sign in". */
  readonly title?: string;
}

export function SignIn({ title }: Props = {}) {
  const feedback = useFeedback();
  const { state, baseURL, signIn, answerFactor, signOut, refresh } = useShell();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  // challenged is the address the server refused to finish signing in. The code
  // is offered about that address, not whatever is left in the field after a
  // correction, and it is what the retry sends.
  const [challenged, setChallenged] = useState("");
  const [code, setCode] = useState("");
  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const submit = async (url: string, email: string, password: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const answer = await signIn(url, email, password);
      if (answer?.kind === "factor-required") {
        setChallenged(answer.email);
        setStep("code");
        setCode("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Those credentials are not right.");
    } finally {
      setBusy(false);
    }
  };
  const submitCode = async (typed: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await answerFactor(challenged, typed);
    } catch (e) {
      // A refused code spent the window it came from, so the field empties
      // rather than offer the same answer twice: the way to another challenge
      // is the password link under the field, and the phone never re-mints one.
      setCode("");
      setError(
        e instanceof ApiError && e.status === 401 ? feedback.copy.kit.codeWrong : message(e),
      );
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
        failed={failed ? (state.error ?? "The catalog could not be read.") : ""}
        onRetry={() => void refresh()}
        busy={busy}
        error={error}
        onSubmit={(u, e, p) => void submit(u, e, p)}
        onClear={() => void signOut()}
        step={step}
        code={code}
        onCodeChange={setCode}
        onSubmitCode={(value) => void submitCode(value)}
        onEditCredentials={() => {
          setStep("credentials");
          setCode("");
          setError("");
        }}
        {...(title ? { title } : {})}
      />
    </>
  );
}
