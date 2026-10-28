// Swatch is one colour a person reads: a disc filled with the colour itself and named with the word
// the server gave it. It answers no press — the colour is a fact about the line beside it, not an act
// — and it carries its name even where no eye can see the disc, because "Ivory straight trousers"
// without the colour it is painted in names one garment out of four.
//
// The hairline edge is drawn on every disc rather than on the pale ones alone: which shade is too
// pale to hold its own shape is a question about the page underneath, and one rule drawn uniformly
// cannot be wrong for one colour and right for another.
import React from "react";
import { StyleSheet, View } from "react-native";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  /** colour is the shade as its source spells it — a data colour, not one of the page's roles. */
  readonly colour: string;
  /** label is the colour's own word, spoken in place of the disc. */
  readonly label: string;
  /** side is the disc's diameter; the default is the small disc a line of text carries. */
  readonly side?: number;
  readonly testID?: string;
}

export function Swatch({ colour, label, side, testID }: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  const disc = side ?? t.extent.avatarSmall;
  return (
    <View
      style={[s.disc, { width: disc, height: disc, backgroundColor: colour }]}
      accessible
      accessibilityLabel={label}
      {...testable(testID)}
    />
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    disc: { borderRadius: t.radius.full, borderWidth: StyleSheet.hairlineWidth },
  });
