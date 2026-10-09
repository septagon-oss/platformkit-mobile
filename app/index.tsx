import { Redirect, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { Notice, Waiting } from "../src/route";
import { Home } from "../src/screens/Home";
import { useShell } from "../src/shell";

export default function Index() {
  const { state, refresh, signOut, saw } = useShell();
  // Home is an address like any other: a person standing on it when the server
  // refuses their session belongs there, and goes back there.
  useFocusEffect(useCallback(() => saw("/"), [saw]));
  if (state.phase === "anonymous" || state.phase === "signing-in")
    return <Redirect href="/sign-in" />;
  if (state.phase === "booting" || state.phase === "loading") return <Waiting />;
  if (state.phase === "failed")
    return (
      <Notice text={state.error} onRetry={() => void refresh()} onSignIn={() => void signOut()} />
    );
  return <Home entries={state.catalog?.resources ?? []} />;
}
