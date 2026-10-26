// ChoiceSurface holds the two lines every appearance of a finite choice draws around its
// answers, so no appearance writes them twice: the question's name with the reset that belongs
// to it, and the footing where a refusal is said. The answers themselves are each molecule's.
import React from "react";
import { StyleSheet, View } from "react-native";
import type { ChoiceGroupModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { useStyles, type Theme } from "../theme";

/**
 * ChoiceSurfaceProps is what every appearance is handed: the derived choice, what a change
 * means, and the felt tick a change is worth. `onChange` carries the whole held answer set —
 * one id for a single-answer choice, the ordered list for a many-answer one, an empty list
 * when the question is cleared — because which of those the cardinality allows is the
 * catalogue's answer, not the molecule's.
 */
export interface ChoiceSurfaceProps {
  readonly model: ChoiceGroupModel;
  readonly onChange: (ids: readonly string[]) => void;
  /** onTick lets the screen feel a change. A molecule may not reach a transport (AGENTS.md), so the hook that owns the haptics supplies it. */
  readonly onTick?: () => void;
  readonly testID?: string | undefined;
}

/** ChoiceLegend names the question. Its reset shares the name's line: on its own full-width row it reads as one more answer to choose. */
export function ChoiceLegend({
  model,
  onClear,
}: {
  readonly model: ChoiceGroupModel;
  readonly onClear: () => void;
}) {
  const s = useStyles(styles);
  return (
    <View style={s.spread}>
      <Text role="label">{model.label}</Text>
      {model.canClear ? <Button label={model.clearLabel} tone="plain" onPress={onClear} /> : null}
    </View>
  );
}

/**
 * ChoiceFooting says what the held answers refuse: first a selection that is no longer offered,
 * then the sentence the server declares for the empty answer it will not take. Neither is
 * drawn while the question is answered.
 */
export function ChoiceFooting({ model }: { readonly model: ChoiceGroupModel }) {
  return (
    <>
      {model.issue ? <Notice text={model.issue.message} announcement="polite" /> : null}
      {model.reason !== undefined && !model.satisfied ? (
        <Notice text={model.reason} announcement="polite" />
      ) : null}
    </>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    spread: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.space.sm,
    },
  });
