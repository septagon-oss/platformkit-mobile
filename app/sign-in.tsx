import { Redirect } from "expo-router";
import React from "react";
import { SignIn } from "../src/screens/SignIn";
import { useShell } from "../src/shell";

export default function SignInRoute() {
  const { state, returning } = useShell();
  // A shell with nowhere to go back to leaves as soon as a catalogue is on its
  // way, exactly as it did before an expired session had a route to remember. A
  // shell that does have one must wait for the answer to "who is signing in
  // now", which only this session's own /auth/me gives: until then it is not
  // known whether that route belongs to this person at all.
  if (state.phase === "ready" || (state.phase === "loading" && !returning))
    return <Redirect href={returning?.href ?? "/"} />;
  return <SignIn />;
}
