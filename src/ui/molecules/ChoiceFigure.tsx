// ChoiceFigure is a finite choice drawn on its own compiled artwork: the server composes one
// picture whose marks stand for the answers (`kit/entity/picture.Figure`), and the person
// chooses by reading that picture. The artwork is drawn as it arrived and is silent to a screen
// reader; the answers below it carry the names, the roles and the touch targets, which is what
// makes an artwork you can only look at into a question you can answer.
//
// ChoiceTiles is not this: a tile gives every answer its own picture, and the answers can
// therefore be the cards. Here one picture stands for all of them.
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { parse, SvgAst } from "react-native-svg";
import { pickChoice } from "../../core/derive";
import { kitStyles } from "../layout";
import { testable } from "../props";
import { hit } from "../scale";
import { useStyles, type Theme } from "../theme";
import { Text } from "../atoms/Text";
import { Button } from "../atoms/Button";
import { ChoiceFooting, ChoiceLegend, type ChoiceSurfaceProps } from "./ChoiceSurface";

export function ChoiceFigure({ model, onChange, onTick, testID }: ChoiceSurfaceProps) {
  const k = useStyles(kitStyles),
    s = useStyles(styles);
  const artwork = model.artwork;
  // The compiled figure is drawn as it arrived, and a picture the parser cannot read is a
  // picture that draws nothing: the answers below stay readable either way.
  const ast = useMemo(() => {
    if (artwork === undefined) return null;
    try {
      const parsed = parse(artwork.svg);
      return parsed?.tag === "svg" ? parsed : null;
    } catch {
      return null;
    }
  }, [artwork]);
  return (
    <View style={k.stack}>
      <ChoiceLegend model={model} onClear={() => onChange([])} />
      {artwork === undefined ? (
        <Text tone="muted">{model.label}</Text>
      ) : (
        <View style={s.frame} accessibilityElementsHidden>
          {ast === null ? null : (
            <SvgAst ast={ast} override={{ width: "100%", height: "100%", accessible: false }} />
          )}
        </View>
      )}
      <View
        accessibilityRole={model.many ? undefined : "radiogroup"}
        accessibilityLabel={model.label}
      >
        {model.choices.map((choice) => (
          <View
            key={choice.id}
            style={s.line}
            {...testable(testID ? `${testID}/${choice.id}` : undefined)}
          >
            <Button
              label={choice.label}
              tone={choice.selected ? "primary" : "secondary"}
              accessibilityRole={model.many ? "checkbox" : "radio"}
              checked={choice.selected}
              disabled={!choice.enabled}
              {...(choice.reason ? { reason: choice.reason } : {})}
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
    // The artwork takes the width the question is drawn in and keeps its own shape; it never
    // grows past the page, which is why the frame has no height of its own.
    frame: { width: "100%", overflow: "hidden" },
    line: { minHeight: hit, justifyContent: "center" },
  });
