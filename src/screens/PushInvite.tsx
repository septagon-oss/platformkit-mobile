// PushInvite asks the one notification question, and asks it of the person rather than of
// the platform. The system prompt behind "Turn on" is answered once per install and appears
// whether or not anybody here wanted it asked, so the phone says why it wants the address,
// offers the two answers, and goes quiet for the rest of the session either way. Which of
// those states it is in is the shell's (`push`); this file adds no rule and no words of its
// own beyond the copy table's.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useShell } from "../shell";
import { Notice } from "../ui/atoms/Notice";
import { useFeedback } from "./useFeedback";

export function PushInvite() {
  const { push } = useShell();
  const copy = useFeedback().copy.kit;
  if (push.status === "unasked" && push.offer)
    return (
      <View pointerEvents="box-none" style={page.foot}>
        <Notice
          announcement="polite"
          icon="server"
          testID="push-invite"
          text={copy.pushInvite}
          tone="info"
          action={{
            label: copy.pushTurnOn,
            onPress: () => void push.turnOn(),
            tone: "primary",
            testID: "push-turn-on",
          }}
          secondary={{
            label: copy.pushNotNow,
            onPress: push.decline,
            tone: "secondary",
            testID: "push-not-now",
          }}
        />
      </View>
    );
  // The two sentences for an address this phone could not get: said once, where the offer
  // would have been, and never again for the same session — a phone nobody can send to keeps
  // every other door, so nothing here blocks, retries or repeats.
  if (push.status !== "refused" && push.status !== "unreachable") return null;
  return (
    <View pointerEvents="box-none" style={page.foot}>
      <Notice
        announcement="polite"
        icon="server"
        testID="push-refused"
        text={copy.pushRefused}
        tone="info"
      />
    </View>
  );
}

const page = StyleSheet.create({
  // The foot of the page, over whatever is drawn there, holding nothing but the two answers
  // the notice itself offers.
  foot: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
