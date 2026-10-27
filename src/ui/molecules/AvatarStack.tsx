import React from "react";
import { StyleSheet, View } from "react-native";
import type { AvatarStackModel } from "../../core/present";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";
import { Avatar } from "./Avatar";
import type { ImageRenderer } from "./MediaHero";

export function AvatarStack({
  model,
  renderImage,
  testID,
  decorative = false,
}: {
  readonly model: AvatarStackModel;
  readonly renderImage?: ImageRenderer | undefined;
  readonly testID?: string;
  readonly decorative?: boolean;
}) {
  const s = useStyles(styles);
  if (!model.people.length) return null;
  if (model.people.length === 1 && !model.remainder)
    return (
      <Avatar
        model={model.people[0]!}
        renderImage={renderImage}
        decorative={decorative}
        {...testable(testID)}
      />
    );
  return (
    <View
      style={s.group}
      accessible={!decorative}
      {...(!decorative ? { accessibilityLabel: model.description } : {})}
      {...testable(testID)}
    >
      <View
        style={s.discs}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {model.people.map((person, i) => (
          <View key={i} style={[s.disc, i > 0 && s.overlap]}>
            <Avatar model={person} renderImage={renderImage} size="small" discOnly decorative />
          </View>
        ))}
        {model.remainder ? (
          <Text role="caption" style={s.remainder}>
            {model.remainder}
          </Text>
        ) : null}
      </View>
      <View style={s.name}>
        <Text>{model.description}</Text>
      </View>
    </View>
  );
}
const styles = (t: Theme) =>
  StyleSheet.create({
    group: { flexDirection: "row", alignItems: "center", gap: t.space.sm },
    discs: { flexDirection: "row", alignItems: "center" },
    disc: {
      borderWidth: t.extent.focus,
      borderColor: t.color.surfacePrimary,
      borderRadius: t.radius.full,
    },
    overlap: { marginLeft: -t.extent.avatarOverlap },
    remainder: { marginLeft: t.space.xs },
    name: { flexShrink: 1 },
  });
