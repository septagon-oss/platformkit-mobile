// The composition root. The shell is given where the server is and which
// screens are hand-written; the theme follows the device's appearance; the
// native stack draws every header; and everything else derives from the
// catalog.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { useEffect } from "react";
import { defaultRenderers } from "../src/renderers";
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
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
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
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: color.surfaceCanvas },
        }}
      />
    </>
  );
}
