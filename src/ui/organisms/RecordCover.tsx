// RecordCover is the top of a record that has a picture: the photo full-bleed, the
// record's own name standing on it, and the state it is in. It is what a record opens on
// when its entry declares a cover field and this row holds a file in it — and only then:
// without one the record's header stays the block it always was.
//
// The name is drawn over a gradient whose foot is the page's own ink rather than a scrim
// over whatever pixels the photo happens to carry: the pair the title is measured on is
// then the pair the theme already answers for (`textPrimary` on `surfaceCanvas`), and the
// first section below starts in the ink the photo ends in, so there is no seam to paint.
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Feedback, RecordCover as CoverModel, RecordHeader } from "../../core/derive";
import { Badge } from "../atoms/Badge";
import { Notice } from "../atoms/Notice";
import { Skeleton } from "../atoms/Skeleton";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";
import type { ImageRenderer } from "../molecules/MediaHero";

export interface Props {
  readonly cover: CoverModel;
  /** header is the record's own three facts, drawn here rather than in the block below. */
  readonly header: RecordHeader;
  readonly feedback: Feedback;
  readonly renderImage?: ImageRenderer | undefined;
  readonly testID?: string;
}

export function RecordCover({ cover, header, feedback, renderImage, testID }: Props) {
  const s = useStyles(styles),
    t = useTheme();
  const item = cover.picture.item;
  // A picture that is coming still holds its space; a picture that will not come says so
  // in the space it would have taken. Either way the record keeps its name.
  const drawn = item.state === "ready" || item.state === "loading";
  return (
    <View style={s.cover} {...testable(testID ?? "record-cover")}>
      {drawn && renderImage ? (
        <View style={[s.photo, item.state === "loading" && s.concealed]}>
          {renderImage(cover.picture.slot)}
        </View>
      ) : null}
      {item.state === "loading" ? (
        <Skeleton label={feedback.loadingLabel} motion={feedback.motion} variant="media" />
      ) : item.state === "error" ? (
        <Notice text={feedback.copy.kit.imageUnavailable} announcement="polite" />
      ) : null}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="coverFoot" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.color.surfaceCanvas} stopOpacity={0} />
            <Stop offset="0.5" stopColor={t.color.surfaceCanvas} stopOpacity={t.extent.coverFoot} />
            <Stop offset="1" stopColor={t.color.surfaceCanvas} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#coverFoot)" />
      </Svg>
      <View style={s.caption}>
        {header.status ? <Badge label={header.status.label} tone={header.status.tone} /> : null}
        <Text role="title" testID="record-title">
          {header.title}
        </Text>
        {header.summary ? (
          <Text tone="muted" testID="record-summary">
            {header.summary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    cover: {
      height: t.extent.cover,
      overflow: "hidden",
      justifyContent: "flex-end",
      backgroundColor: t.color.surfacePrimary,
    },
    photo: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
    concealed: { opacity: 0 },
    caption: { gap: t.space.xs, padding: t.space.lg },
  });
