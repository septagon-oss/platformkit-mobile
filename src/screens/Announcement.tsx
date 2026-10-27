// Announcement draws what a write just did for the person standing where they are, and only for as
// long as they are reading it. The filing is the shell's (`report`, `reporting`, `spent`), the
// sentence is the command's own, and the state around it is derived where every other state is
// derived: this file adds no words, no tone and no rule about what counts as done.
//
// The bar is the receipt of an act that is already over, so nothing that happens after it was
// filed takes it away: navigating, unmounting the list that asked for it, a re-read or a pull to
// refresh all leave it standing, because leaving the screen where something happened does not
// un-happen it. What does spend it is its own clock, and `forget`, which ends what a session that
// is going away will never be shown again.
import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { deriveState } from "../core/present";
import { Snackbar } from "../ui/molecules/Snackbar";
import { StateFeedback } from "./StateFeedback";
import { useFeedback } from "./useFeedback";
import { useShell } from "../shell";

/**
 * hold is how long a receipt stays: long enough to be read once where the act happened, short
 * enough that nobody is handed a receipt for something they stopped looking at. One length for
 * every sentence — the bar never speaks for longer because its sentence is long, and a person who
 * needs the fact again finds it on the record.
 */
const hold = 4000;

/** away is how long it takes to leave once its own clock ran out: the same ink, given a moment. */
const away = 220;

export function Announcement() {
  const { reporting, spent } = useShell();
  const feedback = useFeedback();
  const [fade] = useState(() => new Animated.Value(1));
  // Read on every render the shell hands this component, the way a record reads the sentence its
  // own write filed. The filing carries the token this bar may spend, and no other.
  const filed = reporting();
  useEffect(() => {
    if (filed === undefined) return;
    // The clock starts from the frame this bar first drew this sentence, not from the moment the
    // write was answered: a receipt that arrived late is not owed less time on screen than one
    // that arrived at once. A filing that replaces one on screen starts a new clock of its own.
    fade.setValue(1);
    const timer = setTimeout(() => {
      if (feedback.motion !== "normal") {
        spent(filed.token);
        return;
      }
      Animated.timing(fade, { toValue: 0, duration: away, useNativeDriver: true }).start(() =>
        spent(filed.token),
      );
    }, hold);
    return () => clearTimeout(timer);
  }, [fade, filed, spent, feedback.motion]);
  if (filed === undefined) return null;
  // The week the pages of this app start on, as every generated screen reads it.
  const presentation = { ...feedback, weekStartsOn: 1 as const };
  const model = deriveState({ kind: "success", body: filed.sentence }, presentation);
  if (!model.ok) return null;
  return (
    // The foot of the page, over whatever is drawn there, holding nothing a press could land on:
    // the bar says one thing and answers no touch, so the screen under it stays that screen.
    <View pointerEvents="box-none" style={page.foot}>
      <Animated.View pointerEvents="box-none" style={{ opacity: fade }}>
        {/* The token is the bar's identity, not the sentence: two rows of one list resolved back
            to back file the same words, and a reader who was told the first is owed the second.
            Keying on the filing remounts the surface, which is what makes an identical sentence
            a new fact rather than one the reader already heard. */}
        <Snackbar
          key={filed.token}
          model={model.value}
          renderState={StateFeedback}
          testID="snackbar"
        />
      </Animated.View>
    </View>
  );
}

const page = StyleSheet.create({
  // The bar is drawn over the page rather than in its flow; the card inside it carries the page's
  // own gutter and the safe area under it.
  foot: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
