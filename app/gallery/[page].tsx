// One gallery page, at its own route, with its own native header title. The
// page id comes from the path and nothing else: an id the kit does not own
// refuses on the page rather than falling back to something else to look at.
import Constants from "expo-constants";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { Gallery } from "../../src/screens/Gallery";

const shown = __DEV__ || Constants.expoConfig?.extra?.gallery === true;

export default function GalleryPageRoute() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  if (!shown) return <Redirect href="/" />;
  // The id goes to the page untouched: a name the kit does not own refuses on
  // the screen that was asked for, which is what a person and the reviewer
  // both need to see, rather than quietly showing something else.
  const id = Array.isArray(page) ? page[0] : (page ?? "");
  return (
    <>
      <Stack.Screen options={{ title: id, headerLargeTitleEnabled: false }} />
      <Gallery page={id} />
    </>
  );
}
