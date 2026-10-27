import React, { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, findNodeHandle, Platform, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { ScreenProps } from "../renderers";
import { reviewDeck } from "../core/deck";
import type { Deck } from "../core/catalogDeck";
import { deriveDeck, screenPath } from "../core/record";
import { useShell } from "../shell";
import { Notice } from "../ui/atoms/Notice";
import { Screen } from "../ui/templates/Screen";
import { ResourceDeck as DeckView } from "../ui/organisms/ResourceDeck";
import { extent } from "../ui/scale";
import { useFeedback } from "./useFeedback";
import { usePictures } from "./usePictures";
import { useResourceDeck, type DeckReceipt } from "./useResourceDeck";

export function ResourceDeck({ entry }: ScreenProps) {
  const { api, baseURL, identity } = useShell();
  const feedback = useFeedback();
  const deck = reviewDeck(entry);
  const binding = JSON.stringify([
    baseURL,
    identity?.userId,
    api.bearer()?.id,
    entry.module,
    entry.entity,
    deck,
    entry.commands,
    entry.operations,
    entry.fields,
    entry.hints,
  ]);
  if (!deck)
    return (
      <Screen>
        <Notice text={feedback.copy.review.unavailable} announcement="polite" />
      </Screen>
    );
  return <DeckSession key={binding} entry={entry} deck={deck} />;
}

/**
 * DeckSession is one pass through a declared deck: the machine, its pictures and its organism.
 * A renderer pack that owns a deck composes this rather than a copy of it, and may hand two things
 * the generated screen has no use for — a `header` drawn above the queue, and a `receipt` saying
 * what makes this deck's commands answer and what their rows supply.
 */
export function DeckSession({
  entry,
  deck,
  header,
  receipt,
}: ScreenProps & {
  readonly deck: Deck;
  readonly header?: React.ReactNode;
  readonly receipt?: DeckReceipt;
}) {
  const feedback = useFeedback();
  const { media } = useShell();
  const router = useRouter();
  const session = useResourceDeck(entry, deck, feedback.copy, !!media?.deck, receipt);
  const { state, finishEnd } = session;
  const presentation = { ...feedback, weekStartsOn: 1 as const };
  const model = deriveDeck(entry, state, presentation, { files: {}, states: {} });
  const pictures = usePictures(
    model.stack.flatMap((card) => (card.image ? [card.image.id] : [])),
    state.operation,
    extent.cover,
  );
  const focus = useRef<View>(null);
  const progress = state.phase === "ready" || model.endTitle ? model.progress?.text : undefined;
  const spokenChoices = useRef(0);
  useEffect(() => {
    if (!progress || spokenChoices.current === state.history.length) return;
    spokenChoices.current = state.history.length;
    if (Platform.OS === "ios")
      AccessibilityInfo.announceForAccessibilityWithOptions(progress, { queue: true });
  }, [progress, state.history.length]);
  const encouragement = model.encouragement;
  useEffect(() => {
    if (Platform.OS === "ios" && encouragement)
      AccessibilityInfo.announceForAccessibilityWithOptions(encouragement, { queue: true });
  }, [encouragement]);
  useEffect(() => {
    if (Platform.OS === "ios" && state.notice)
      AccessibilityInfo.announceForAccessibilityWithOptions(state.notice, { queue: false });
  }, [state.notice]);
  const settledTop = state.phase === "ready" ? state.active[0] : model.endTitle;
  useEffect(() => {
    if (!settledTop) return;
    if (Platform.OS === "web") {
      focus.current?.focus();
      return;
    }
    const node = focus.current && findNodeHandle(focus.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [settledTop, state.notice]);
  const title = feedback.copy.review.title;
  const options = useMemo(() => ({ title, headerLargeTitleEnabled: false }), [title]);
  useEffect(() => {
    if (state.finishing && (!media?.finishing || !model.finishing)) finishEnd();
  }, [state.finishing, model.finishing, media?.finishing, finishEnd]);
  return (
    <>
      <Stack.Screen options={options} />
      <DeckView
        entry={entry}
        state={state}
        presentation={presentation}
        pictures={{ states: pictures.states, files: pictures.files }}
        renderImage={pictures.enabled ? pictures.renderImage : undefined}
        renderMotion={media?.deck}
        renderFinishing={media?.finishing}
        onAction={session.action}
        onSettled={session.settled}
        onFinishEnd={session.finishEnd}
        focusRef={focus}
        onOpen={(id) => {
          session.suspend();
          router.push(`${screenPath(entry)}/${encodeURIComponent(id)}`);
        }}
        onRefresh={session.refresh}
        onRetry={session.retry}
        onBack={() => (router.canGoBack() ? router.back() : router.replace(screenPath(entry)))}
        {...(header === undefined ? {} : { header })}
      />
    </>
  );
}
