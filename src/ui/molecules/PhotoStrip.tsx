// PhotoStrip is one gallery a record holds: its pictures side by side, each pressable
// to the size it deserves. It is horizontal because a gallery is compared, not read: a
// person scans the row and stops on the one they came for.
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { Feedback, RecordStrip } from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";
import { testable } from "../props";
import type { ImageRenderer } from "./MediaHero";

export interface Props {
  readonly strip: RecordStrip;
  readonly feedback: Feedback;
  readonly renderImage?: ImageRenderer | undefined;
  /** onOpen opens one picture full size; a tile the phone holds no words for is never offered. */
  readonly onOpen?: (id: string) => void;
  readonly testID?: string;
}

export function PhotoStrip({ strip, feedback, renderImage, onOpen, testID }: Props) {
  const s = useStyles(styles);
  return (
    <View
      style={s.strip}
      accessibilityLabel={feedback.copy.kit.images}
      {...testable(testID ?? "photo-strip")}
    >
      <Text tone="muted">{strip.count}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.track}>
        {strip.pictures.map((picture, index) => {
          const item = picture.item;
          const openable = item.state === "ready" && !item.decorative && onOpen !== undefined;
          return (
            <Pressable
              key={picture.slot.instance}
              style={s.tile}
              onPress={openable ? () => onOpen?.(item.id) : undefined}
              accessibilityRole={openable ? "button" : undefined}
              accessibilityLabel={
                openable ? `${feedback.copy.kit.open}: ${item.description}` : item.description
              }
              testID={`photo-${index}`}
            >
              {item.state === "error" ? (
                <Notice text={feedback.copy.kit.imageUnavailable} announcement="polite" />
              ) : renderImage ? (
                <View style={[s.image, item.state === "loading" && s.concealed]}>
                  {renderImage(picture.slot)}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    strip: { gap: t.space.sm },
    track: { gap: t.space.sm },
    tile: {
      width: t.extent.strip,
      height: t.extent.strip,
      borderRadius: t.radius.lg,
      overflow: "hidden",
      backgroundColor: t.color.surfacePrimary,
    },
    image: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
    concealed: { opacity: 0 },
  });
