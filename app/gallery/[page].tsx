// One gallery page, at its own route. The page names itself in its own display
// line, so the native header keeps its back affordance and carries no title: the
// raw id up there was a second, unreadable name for the same screen, and its left
// edge a third column down the page at a desktop's width.
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
      <Stack.Screen options={{ headerTitle: "", headerLargeTitleEnabled: false }} />
      <Gallery page={id} />
    </>
  );
}
