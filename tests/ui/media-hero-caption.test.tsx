// A hero names its picture once, and only where the name can be read as a line of
// the screen. The frame used to write the image's description inside itself while the
// hero wrote the same words again below; and a hero whose image never arrived kept the
// cover's aspect ratio, so a refusal was drawn as a tall empty block shaped like the
// picture that was not coming.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { kitExamples, type ImageSlotProps, type Result } from "../../src/core/derive";
import { MediaHero, type ImageRenderer } from "../../src/ui/molecules/MediaHero";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

/** The gallery's own poster: it writes the name inside the frame unless told not to. */
const poster: ImageRenderer = (props: ImageSlotProps) => (
  <View testID="slot">{props.caption === false ? null : <Text>{props.description}</Text>}</View>
);

const view = (node: React.ReactNode) => <ThemeProvider mode="light">{node}</ThemeProvider>;

/** Every style the rendered tree carries, flattened — what a screen is drawn with. */
function styles(node: unknown): (readonly unknown[])[] {
  if (node === null || typeof node !== "object") return [];
  const children = (node as { children?: unknown[] }).children ?? [];
  const own = (node as { props?: { style?: StyleProp<ViewStyle> } }).props?.style;
  const flat =
    own === undefined ? [] : [own].flat(4).filter((v) => v !== null && typeof v === "object");
  return [flat, ...children.flatMap((child: unknown) => styles(child))];
}

const hero = (caseId: string, line?: string) => {
  const model = ok(kitExamples(presentation, caseId)).hero;
  return line === undefined ? model : { ...model, title: line };
};

test("a hero that writes the picture's name below asks the frame not to write it again", async () => {
  const model = hero("media-hero/default", "The print room, in morning light");
  await render(view(<MediaHero model={model} renderImage={poster} />));
  expect(screen.getByText("The print room, in morning light")).toBeTruthy();
  // One written line carries the name: the hero's. The frame stays quiet.
  expect(JSON.stringify(screen.getByTestId("slot").toJSON())).not.toContain(model.item.description);
});

test("a media image that never arrives is a sentence, not a cover-shaped hole", async () => {
  const failed = ok(kitExamples(presentation, "media-hero/error")).hero;
  await render(view(<MediaHero model={failed} renderImage={poster} />));
  expect(screen.getByText(failed.item.reason!)).toBeTruthy();
  // Nothing reserves the picture's proportions once no picture is coming.
  expect(
    styles(screen.toJSON())
      .flat()
      .some((s) => "aspectRatio" in (s as object)),
  ).toBe(false);
  // The ready hero keeps them: the space an arriving image needs is real.
  const ready = ok(kitExamples(presentation, "media-hero/default")).hero;
  await render(view(<MediaHero model={ready} renderImage={poster} />));
  const drawn = styles(screen.toJSON()).flat();
  expect(
    drawn.some((s) => (s as { aspectRatio?: number }).aspectRatio === ready.item.aspectRatio),
  ).toBe(true);
});
