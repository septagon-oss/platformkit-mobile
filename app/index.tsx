import { Redirect } from "expo-router";
import React from "react";
import { Notice, Waiting } from "../src/route";
import { Home } from "../src/screens/Home";
import { useShell } from "../src/shell";

export default function Index() {
  const { state, refresh } = useShell();
  if (state.phase === "anonymous" || state.phase === "signing-in")
    return <Redirect href="/sign-in" />;
  if (state.phase === "booting" || state.phase === "loading") return <Waiting />;
  if (state.phase === "failed")
    return (
      <Notice
        text={state.error ?? "The catalog could not be read."}
        onRetry={() => void refresh()}
      />
    );
  return <Home entries={state.catalog?.resources ?? []} />;
}
