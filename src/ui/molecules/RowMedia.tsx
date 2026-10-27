import React from "react";
import { StyleSheet, View } from "react-native";
import type { RowMediaModel } from "../../core/present";
import { Icon } from "../atoms/Icon";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";
import type { ImageRenderer } from "./MediaHero";

export function RowMedia({
  model,
  renderImage,
  testID,
}: {
  readonly model: RowMediaModel;
  readonly renderImage?: ImageRenderer | undefined;
  readonly testID?: string;
}) {
  const s = useStyles(styles);
  if (model.kind === "none") return null;
  const image = model.kind === "picture" ? model.image : undefined;
  const icon = model.kind === "icon" ? model.icon : model.fallback;
  if (image?.state === "error" && !icon) return null;
  return (
    <View
      style={[s.tile, image && image.state !== "error" ? s.canvas : s.tint]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...testable(testID)}
    >
      {icon && (!image || image.state === "error") ? <Icon name={icon} status="info" /> : null}
      {image && image.state !== "error" && renderImage ? (
        <View style={[s.image, image.state === "loading" && s.concealed]}>
          {renderImage(image.slot)}
        </View>
      ) : null}
    </View>
  );
}
const styles = (t: Theme) =>
  StyleSheet.create({
    tile: {
      width: t.extent.rowMedia,
      height: t.extent.rowMedia,
      borderRadius: t.radius.md,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    canvas: { backgroundColor: t.color.surfaceCanvas },
    tint: { backgroundColor: t.color.statusInfoBg },
    image: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
    concealed: { opacity: 0 },
  });
