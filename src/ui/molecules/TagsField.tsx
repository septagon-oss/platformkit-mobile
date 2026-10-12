// TagsField is a list of words: each a chip that can go, and a place to add
// one. A return key or the Add control commits the word being typed; what is
// typed but not yet committed is part of the value, not state of its own, so a
// save that never blurred the input still carries it. The spelling is the
// comma-separated one the core splits, so the API contract is untouched — which
// is exactly why one item may not hold a comma: the box refuses a word that does,
// says so, keeps the text where the person can fix it, and never writes one word
// as two chips. What it refuses is not written into the value either, because a
// held value cannot tell a comma it stored from a comma somebody typed, and the
// meaning of one word is not the sheet's to guess.
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { entryHoldsSeparator, splitList } from "../../core/derive";
import type { KitWords } from "../../core/kitCopy";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";
import { Text } from "../atoms/Text";
import { TextField } from "../atoms/TextField";
import { testable } from "../props";
import { useStyles, useTheme, type Theme } from "../theme";

interface Props {
  readonly label: string;
  /**
   * announce is the field's accessible name as the sheet derived it — the label and
   * the word for whether it may be left empty ("Tags, Required"). Every other
   * control on the sheet is announced by that name, and a list field whose box says
   * only "Add to Tags" tells a person hearing it nothing about leaving the field
   * alone. Left unset it falls back to the box's own word, which is what a control
   * standing outside a form — the gallery's — has to say.
   */
  readonly announce?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly copy: Pick<KitWords, "addTag" | "addTagTo" | "removeTag" | "commaInValue">;
  /**
   * onRefused tells the sheet that the word in this box is one it will not write,
   * for as long as it stands there. The sentence is drawn here, where the text is;
   * the report is the sheet's to act on, because a save that sent the last word the
   * box accepted would close over the text still in the box and lose what the person
   * is being asked to fix.
   */
  readonly onRefused?: (refused: boolean) => void;
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function TagsField({
  label,
  announce,
  value,
  onChange,
  copy,
  onRefused,
  disabled = false,
  testID,
}: Props) {
  const t = useTheme();
  const s = useStyles(styles);
  // What is being typed is held here and shown as it is typed; the value carries
  // it whenever it could be stored, so a save that never blurred the input still
  // has it. `pending` remembers the word the box last *wrote* into the value, and
  // the chips are the value beyond that word — not beyond what stands in the box,
  // because a refused keystroke changes the box and writes nothing: strip the draft
  // instead and the last accepted prefix ("be" of the half-typed "be,ta") counts as
  // a chip nobody added, with the corrected word landing beside it. Stripping what
  // was written means a record as the server has it still arrives as chips and
  // nothing half-typed, and a refusal still writes nothing at all.
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");
  // The one refusal this control can answer for itself: it names the text in the
  // box, it is corrected by the person who typed it, and a keystroke clears it.
  const [refused, setRefused] = useState(false);
  const fault = refused ? copy.commaInValue : "";
  const base = value.endsWith(pending) ? value.slice(0, value.length - pending.length) : value;
  const tags = splitList(base);
  const tagKey = label.toLowerCase();

  /** store writes the chips the sheet is to hold, with `tail` as the word still being typed. */
  const store = (next: readonly string[], tail: string) => {
    setPending(tail);
    onChange(next.length > 0 ? `${next.join(", ")}, ${tail}` : tail);
  };

  /** A committed word leaves the box empty: its chip carries it from here on. */
  const committed = (next: readonly string[]) => {
    setDraft("");
    store(next, "");
  };

  // The box shows whatever was typed; only a word that could be stored is written.
  // Refusing is one decision, told to the sheet once when it starts and once when
  // the person's next keystroke ends it, and it writes nothing: the tail the box
  // left in the value stands until the next accepted keystroke overwrites it, and
  // the sheet refuses the save for as long as the refused word is on screen.
  const typing = (typed: string) => {
    const holds = entryHoldsSeparator(typed);
    setDraft(typed);
    if (holds !== refused) {
      setRefused(holds);
      onRefused?.(holds);
    }
    if (!holds) store(tags, typed);
  };

  const commit = () => {
    const entry = draft.trim();
    // Nothing to add is not a refusal: no chip, no write, the sheet unchanged.
    if (entry === "") return;
    if (entryHoldsSeparator(entry)) {
      setRefused(true);
      onRefused?.(true);
      return;
    }
    setRefused(false);
    onRefused?.(false);
    // A word already on the sheet is the chip the person asked for: adding it
    // twice would only hide the box they can still correct. The comparison folds
    // case, because "Work" and "work" are one tag spelled twice; the chip keeps
    // the spelling it was first given.
    if (tags.some((tag) => tag.toLowerCase() === entry.toLowerCase())) {
      committed(tags);
      return;
    }
    committed([...tags, entry]);
  };

  return (
    <View style={s.field} {...testable(testID)}>
      {tags.length > 0 ? (
        <View style={s.chips} accessibilityRole="list">
          {tags.map((tag) => (
            <View key={tag} style={s.chip}>
              <Text role="label">{tag}</Text>
              {disabled ? null : (
                <Pressable
                  // The word being typed keeps its place in the value — the tail it
                  // was written as, which is the box's own text whenever the box will
                  // write it, and the last word it accepted whenever it will not.
                  onPress={() =>
                    store(
                      tags.filter((x) => x !== tag),
                      pending,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={copy.removeTag(tag)}
                  hitSlop={t.space.sm}
                >
                  <Icon name="close" size="sm" tone="muted" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : null}
      <View style={s.entry}>
        <TextField
          kind="mono"
          value={draft}
          onChangeText={typing}
          onSubmitEditing={commit}
          blurOnSubmit={false}
          placeholder={copy.addTagTo(label)}
          accessibilityLabel={announce ?? copy.addTagTo(label)}
          disabled={disabled}
          returnKeyType="done"
          testID={`tags-${tagKey}`}
        />
        {/* A control that cannot act is not drawn: a read-only list is its chips alone. */}
        {disabled ? null : (
          <Button
            label={copy.addTag}
            icon="add"
            tone="plain"
            name={copy.addTagTo(label)}
            onPress={commit}
            testID={`add-${tagKey}`}
          />
        )}
      </View>
      {fault ? (
        <Text
          role="caption"
          tone="danger"
          accessibilityLiveRegion="polite"
          {...testable(`tags-fault-${tagKey}`)}
        >
          {fault}
        </Text>
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    field: { gap: t.space.sm },
    entry: { flexDirection: "row", alignItems: "center", gap: t.space.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space.xs,
      borderRadius: t.radius.full,
      paddingLeft: t.space.md,
      paddingRight: t.space.sm,
      paddingVertical: t.space.xs,
      backgroundColor: t.color.surfaceMuted,
    },
  });
