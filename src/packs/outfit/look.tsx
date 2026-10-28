// OutfitLook is one look: the flat-lay at the width of the page, its name and the two answers it was
// composed under, one line per piece in the order the module laid them out, and the two doors — the
// next idea, and the person's own copy of this one. Nothing here re-describes a garment, re-orders a
// piece or re-colours a swatch: the module composed the look and the page says what it composed. A
// refresh that refused is drawn as a sentence above the look it refused, and the keep is withheld
// while that sentence stands — a record the service would not confirm is not offered back as a fact.
import { Stack, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { deriveState, noun } from "../../core/present";
import type { Presentation } from "../../core/presentation";
import { screenPath } from "../../core/record";
import type { ScreenProps } from "../../renderers";
import { useFeedback } from "../../screens/useFeedback";
import { usePictures } from "../../screens/usePictures";
import { useSaveToggle } from "../../screens/useSaveToggle";
import { Button } from "../../ui/atoms/Button";
import { Swatch } from "../../ui/atoms/Swatch";
import { Text } from "../../ui/atoms/Text";
import { kitStyles } from "../../ui/layout";
import { MediaHero } from "../../ui/molecules/MediaHero";
import { SaveButton } from "../../ui/molecules/SaveButton";
import { StateView } from "../../ui/molecules/StateView";
import { Screen } from "../../ui/templates/Screen";
import { extent } from "../../ui/scale";
import { useStyles, type Theme } from "../../ui/theme";
import { deriveLook, refusal } from "./model";
import { lookRow } from "./address";
import { noPorts, useOutfitLook, type OutfitPorts } from "./read";

/** OutfitLook reads the look this address names, by the key the module keeps it under. */
export function OutfitLook({
  entry,
  id,
  ports = noPorts,
}: ScreenProps & { readonly ports?: OutfitPorts }) {
  const feedback = useFeedback();
  const router = useRouter();
  const read = useOutfitLook(ports, entry, id ?? "");
  const s = useStyles(styles),
    k = useStyles(kitStyles);
  const media = usePictures(
    read.look === undefined ? [] : [read.look.picture],
    undefined,
    extent.flatlay,
  );
  const model = useMemo(
    () =>
      read.look === undefined
        ? undefined
        : deriveLook(
            {
              look: read.look,
              error: read.error,
              pictures: media.enabled,
              states: media.states,
            },
            { ...feedback, weekStartsOn: 1 },
          ),
    [read.look, read.error, media.enabled, media.states, feedback],
  );
  const presentation: Presentation = { ...feedback, weekStartsOn: 1 };
  const keeping = useSaveToggle(
    entry,
    read.look?.ref.key,
    read.look === undefined ? undefined : lookRow(read.look),
  );
  const options = useMemo(
    () => ({ title: noun(entry).singular, headerLargeTitleEnabled: false }),
    [entry],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <Screen>
        {read.look === undefined ? (
          <Undrawn error={read.error} retry={read.retry} presentation={presentation} />
        ) : model?.ok ? (
          <>
            {model.value.notice === undefined ? null : (
              <StateView model={model.value.notice} onAction={() => read.retry()} />
            )}
            <MediaHero
              model={model.value.hero}
              renderImage={media.renderImage}
              fit="cover"
              ground={model.value.background}
              renderFrame={(frame) => <View style={s.frame}>{frame}</View>}
            />
            <View style={[k.row, s.heading]}>
              <Text role="title">{read.look.name}</Text>
              <Text role="caption" tone="muted">
                {model.value.caption}
              </Text>
            </View>
            <View style={s.pieces}>
              {model.value.pieces.map((piece) => (
                <View key={piece.id} style={[k.row, s.piece]} testID="outfit-look-piece">
                  {/* The disc paints the line's colour and says nothing: the sentence beside it is
                      the module's whole line and already carries that colour's own word. */}
                  <Swatch colour={piece.hex} />
                  <Text>{piece.line}</Text>
                </View>
              ))}
            </View>
            <View style={[k.row, s.doors]}>
              <Button
                label={feedback.copy.outfit.anotherIdea}
                tone="secondary"
                onPress={() => router.replace(`${screenPath(entry)}?idea=1`)}
                motion={feedback.motion}
                testID="outfit-another-idea"
              />
              {/* A keep is offered against a record this phone has heard of: while a refused read
                  stands over the look, the page asks rather than writing against it. */}
              {keeping.model === undefined || read.error !== "" ? null : (
                <SaveButton model={keeping.model} onPress={keeping.press} />
              )}
            </View>
          </>
        ) : null}
      </Screen>
    </>
  );
}

/**
 * Undrawn is what a look page holds while its look is not there: the shape it will take, or the
 * sentence that says why it will not. A look that refused is not drawn as an empty one, and no heart
 * stands on a record this phone never read.
 */
function Undrawn({
  error,
  retry,
  presentation,
}: {
  readonly error: string;
  readonly retry: () => void;
  readonly presentation: Presentation;
}) {
  const model =
    error === ""
      ? deriveState({ kind: "loading", skeleton: "detail" }, presentation)
      : refusal(error, "look", presentation);
  return model.ok ? <StateView model={model.value} onAction={() => retry()} /> : null;
}

const styles = (t: Theme) =>
  StyleSheet.create({
    // The flat-lay is drawn edge to edge of the column with the page's own raised corner: the
    // picture is the look, and the words below it describe it.
    frame: { borderRadius: t.radius.xl, overflow: "hidden" },
    heading: { justifyContent: "space-between", alignItems: "baseline" },
    pieces: { gap: t.space.xs },
    piece: { gap: t.space.sm, minHeight: t.hit },
    doors: { justifyContent: "space-between", gap: t.space.sm },
  });
