import React from "react";
import { StyleSheet, View } from "react-native";
import type { AvatarModel } from "../../core/present";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { statusPair, useStyles, useTheme, type Theme } from "../theme";
import type { ImageRenderer } from "./MediaHero";

export function Avatar({
  model,
  renderImage,
  size = "regular",
  discOnly = false,
  decorative = false,
  testID,
}: {
  readonly model: AvatarModel;
  readonly renderImage?: ImageRenderer | undefined;
  readonly size?: "small" | "regular";
  readonly discOnly?: boolean;
  readonly decorative?: boolean;
  readonly testID?: string;
}) {
  const t = useTheme(),
    s = useStyles(styles);
  const [ink, surface] = statusPair(t, model.tone);
  const extent = size === "small" ? t.extent.avatarSmall : t.extent.avatar;
  const image = model.image;
  return (
    <View
      style={s.person}
      accessible={!decorative && !discOnly}
      {...(!decorative && !discOnly ? { accessibilityLabel: model.name } : {})}
      {...testable(testID)}
    >
      <View
        style={[s.disc, { width: extent, height: extent, backgroundColor: surface }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {model.initials ? (
          <Text role="caption" weight="semibold" style={{ color: ink }}>
            {model.initials}
          </Text>
        ) : (
          <Icon name="person" size="sm" status={model.tone} />
        )}
        {image && image.state !== "error" && renderImage ? (
          <View style={[s.image, image.state === "loading" && s.concealed]}>
            {renderImage(image.slot)}
          </View>
        ) : null}
      </View>
      {discOnly ? null : (
        <View style={s.name}>
          <Text>{model.name}</Text>
        </View>
      )}
    </View>
  );
}
const styles = (t: Theme) =>
  StyleSheet.create({
    person: { flexDirection: "row", alignItems: "center", gap: t.space.sm },
    disc: {
      borderRadius: t.radius.full,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    name: { flexShrink: 1 },
    image: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
    concealed: { opacity: 0 },
  });
