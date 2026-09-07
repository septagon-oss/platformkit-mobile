// The library on one screen, for looking at rather than using. It exists in
// a build that asked for it (EXPO_PUBLIC_GALLERY=1, the verification profile)
// and in development; a release has no such route.
import { Redirect, Stack } from "expo-router";
import React from "react";
import { Gallery } from "../src/ui/gallery";

const shown = __DEV__ || process.env.EXPO_PUBLIC_GALLERY === "1";

export default function GalleryRoute() {
  if (!shown) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ title: "Gallery", headerShown: true }} />
      <Gallery />
    </>
  );
}
