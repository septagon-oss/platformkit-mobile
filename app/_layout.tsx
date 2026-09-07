// The composition root. The shell is given where the server is and which
// screens are hand-written; the theme follows the device's appearance; the
// native stack draws every header; and everything else derives from the
// catalog.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { useEffect, useMemo } from "react";
import { defaultRenderers } from "../src/renderers";
import { commandSheet, sheet } from "../src/route";
import { Shell } from "../src/shell";
import { ThemeProvider, useTheme } from "../src/ui/theme";

export default function Layout() {
  return (
    <Shell baseURL={process.env.EXPO_PUBLIC_API_URL ?? ""} renderers={defaultRenderers}>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </Shell>
  );
}

function Root() {
  const { color, font } = useTheme();
  // The window behind every screen, so a transition never flashes white in the dark.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(color.surfaceCanvas);
  }, [color.surfaceCanvas]);
  // One options object per theme. The navigator is told its options on every
  // render, and a fresh object each time is a fresh instruction.
  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      headerLargeTitleEnabled: true,
      headerLargeTitleShadowVisible: false,
      headerTintColor: color.accentDefault,
      headerStyle: { backgroundColor: color.surfaceCanvas },
      headerTitleStyle: { color: color.textPrimary },
      headerLargeTitleStyle: {
        color: color.textPrimary,
        ...(font.display ? { fontFamily: font.display } : {}),
      },
      headerBackButtonDisplayMode: "minimal" as const,
      contentStyle: { backgroundColor: color.surfaceCanvas },
    }),
    [color.accentDefault, color.surfaceCanvas, color.textPrimary, font.display],
  );

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={screenOptions}>
        {/* The two sheets are named here so their title exists before the
            screen mounts: a modal is presented with the header it is given at
            that moment, and a title set later leaves the route's own name on
            screen. The entity is in the path, which is where this reads it. */}
        <Stack.Screen name="[module]/[entity]/new" options={sheet("New ")} />
        <Stack.Screen name="[module]/[entity]/[id]/edit" options={sheet("Edit ")} />
        <Stack.Screen name="[module]/[entity]/[id]/run/[verb]" options={commandSheet} />
        <Stack.Screen name="[module]/[entity]/run/[verb]" options={commandSheet} />
      </Stack>
    </>
  );
}
