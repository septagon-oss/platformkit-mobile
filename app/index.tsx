import { Redirect, useRouter } from "expo-router";
import React from "react";
import { Notice, Waiting } from "../src/route";
import { Home } from "../src/screens/Home";
import { useShell } from "../src/shell";

export default function Index() {
  const { state, signOut, refresh } = useShell();
  const router = useRouter();
  if (state.phase === "anonymous" || state.phase === "signing-in")
    return <Redirect href="/sign-in" />;
  if (state.phase === "booting" || state.phase === "loading") return <Waiting />;
  if (state.phase === "failed")
    return <Notice text={state.error ?? "The catalog could not be read."} />;
  return (
    <Home
      entries={state.catalog?.resources ?? []}
      onOpen={(path) => router.push(path)}
      onSignOut={signOut}
      onRefresh={refresh}
    />
  );
}
