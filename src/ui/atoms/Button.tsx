// Button is the one way an action is offered. A tone says what pressing it
// does to the world; a placement says where it sits, because a button in the
// native header is a word in the accent colour and a button on a page is a
// filled shape, and both are this component.
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type ViewStyle,
} from "react-native";
import type { Motion } from "../../core/derive";
import { chosenState, currentInSet, testable } from "../props";
import { controlInk, useStyles, useTheme, type Theme } from "../theme";
import { useVerbStage } from "../verb";
import { Icon, type IconName } from "./Icon";
import { Text, toneColor, type Tone as TextTone } from "./Text";

export type ButtonTone = "primary" | "secondary" | "destructive" | "plain";
export type Placement = "inline" | "header";

interface Props {
  /**
   * label is the word the control prints. An empty label prints nothing and the
   * control is its glyph alone — the two halves of a stepper, which are the same
   * act on every screen and cannot be told apart by a word in two languages. The
   * name below is then what the control announces.
   */
  readonly label: string;
  /** name is what the control announces when the word it shows is not the whole name — a stepper's "Increase" sits beside a value named "Quantity". */
  readonly name?: string;
  readonly onPress: () => void;
  readonly tone?: ButtonTone;
  readonly placement?: Placement;
  readonly icon?: IconName;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly reason?: string;
  readonly hint?: string;
  /** Unresolved preferences stay still. Screens supply normal motion explicitly. */
  readonly motion?: Motion;
  readonly testID?: string;
  readonly accessibilityRole?: AccessibilityRole;
  readonly selected?: boolean;
  /** current is the word that says this control is the current one in its set — a day strip's "Today". The control keeps the name of the thing it is; the word is stated as the state each platform holds it in. */
  readonly current?: string;
  readonly checked?: boolean | "mixed";
  readonly expanded?: boolean;
}

