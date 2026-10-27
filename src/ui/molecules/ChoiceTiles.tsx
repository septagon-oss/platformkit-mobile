// ChoiceTiles is a set of choices as cards in a grid: the answer's own artwork is the largest
// thing on the card, because a person chooses a tile by its picture.
//
// The chips molecule is not this: a chip's artwork is a mark beside its word, and a wall of
// pictures cannot be scanned. The card a person chose is drawn chosen, in the kit's own
// treatment (`kitStyles.selected`).
import React from "react";
import { Pressable, StyleSheet, View, type AccessibilityState } from "react-native";
import { pickChoice, type ChoiceGroupModel } from "../../core/derive";
import { kitStyles } from "../layout";
import { Text } from "../atoms/Text";
import { testable } from "../props";
import { hit } from "../scale";
import { useStyles, type Theme } from "../theme";
import { ChoiceFooting, ChoiceLegend, type ChoiceSurfaceProps } from "./ChoiceSurface";

export function ChoiceTiles({ model, onChange, onTick, testID }: ChoiceSurfaceProps) {
  const k = useStyles(kitStyles),
    s = useStyles(styles);
  return (
    <View style={k.stack}>
      <ChoiceLegend model={model} onClear={() => onChange([])} />
      <View style={s.grid}>
        {model.choices.map((choice) => (
          <Pressable
            key={choice.id}
            accessibilityRole={model.many ? "checkbox" : "radio"}
            accessibilityLabel={choice.label}
            aria-checked={choice.selected}
            accessibilityState={surfaceState(choice)}
            {...testable(testID ? `${testID}/${encodeURIComponent(choice.id)}` : undefined)}
            style={[s.card, choice.selected ? s.chosen : null]}
            disabled={!choice.enabled}
            onPress={() => {
              if (!choice.change) return;
              onTick?.();
              onChange(pickChoice(model, choice.id));
            }}
          >
            <View
              style={[s.frame, choice.picture ? { backgroundColor: choice.picture.colour } : null]}
            />
            <Text role="label">{choice.label}</Text>
          </Pressable>
        ))}
      </View>
      <ChoiceFooting model={model} />
    </View>
  );
}

const surfaceState = (choice: ChoiceGroupModel["choices"][number]): AccessibilityState => ({
  disabled: !choice.enabled,
  selected: choice.selected,
  checked: choice.selected,
});

const styles = (t: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm },
    card: {
      flexGrow: 1,
      flexBasis: 120,
      gap: t.space.xs,
      padding: t.space.md,
      minWidth: hit,
      minHeight: hit,
      borderRadius: t.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.color.borderDefault,
      backgroundColor: t.color.surfacePrimary,
    },
    chosen: { borderColor: t.color.focus, borderWidth: t.extent.focus },
    // The artwork is the card: it takes the card's own width and the height a picture needs,
    // and the word sits under it rather than beside it.
    frame: { width: "100%", height: t.space.xl * 3, borderRadius: t.radius.md },
  });
