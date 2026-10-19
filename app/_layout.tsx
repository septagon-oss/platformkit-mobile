// The composition root. The shell is given where the server is and which
// screens are hand-written; the theme follows the device's appearance; the
// native stack draws every header; and everything else derives from the
// catalog.
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { useEffect, useMemo } from "react";
import { defaultRenderers } from "../src/renderers";
import { commandSheet, sheet } from "../src/route";
import { CoverMotion } from "../src/screens/CoverMotion";
import { FinishingMotion } from "../src/screens/FinishingMotion";
import { Announcement } from "../src/screens/Announcement";
import { RowSwipe } from "../src/screens/RowSwipe";
import { screenCopy } from "../src/screens/failure";
import { NativeZoom } from "../src/screens/NativeZoom";
import { device } from "../src/screens/device";
import { Shell, useShell } from "../src/shell";
import { WorkspaceTheme } from "../src/screens/WorkspaceTheme";
import { useTheme } from "../src/ui/theme";

export default function Layout() {
  return (
    // What this app keeps is said here and nowhere else: the one device store,
    // the one maker of idempotency keys and the one network listener. Without a
    // store the kit holds nothing and every write behaves as it did before.
    <Shell
      baseURL={process.env.EXPO_PUBLIC_API_URL ?? ""}
      renderers={defaultRenderers}
      store={device.store}
      mint={device.mint}
      reach={device.reach}
      media={{
        zoom: NativeZoom,
        coverMotion: CoverMotion,
        finishing: FinishingMotion,
        rowAction: RowSwipe,
      }}
    >
      {/* The workspace's own colour, worn over the generated palette, is what the whole app
          is painted with; it is read between the shell and the theme because that is the one
          place both are known. */}
      <WorkspaceTheme>
        <Root />
      </WorkspaceTheme>
    </Shell>
  );
}

function Root() {
  const { color, font } = useTheme();
  const { entry } = useShell();
  // The words over a sheet's title are the copy table's, and the name under them is
  // the catalogue's: both are read here and handed to the route, which spells the
  // title from them. An entry the shell has not read leaves its wire word, which is
  // what a sheet title has always read a moment before the catalogue arrives.
  const copy = screenCopy();
  const newSheet = useMemo(() => sheet(copy.kit.newNamed, entry), [copy.kit, entry]);
  const editSheet = useMemo(() => sheet(copy.kit.editNamed, entry), [copy.kit, entry]);
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
            screen. The entity is in the path and the catalogue says what that
            entity is called; both are read here, and nothing is spelled. */}
        <Stack.Screen name="[module]/[entity]/new" options={newSheet} />
        <Stack.Screen name="[module]/[entity]/[id]/edit" options={editSheet} />
        <Stack.Screen name="[module]/[entity]/[id]/run/[verb]" options={commandSheet} />
        <Stack.Screen name="[module]/[entity]/run/[verb]" options={commandSheet} />
      </Stack>
      {/* The receipt of a write that opened nothing is drawn over the navigator rather than inside
          one screen: it belongs to the person, not to the list that asked for it. */}
      <Announcement />
    </>
  );
}

const root = { flex: 1 };
