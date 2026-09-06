import { Redirect } from "expo-router";
import React from "react";
import { SignIn } from "../src/screens/SignIn";
import { useShell } from "../src/shell";

export default function SignInRoute() {
  const { state, baseURL, signIn, signOut } = useShell();
  if (state.phase === "ready" || state.phase === "loading") return <Redirect href="/" />;
  return (
    <SignIn baseURL={baseURL} onSignIn={signIn} notice={state.error ?? ""} onClear={signOut} />
  );
}
