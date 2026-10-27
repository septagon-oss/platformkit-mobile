// SaveButton is the one control a person has over their own copy of a record: the mark
// says whether a copy is kept, the word beside it is the one the catalogue declared for
// this entry, and this file decides neither. The pressed state changes the mark's fill and
// not its colour, so the two states are told apart by something a colour-blind reader and
// a greyscale screenshot both keep. It draws nothing about whether a copy exists: the
// screen that asked hands over the model, and a control with nothing to say about the
// record is not drawn at all — see `useSaveToggle`.
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import type { Motion } from "../../core/derive";
import { testable } from "../props";
import { useStyles, type Theme } from "../theme";

/** SaveButtonModel is one record's keeping state, in the words the declaration carries. */
export interface SaveButtonModel {
  /** label is the declaration's own word: the keep word, or the kept word when a copy is there. */
  readonly label: string;
  readonly kept: boolean;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  /** note is the one sentence under the control: where it is, and nothing else. */
  readonly note?: string;
  readonly motion?: Motion;
  readonly testID?: string;
}

interface Props {
  readonly model: SaveButtonModel;
  readonly onPress: () => void;
}

export function SaveButton({ model, onPress }: Props) {
  const { label, kept, busy = false, disabled = false, note, motion = "reduced", testID } = model;
  const s = useStyles(styles);
  return (
    <View style={s.wrap}>
      <Button
        label={label}
        // A press while one is under way, or while the answer has not arrived, changes
        // nothing, so the control says so rather than taking the press and doing nothing.
        onPress={onPress}
        tone={kept ? "primary" : "secondary"}
        icon={kept ? "heartFilled" : "heart"}
        busy={busy}
        disabled={disabled || busy}
        motion={motion}
        selected={kept}
        {...testable(testID)}
      />
      {note ? (
        <Text role="caption" tone="muted">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { alignSelf: "flex-start", gap: t.space.xs / 2 },
  });
