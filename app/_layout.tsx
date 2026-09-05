// The composition root. The shell is given where the server is and which
// screens are hand-written; everything else derives from the catalog.
import { Stack } from "expo-router";
import React from "react";
import { defaultRenderers } from "../src/renderers";
import { Shell } from "../src/shell";

export default function Layout() {
  return (
    <Shell baseURL={process.env.EXPO_PUBLIC_API_URL ?? ""} renderers={defaultRenderers}>
      <Stack screenOptions={{ headerShown: false }} />
    </Shell>
  );
}
