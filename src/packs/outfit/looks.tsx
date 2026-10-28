// OutfitLooks is the wall of looks: the four the module ranked highest, each named and captioned in
// the module's own words, the answers that produced them one press away, and one control at the foot
// that asks for the next window. The order is the module's and is never touched here: the ranking,
// the ties and what counts as a look for a season are the recipe corpus, and a phone that re-sorted
// it would need the corpus to do so.
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { offers } from "../../core/catalog";
import { noun } from "../../core/present";
import { screenPath } from "../../core/record";
import type { ScreenProps } from "../../renderers";
import { useFeedback } from "../../screens/useFeedback";
import { usePictures } from "../../screens/usePictures";
import { Swatch } from "../../ui/atoms/Swatch";
import { Icon } from "../../ui/atoms/Icon";
import { Text } from "../../ui/atoms/Text";
import { MasonryWall } from "../../ui/organisms/MasonryWall";
import { extent } from "../../ui/scale";
import { useStyles, type Theme } from "../../ui/theme";
import { rowAddress } from "./address";
import { answersCaption, noPorts, useOutfitLooks, type OutfitPorts } from "./read";
import { deriveWall } from "./model";

/**
 * OutfitLooks draws the window the module is holding.
 *
 * `?idea=1` in the address is one instruction from the look page: walk on by one window and replace
 * what is shown with it. It is read once, and the address is cleared the moment it is honoured, so a
 * reload cannot ask the same question twice.
 */
export function OutfitLooks({
  entry,
  ports = noPorts,
}: ScreenProps & { readonly ports?: OutfitPorts }) {
  const feedback = useFeedback();
  const router = useRouter();
  const wall = useOutfitLooks(entry, ports);
  const params = useLocalSearchParams<{ readonly idea?: string }>();
  const media = usePictures(
    wall.looks.map((look) => look.picture),
    undefined,
    extent.flatlay,
  );
  const model = useMemo(
    () =>
      deriveWall(
        {
          looks: wall.looks,
          error: wall.error,
          asking: wall.asking,
          ended: wall.answer?.ended ?? false,
          pictures: media.enabled,
          states: media.states,
        },
        { ...feedback, weekStartsOn: 1 },
      ),
    [wall.looks, wall.error, wall.asking, wall.answer, media.enabled, media.states, feedback],
  );
  const open = useCallback(
    (picture: string) => {
      const look = wall.looks.find((each) => each.picture === picture);
      if (look !== undefined) router.push(rowAddress(entry, look));
    },
    [router, entry, wall.looks],
  );
  const next = wall.next;
  const spent = useRef("");
  useEffect(() => {
    const idea = params.idea ?? "";
    if (idea === "" || spent.current === idea) return;
    spent.current = idea;
    next("replace");
    router.replace(screenPath(entry));
  }, [params.idea, next, router, entry]);
  const options = useMemo(
    () => ({ title: noun(entry).plural, headerLargeTitleEnabled: false }),
    [entry],
  );
  if (!model.ok) return null;
  return (
    <>
      <Stack.Screen options={options} />
      <MasonryWall
        model={model.value}
        columns={2}
        renderImage={media.renderImage}
        onOpen={open}
        onMore={() => wall.next("append")}
        onRetry={() => wall.retry()}
        header={
          <Answers
            colours={wall.answer?.colours ?? []}
            caption={answersCaption(wall.answer)}
            {...(offers(entry, "create")
              ? { ask: () => router.push(`${screenPath(entry)}/new`) }
              : {})}
          />
        }
      />
    </>
  );
}

/**
 * Answers is what the person is being suggested with: the colours they chose, the season and the
 * style beside them, and — only where this installation mounts the questions — the press that goes
 * back to them. Without that door the line stays on screen as what it is: information, not a way out.
 */
function Answers({
  colours,
  caption,
  ask,
}: {
  readonly colours: readonly { readonly id: string; readonly name: string; readonly hex: string }[];
  readonly caption: string;
  readonly ask?: () => void;
}) {
  const s = useStyles(styles);
  if (caption.trim() === "" && colours.length === 0) return null;
  const pill = (
    <View style={s.pill}>
      <View style={s.answers}>
        {colours.map((colour) => (
          <Swatch
            key={colour.id}
            colour={colour.hex}
            label={colour.name}
            testID="outfit-answer-colour"
          />
        ))}
      </View>
      <Text role="label">{caption}</Text>
      {ask ? <Icon name="edit" size="sm" /> : null}
    </View>
  );
  return ask === undefined ? (
    pill
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption}
      onPress={ask}
      testID="outfit-answers"
    >
      {pill}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: t.space.sm,
      paddingInline: t.space.md,
      minHeight: t.hit,
      borderRadius: t.radius.full,
      backgroundColor: t.color.surfacePrimary,
      borderColor: t.color.borderDefault,
      borderWidth: StyleSheet.hairlineWidth,
    },
    // The discs overlap: they are one answer, not three, and a row of spaced circles reads as three
    // facts about three garments.
    answers: { flexDirection: "row" },
  });
