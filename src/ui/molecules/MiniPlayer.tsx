// MiniPlayer is what is playing now, still on screen while the person looks at
// something else: the cover, what it is, how far through it is, and the one
// control that answers right now. It owns no clock and no media SDK — the
// screen feeds it the position it measured, and the numbers come from core.
import React, { useState } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import type { PlaybackModel } from "../../core/progress";
import { testable } from "../props";
import { Icon, type IconName } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { useStyles, useTheme, type Theme } from "../theme";
import { useVerbStage } from "../verb";

export type PlayerIntent = "play" | "pause" | "back" | "forward" | "seek" | "open";

interface Props {
  readonly model: PlaybackModel;
  readonly title: string;
  readonly subtitle?: string;
  /** artwork is the caller's image element: this component draws no picture and no placeholder colour. */
  readonly artwork?: React.ReactNode;
  readonly playing: boolean;
  /** controls says which intents the caller answers; a control it does not answer is not drawn. */
  readonly controls?: { readonly back?: boolean; readonly forward?: boolean };
  readonly onIntent: (intent: PlayerIntent) => void;
  /** collapsed is the strip over a list; expanded is the same record with its scrubber. */
  readonly collapsed?: boolean;
  readonly testID?: string;
}

export function MiniPlayer({
  model,
  title,
  subtitle,
  artwork,
  playing,
  controls = {},
  onIntent,
  collapsed = true,
  testID,
}: Props) {
  const t = useTheme();
  // The play/pause toggle is the verb a screen answers with, and one screen has
  // one filled verb: only the subtree the screen names as its lead is filled.
  const emphasised = useVerbStage();
  const s = useStyles(styles);
  const toggle: PlayerIntent = playing ? "pause" : "play";
  const glyph: IconName = playing ? "pause" : "play";
  // Where the track has got to. A position with no total is not a sum the strip
  // can complete, so the one-line strip says how far the track has run and leaves
  // the sentence that explains the missing total to the card, which has the line
  // to write it in.
  const position =
    model.fraction !== undefined
      ? `${model.elapsed} · ${model.remaining}`
      : collapsed
        ? model.elapsed
        : `${model.elapsed} · ${model.reason ?? ""}`;
  // A strip over a list is one line tall and its words are cut short; the card a
  // person stops on is not. Expanded, the title and the position take the lines
  // the sentence needs and the controls move below them, so the words are not
  // what gets squeezed by the transport.
  const lines = collapsed ? 1 : 2;
  return (
    // The strip is a group, not one element: `accessible` would fold the play
    // button into the strip on iOS, and an `adjustable` role would invite a swipe
    // this strip cannot answer — it owns no scrubber, the screen does.
    <View style={[s.strip, !collapsed && s.expanded]} {...testable(testID)}>
      <View style={s.body}>
        {artwork ? <View style={collapsed ? s.art : s.artCover}>{artwork}</View> : null}
        <View style={s.text}>
          {/* On the strip the title is one line among three; on the card it is
              the heading the artwork stands beside. */}
          <Text role={collapsed ? "label" : "title"} weight="semibold" numberOfLines={lines}>
            {title}
          </Text>
          {subtitle ? (
            <Text role="caption" tone="muted" numberOfLines={lines}>
              {subtitle}
            </Text>
          ) : null}
          <Text role="caption" tone="muted" numberOfLines={lines}>
            {position}
          </Text>
          {collapsed ? null : (
            <View style={s.track}>
              <View
                style={[
                  s.bar,
                  { backgroundColor: t.color.surfaceMuted },
                  !model.seekable && s.unseekable,
                ]}
              >
                <View
                  style={[
                    s.fill,
                    {
                      backgroundColor: t.color.accentDefault,
                      width: `${Math.round((model.fraction ?? 0) * 1000) / 10}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      </View>
      <View style={s.controls}>
        {controls.back ? (
          <Control
            glyph="rewind"
            intent="back"
            word={model.words.rewind}
            onIntent={onIntent}
            testID={testID ? `${testID}-back` : undefined}
          />
        ) : null}
        <Control
          glyph={glyph}
          intent={toggle}
          word={playing ? model.words.pause : model.words.play}
          filled={emphasised}
          onIntent={onIntent}
          testID={testID ? `${testID}-toggle` : undefined}
        />
        {controls.forward ? (
          <Control
            glyph="forward"
            intent="forward"
            word={model.words.skipAhead}
            onIntent={onIntent}
            testID={testID ? `${testID}-forward` : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

function Control({
  glyph,
  intent,
  word,
  filled = false,
  onIntent,
  testID,
}: {
  readonly glyph: IconName;
  readonly intent: PlayerIntent;
  /** word is the control's name in the person's language, from the model core derived. */
  readonly word: string;
  readonly filled?: boolean;
  readonly onIntent: (intent: PlayerIntent) => void;
  readonly testID?: string | undefined;
}) {
  const s = useStyles(styles);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const shape: ViewStyle[] = [s.control, filled ? s.controlFilled : s.controlPlain];
  return (
    <Pressable
      onPress={() => onIntent(intent)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={word}
      // A play/pause control names its own state — the word is Play or Pause —
      // so it states nothing further: aria-selected is not allowed on
      // role="button" and a browser drops it (src/ui/props.ts).
      accessibilityActions={[{ name: "activate", label: word }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") onIntent(intent);
      }}
      {...testable(testID)}
      style={({ pressed }) => [
        ...shape,
        hovered && !filled && s.hover,
        pressed && (filled ? s.pressFilled : s.press),
        focused && s.focused,
      ]}
    >
      <Icon name={glyph} size="md" tone={filled ? "on" : "accent"} />
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    strip: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.sm,
      paddingHorizontal: t.space.md,
      paddingVertical: t.space.sm,
      backgroundColor: t.color.surfacePrimary,
      borderRadius: t.radius.lg,
      minHeight: t.extent.player,
      ...t.state.raised,
    },
    expanded: {
      flexDirection: "column",
      alignItems: "flex-start",
      padding: t.space.md,
      borderRadius: t.radius.xl,
      gap: t.space.sm,
    },
    body: { flex: 1, flexDirection: "row", alignItems: "center", gap: t.space.sm },
    // The strip's cover is the size of a row; the card's is the size of the
    // thing being played. Both crop what the caller draws into the box.
    art: {
      width: t.extent.player,
      height: t.extent.player,
      borderRadius: t.radius.md,
      overflow: "hidden",
    },
    artCover: {
      width: t.extent.playerCover,
      height: t.extent.playerCover,
      borderRadius: t.radius.lg,
      overflow: "hidden",
    },
    text: { flex: 1, gap: t.space.xs / 2 },
    track: { paddingTop: t.space.xs },
    bar: { height: t.extent.meter, borderRadius: t.radius.full, overflow: "hidden" },
    fill: { height: "100%", borderRadius: t.radius.full },
    unseekable: { borderWidth: 1, borderStyle: "dashed", borderColor: t.state.outline },
    controls: { flexDirection: "row", alignItems: "center", gap: t.space.xs },
    control: {
      width: t.hit,
      height: t.hit,
      borderRadius: t.radius.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: t.extent.focus,
      borderColor: t.color.surfacePrimary,
    },
    controlFilled: { backgroundColor: t.color.accentDefault },
    controlPlain: {
      backgroundColor: t.color.surfacePrimary,
      borderColor: t.state.outline,
    },
    hover: { backgroundColor: t.state.hovered },
    press: { backgroundColor: t.state.pressed },
    pressFilled: { backgroundColor: t.color.accentHover },
    focused: {
      borderColor: t.color.focus,
      outlineColor: t.color.focus,
      outlineWidth: t.extent.focus,
      outlineOffset: t.space.xs / 2,
    },
  });
