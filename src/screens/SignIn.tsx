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
import { useSignOut } from "./useSignOut";
import { WorkspaceMark } from "./WorkspaceMark";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { workspaceName } from "../core/derive";
import type { Remembered } from "../core/workspace";
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
  const {
    state,
    baseURL,
    signIn,
    answerFactor,
    refresh,
    returning,
    workspace,
    lookUp,
    workspaces,
  } = useShell();
  // Both ways off this screen — the failed phase's way to another server and the
  // anonymous phase's clearing of a saved sign-in — leave through the one door
  // that asks while this phone holds a write. Signing out clears what is held,
  // and a screen that reached for `signOut` itself would throw that work away
  // on a button whose label only said "another server".
  const leave = useSignOut();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /**
   * working is the screen's own answer to "is this screen already asking" held
   * where a second activation can read it before anything is drawn. busy is that
   * answer as this render received it, so a keyboard submit and a tap landing in
   * one frame both find the screen idle and both send — two answers to one
   * challenge, and the kernel spends the proof of the first factor once. One
   * request leaves per activation, so the gate is set here synchronously and
   * busy only carries the same answer to the screen.
   */
  const working = useRef(false);
  /**
   * step is how far this person has got with one form: the address they are pointing at, the
   * password for it, or the code the server asked about. Where it opens follows from what
   * this phone already knows — an address it was built with, one it restored from a saved
   * sign-in, or one a refused session left filled in — so nobody retypes an address the
   * phone already had, and a person arriving at a blank phone is asked where they mean
   * before they are asked who they are.
   */
  const [step, setStep] = useState<"address" | "credentials" | "code">(() =>
    baseURL === "" && !returning ? "address" : "credentials",
  );
  const [connecting, setConnecting] = useState(false);
  // The same answer as `connecting`, read before anything is drawn: a second press of
  // Continue while the first is still away would ask about an address twice.
  const asking = useRef(false);
  // What this device remembers of the places it has been pointed at. Read where it is
  // drawn, and a build with no table for them has no list to read.
  const [remembered, setRemembered] = useState<readonly Remembered[]>([]);
  useEffect(() => {
    if (!workspaces) return;
    let mine = true;
    void workspaces.list().then((rows) => {
      if (mine) setRemembered(rows);
    });
    return () => {
      mine = false;
    };
  }, [workspaces]);
  const connect = async (url: string) => {
    if (asking.current) return;
    asking.current = true;
    setConnecting(true);
    setError("");
    try {
      // An address that answered nothing stays on this step and says nothing extra: the
      // person is about to find out at the password, which is what they do today, and a
      // phone cannot tell "no workspace here" from "this network is lying".
      if (await lookUp(url)) setStep("credentials");
    } finally {
      asking.current = false;
      setConnecting(false);
    }
  };
  // The name over the fields, by the one rule the header and Home's band read too, so the
  // three cannot call the same place two things.
  const place = useMemo(
    () => ({ name: workspaceName(baseURL, feedback.copy, workspace.name), host: workspace.host }),
    [baseURL, feedback.copy, workspace.host, workspace.name],
  );
  // challenged is the address the server refused to finish signing in. The code
  // is offered about that address, not whatever is left in the field after a
  // correction, and it is what the retry sends.
  const [challenged, setChallenged] = useState("");
  const [code, setCode] = useState("");
  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const submit = async (url: string, email: string, password: string) => {
    if (working.current) return;
    working.current = true;
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
      working.current = false;
      setBusy(false);
    }
  };
  const submitCode = async (typed: string) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await answerFactor(challenged, typed);
    } catch (e) {
      // The server spends the proof of the first factor with a DELETE inside the
      // sign-in's own transaction, so a code it refuses rolls that spend back and
      // the window stays open for another try
      // (modules/auth/internal/factors.go's RequireFirstFactorProof, at the commit
      // this build's document came from). The field empties anyway rather than
      // offer one text twice: a recovery code is spent by the answer that redeems
      // it, and a wrong code and a spent code are one answer, so this screen has
      // no way to say which is still good. The link under the field is the way
      // back to the password, which is the only thing that opens a new window.
      setCode("");
      setError(
        e instanceof ApiError && e.status === 401 ? feedback.copy.kit.codeWrong : message(e),
      );
    } finally {
      working.current = false;
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
        workspace={place}
        mark={
          workspace.logoPath === undefined ? null : (
            <WorkspaceMark description={feedback.copy.kit.workspaceMark(place.name)} />
          )
        }
        remembered={remembered}
        connecting={connecting}
        onContinue={(url) => void connect(url)}
        onEditAddress={() => {
          setStep("address");
          setError("");
        }}
        {...(returning ? { initialEmail: returning.email } : {})}
        onRetry={() => void refresh()}
        busy={busy}
        error={error}
        onSubmit={(u, e, p) => void submit(u, e, p)}
        onClear={leave}
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
