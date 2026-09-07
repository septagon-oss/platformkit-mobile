// The library on one screen, for looking at rather than using. It exists in
// development and in a build whose configuration asked for it (the ci
// profile in app.config.ts); a release has no such route.
import Constants from "expo-constants";
import { Redirect, Stack } from "expo-router";
import React from "react";
import { Gallery } from "../src/ui/gallery";

const shown = __DEV__ || Constants.expoConfig?.extra?.gallery === true;

export default function GalleryRoute() {
  if (!shown) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ title: "Gallery", headerLargeTitleEnabled: false }} />
      <Gallery />
    </>
  );
}
