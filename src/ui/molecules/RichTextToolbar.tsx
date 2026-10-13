// RichTextToolbar is the row of controls a rich text body is written with: the marks this
// phone's own reader draws back, and the picture the body may point at. Props in, elements
// out — the labels are the reader's words, and what a press does to the draft belongs to
// whoever holds the draft, which is why no rule about Markdown lives here.
import React from "react";
import { StyleSheet, View } from "react-native";
import type { KitWords } from "../../core/kitCopy";
import { Button } from "../atoms/Button";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

/** Actions are what each control asks for: a mark on the chosen words, or a file to place. */
export interface RichTextActions {
  readonly onBold: () => void;
  readonly onItalic: () => void;
  readonly onHeading: () => void;
  readonly onList: () => void;
  /** onImage is offered only where a surface can ask for a file: no handler, no control. */
  readonly onImage?: (() => void) | undefined;
}

interface Props {
  readonly copy: KitWords;
  readonly actions: RichTextActions;
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function RichTextToolbar({
  copy,
  actions,
  disabled = false,
  testID = "richtext-toolbar",
}: Props) {
  const s = useStyles(styles);
  const marks: readonly [string, string, () => void][] = [
    ["bold", copy.bold, actions.onBold],
    ["italic", copy.italic, actions.onItalic],
    ["heading", copy.heading, actions.onHeading],
    ["list", copy.bulletList, actions.onList],
  ];
  return (
    <View accessible accessibilityLabel={copy.formatting} style={s.row} {...testable(testID)}>
      {marks.map(([id, label, press]) => (
        <Button
          key={id}
          label={label}
          tone="plain"
          onPress={press}
          disabled={disabled}
          testID={`${testID}-${id}`}
        />
      ))}
      {actions.onImage === undefined ? null : (
        <Button
          label={copy.image}
          tone="plain"
          onPress={actions.onImage}
          disabled={disabled}
          testID={`${testID}-image`}
        />
      )}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: t.space.xs },
  });