export function Button({
  label,
  name,
  onPress,
  tone = "primary",
  placement = "inline",
  icon,
  busy = false,
  disabled = false,
  reason,
  hint,
  motion = "reduced",
  testID,
  accessibilityRole = "button",
  selected,
  current,
  checked,
  expanded,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const off = disabled || busy;
  // A control with no word of its own is announced entirely by its name, and the
  // accessibility action carries that same whole name rather than an empty word.
  const spoken = name ?? label;
  const glyphOnly = label === "";
  const activate = () => {
    if (!off) onPress();
  };
  const header = placement === "header";
  const stage = useVerbStage();
  // Only the subtree that holds the screen's one filled verb is drawn filled;
  // everywhere else the same tone is offered in the outlined ink.
  const filled = !header && stage && (tone === "primary" || tone === "destructive");
  // A control holds "this is the one that stands" in two spellings: `selected` names
  // the member of a set the screen is on, `checked` names the box, chip or slot a
  // person has marked. The drawing reads both, because a state the accessibility
  // tree alone can read is not a state — the aria spelling says it to a reader, this
  // line says it to everyone else. Neither spelling buys the tint over a filled verb,
  // because the fill and the ink are one decision: state.selected is the accent mixed
  // into the page's surface, so it is a pair for the page's own ink, while a filled
  // verb writes its label in the accent's on-accent ink — the chosen day measured
  // 1.08:1 light and 1.53:1 dark where the tint was laid over that fill. The fill is
  // already the standing (DayStrip, SlotPicker and ChoiceChips spell their chosen
  // member by asking for the filled tone), so a filled verb keeps it in both spellings.
  const picked = (selected === true || checked === true) && !filled;
  const textTone: TextTone = off
    ? "primary"
    : filled
      ? "on"
      : tone === "destructive"
        ? "danger"
        : header || tone === "plain"
          ? "accent"
          : "primary";
  const shape: ViewStyle[] = [s.base];
  if (header) shape.push(s.header);
  else if (filled) shape.push(tone === "destructive" ? s.destructive : s.primary);
  else if (tone === "plain") shape.push(s.plain);
  else shape.push(s.secondary);
  return (
    <Pressable
      onPress={activate}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      disabled={off}
      accessibilityRole={accessibilityRole}
      {...currentInSet(current, spoken)}
      {...(reason || hint ? { accessibilityHint: reason ?? hint } : {})}
      aria-busy={busy}
      aria-checked={checked}
      aria-disabled={off}
      aria-expanded={expanded}
      {...chosenState(accessibilityRole, selected)}
      accessibilityActions={off ? [] : [{ name: "activate", label: spoken }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") activate();
      }}
      android_ripple={header ? undefined : { color: t.color.borderStrong }}
      style={({ pressed }) => [
        ...shape,
        glyphOnly && s.mark,
        controlInk(toneColor(t, textTone)),
        // The mark is laid under the interaction states, not over them: a control that
        // is marked still answers a hover and a press.
        picked && s.picked,
        hovered && !off && !filled && s.hover,
        pressed && !off && (filled ? s.activeFilled : s.press),
        focused && s.focused,
        // A control that stands is the one the screen is on or the one a person
        // marked. Saying it cannot be pressed now (there is nothing left to press *to*)
        // does not make it out of reach, so it is never drawn in the unavailable
        // outline: the dash would erase the very fact the control is showing.
        off && !picked && s.off,
      ]}
      {...testable(testID)}
    >
      <View style={[s.content, tone === "plain" ? s.plainContent : null]}>
        {busy && motion === "normal" ? (
          <ActivityIndicator
            size="small"
            color={toneColor(t, textTone)}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          />
        ) : busy ? (
          <Icon name="clock" size="sm" tone={textTone} />
        ) : icon ? (
          <Icon name={icon} size="sm" tone={textTone} />
        ) : null}
        {glyphOnly ? null : (
          <Text
            role={header ? "body" : "label"}
            weight="semibold"
            tone={textTone}
            align={tone === "plain" ? "left" : "center"}
            style={s.label}
            maxFontSizeMultiplier={0}
          >
            {label}
          </Text>
        )}
      </View>
      {reason ? (
        <Text role="label" tone={textTone} align="center" maxFontSizeMultiplier={0}>
          {reason}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: t.hit,
      justifyContent: "center",
      borderRadius: t.radius.md,
      paddingHorizontal: t.space.lg,
      paddingVertical: t.space.sm,
      borderWidth: t.extent.focus,
      borderColor: t.color.surfacePrimary,
      gap: t.space.xs,
      maxWidth: "100%",
    },
    // A control in the native header is a word in the header's own band, so its
    // edge is painted in that band: the border the base carries survives, in the
    // colour it sits on, which is what leaves no frame at rest and still leaves the
    // ring's mechanism — a border to recolour — for a keyboard user's focus.
    header: { paddingHorizontal: t.space.sm, borderRadius: 0, borderColor: t.color.surfaceCanvas },
    primary: { backgroundColor: t.color.accentDefault, borderColor: t.color.accentDefault },
    destructive: { backgroundColor: t.color.statusDanger, borderColor: t.color.statusDanger },
    secondary: {
      borderColor: t.state.outline,
      backgroundColor: t.color.surfacePrimary,
    },
    // A plain control is a word in the page's own column of words, so it begins
    // where that column begins; centring it would float an action in the middle
    // of the space around it.
    plain: {
      paddingHorizontal: t.space.sm,
      borderColor: t.color.surfaceCanvas,
      justifyContent: "flex-start",
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: t.space.sm,
    },
    // A plain control sits in a column of words, so its word begins where that column
    // begins. The centred arrangement belongs to a control that stands alone; kept
    // here it drew the chart's six read-out rows, the commerce page's three verbs and
    // a page's one disclosure label as captions floating in the middle of the width
    // around them, which is what the captures of those specimens named.
    plainContent: { justifyContent: "flex-start" },
    label: { flexShrink: 1 },
    // The one that stands: the kit's selection tint under the label, with the accent
    // edge saying the same fact a second way. Both pairs are in the theme's registry
    // — the label's ink and the accent edge are each measured on state.selected.
    picked: { borderColor: t.color.accentDefault, backgroundColor: t.state.selected },
    // A glyph alone keeps the whole hit area and spends none of it on padding
    // around a word that is not printed.
    mark: { paddingHorizontal: t.space.sm, minWidth: t.hit },
    focused: {
      borderColor: t.color.focus,
      outlineColor: t.color.focus,
      outlineWidth: t.extent.focus,
      outlineOffset: t.space.xs / 2,
    },
    hover: { backgroundColor: t.state.hovered },
    press: { backgroundColor: t.state.pressed },
    activeFilled: { backgroundColor: t.color.accentHover, borderColor: t.color.accentHover },
    off: {
      borderStyle: "dashed",
      borderColor: t.color.borderStrong,
      backgroundColor: t.state.disabled.fill,
    },
  });
