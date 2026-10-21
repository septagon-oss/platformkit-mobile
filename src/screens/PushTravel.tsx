// PushTravel opens what a tapped notification points at. The kernel sends the words already
// rendered and the address they are about (`kit/push/providers/expo/expo.go` puts the link in
// the token payload), and opening it is this app's job, not the push module's — so a tap
// arrives at the same reading a link in an e-mail does, and lands on the same screens, with
// the same refusal under it. One notification tap is one arrival: a response already opened
// is never opened twice, and one the rule will not route navigates nowhere.
import { DEFAULT_ACTION_IDENTIFIER, useLastNotificationResponse } from "expo-notifications";
import { useRouter } from "expo-router";
import { collectManifestSchemes } from "expo-linking";
import { useEffect, useRef } from "react";
import { systemHref } from "../core/arrival";

export function PushTravel() {
  const response = useLastNotificationResponse();
  const router = useRouter();
  // The tap this component already opened. The hook keeps answering the same response for as
  // long as the app is alive — that is what makes a killed app's tap arrive at all — so the
  // navigation is keyed by the notification, not by the render.
  const opened = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (response == null || response.notification === undefined) return;
    if (response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) return;
    const link = response.notification.request.content.data?.["link"];
    if (typeof link !== "string") return;
    const at = `${response.notification.request.identifier}|${link}`;
    if (opened.current === at) return;
    const href = systemHref(link, collectManifestSchemes());
    if (href === undefined) return;
    opened.current = at;
    router.replace(href);
  }, [response, router]);
  return null;
}
