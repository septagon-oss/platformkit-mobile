// Android/web use the atom's live region. iOS announcements are a screen
// effect, so the shared UI stays props in and elements out.
import React, { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { StateView, type Props } from "../ui/molecules/StateView";

export function StateFeedback(props: Props) {
  const { kind, announcement, announcementText } = props.model;
  useEffect(() => {
    if (Platform.OS === "ios" && announcement !== "none")
      AccessibilityInfo.announceForAccessibilityWithOptions(announcementText, {
        queue: announcement === "polite",
      });
  }, [kind, announcement, announcementText]);
  return <StateView {...props} />;
}
