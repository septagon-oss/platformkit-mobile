// ChoiceRows is a set of choices as one row each: the line a person scans is the
// line they choose, and the line standing on the answer carries the mark. It is
// what a sheet of orders and filters is made of — `Row` already draws a selected
// row and can promise nothing on press (`opens={false}`), so the only thing here is
// the radiogroup around them.
//
// The chips molecule is not this: a chip wraps, so ten choices become a wall and
// the eye cannot read down a column, which is what a sheet exists to fix.
import React from "react";
import { StyleSheet, View } from "react-native";
import type { ChoiceGroupModel } from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { Row } from "./Row";
import { useStyles, type Theme } from "../theme";

interface Props {
  readonly model: ChoiceGroupModel;
  readonly onChange: (id: string) => void;
  /** named says whether to draw the choice group's own word above its rows. */
  readonly named?: boolean;
  readonly testID?: string | undefined;
}

export function ChoiceRows({ model, onChange, named = true, testID }: Props) {
  const s = useStyles(styles);
  return (
    <View style={s.stack}>
      {named ? <Text role="label">{model.label}</Text> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={model.label}>
        {model.choices.map((choice) => (
          <Row
            key={choice.id}
            title={choice.label}
            selected={choice.selected}
            opens={false}
            {...(choice.enabled && choice.change ? { onPress: () => onChange(choice.id) } : {})}
            {...(testID ? { testID: `${testID}/${encodeURIComponent(choice.id)}` } : {})}
          />
        ))}
      </View>
      {model.issue ? <Notice text={model.issue.message} announcement="polite" /> : null}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({ stack: { gap: t.space.xs / 2 } });
