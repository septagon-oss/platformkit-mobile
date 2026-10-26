// ChoiceChips is a finite choice as a wrapping line of answers: the word a person reads is the
// word they tap. With `swatch` the answer's own colour stands where its mark would, which is
// the only difference the kernel's `swatch` appearance asks for — the same answers, the same
// line, the same roles (decision recorded in the task's notes: a swatch is a chip whose artwork
// is a colour, not a fourth layout).
//
// ChoiceTiles is not this: a tile is a card whose picture is the answer, and ten chips wrap
// into a wall the eye cannot read down.
import React from "react";
import { StyleSheet, View } from "react-native";
import { pickChoice, type ChoiceGroupModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { testable } from "../props";
import { hit } from "../scale";
import { useStyles, type Theme } from "../theme";
import { ChoiceFooting, ChoiceLegend, type ChoiceSurfaceProps } from "./ChoiceSurface";

interface Props extends ChoiceSurfaceProps {
  /** swatch draws each answer's declared colour beside its word; the answers and the roles do not change. */
  readonly swatch?: boolean;
}

export function ChoiceChips({ model, onChange, onTick, testID, swatch = false }: Props) {
  const k = useStyles(kitStyles),
    s = useStyles(styles);
  const role = model.many ? ("checkbox" as const) : ("radio" as const);
  return (
    <View style={k.stack}>
      <ChoiceLegend model={model} onClear={() => onChange([])} />
      <View
        style={[k.row, swatch ? s.swatchRow : null]}
        accessibilityRole={model.many ? undefined : "radiogroup"}
        accessibilityLabel={model.label}
      >
        {model.choices.map((choice) => (
          <View key={choice.id} style={swatch ? s.swatch : undefined}>
            {swatch && choice.picture ? (
              <View style={[s.chip, { backgroundColor: choice.picture.colour }]} />
            ) : null}
            <Button
              label={choice.label}
              tone={choice.selected ? "primary" : "secondary"}
              accessibilityRole={role}
              checked={choice.selected}
              disabled={!choice.enabled}
              {...(choice.reason ? { reason: choice.reason } : {})}
              {...(testID ? { testID: `${testID}/${encodeURIComponent(choice.id)}` } : {})}
              onPress={() => {
                if (!choice.change) return;
                onTick?.();
                onChange(pickChoice(model, choice.id));
              }}
            />
          </View>
        ))}
      </View>
      <ChoiceFooting model={model} />
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    swatchRow: { gap: t.space.md },
    swatch: { flexDirection: "row", alignItems: "center", gap: t.space.sm, minHeight: hit },
    // A colour is drawn at the size a fingertip can aim at beside it, and it carries no
    // meaning of its own: the word beside it is the answer's name.
    chip: { width: hit, height: hit / 2, borderRadius: t.radius.md },
  });
