import { Redirect, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { Notice, Waiting } from "../src/route";
import { Home } from "../src/screens/Home";
import { useSignOut } from "../src/screens/useSignOut";
import { useShell } from "../src/shell";

export default function Index() {
  const { state, refresh, saw } = useShell();
  // Home is an address like any other: a person standing on it when the server
  // refuses their session belongs there, and goes back there.
  useFocusEffect(useCallback(() => saw("/"), [saw]));
  // The way out belongs to useSignOut, which asks while this phone holds a write:
  // this screen is exactly where a phone that lost its network lands, so it is
  // the door most likely to be pressed with work still on the device.
  const leave = useSignOut();
  if (state.phase === "anonymous" || state.phase === "signing-in")
    return <Redirect href="/sign-in" />;
  if (state.phase === "booting" || state.phase === "loading") return <Waiting />;
  if (state.phase === "failed")
    return <Notice text={state.error} onRetry={() => void refresh()} onSignIn={leave} />;
  return <Home entries={state.catalog?.resources ?? []} />;
}
