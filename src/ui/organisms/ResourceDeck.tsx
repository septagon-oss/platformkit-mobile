import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { deriveDeck, type DeckCardModel, type RecordPictures } from "../../core/record";
import { type Motion, type Presentation } from "../../core/present";
import type { Entry } from "../../core/catalog";
import type { DeckState, DeckTransition } from "../../core/deck";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Skeleton } from "../atoms/Skeleton";
import { Text } from "../atoms/Text";
import type { ImageRenderer } from "../molecules/MediaHero";
import { ProgressMeter } from "../molecules/ProgressMeter";
import { Screen } from "../templates/Screen";
import { useStyles, useTheme, type Theme } from "../theme";
import type { FinishingProps } from "./ResourceDetail";

/**
 * DeckMotionProps supplies the still surface and decorative labels to native motion.
 * Choices carry their captured operation; each transition settles once, including on cancellation.
 */
export interface DeckMotionProps {
  readonly children: React.ReactNode;
  readonly overlays: readonly { readonly direction: string; readonly content: React.ReactNode }[];
  readonly available: readonly string[];
  readonly motion: Motion;
  readonly transition: DeckTransition | undefined;
  readonly operation: number;
  readonly onChoose: (direction: string, operation?: number) => void;
  readonly onSettled: () => void;
}

export interface Props {
  readonly entry: Entry;
  readonly state: DeckState;
  readonly presentation: Presentation;
  readonly pictures?: RecordPictures;
  readonly renderImage?: ImageRenderer | undefined;
  readonly renderMotion?: React.ComponentType<DeckMotionProps> | undefined;
  readonly renderFinishing?: React.ComponentType<FinishingProps> | undefined;
  readonly onAction: (id: string, operation?: number) => void;
  readonly onSettled: () => void;
  readonly onFinishEnd: () => void;
  readonly onOpen: (id: string) => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
  readonly onBack: () => void;
  readonly focusRef?: React.Ref<View>;
  /**
   * header is what the owner of this deck's screen draws above the queue: a question, a roster,
   * a count of who has answered. The organism draws it and keeps no rule about it — props in,
   * elements out — because a second deck screen would be a second implementation of the deck.
   */
  readonly header?: React.ReactNode;
}

/** ResourceDeck draws a still, fully actionable pass; optional renderers add ink without owning decisions. */
export function ResourceDeck(props: Props) {
  const {
    entry,
    state,
    presentation,
    pictures,
    renderImage,
    renderMotion: MotionSurface,
    renderFinishing: Finishing,
    onAction,
    onSettled,
    onFinishEnd,
    onOpen,
    onRefresh,
    onRetry,
    onBack,
    focusRef,
    header,
  } = props;
  const s = useStyles(styles);
  const t = useTheme();
  const model = deriveDeck(entry, state, presentation, pictures);
  const top = model.stack[0];
  const surface = top ? (
    <DeckCard
      model={top}
      renderImage={renderImage}
      motion={presentation.motion}
      busy={model.busy}
      onAction={onAction}
      onOpen={() => {
        if (model.canOpen) onOpen(top.id);
      }}
      focusRef={focusRef}
    />
  ) : null;
  return (
    <Screen testID="resource-deck">
      <View style={s.page}>
        {header}
        {model.progress ? <ProgressMeter model={model.progress} testID="deck-progress" /> : null}
        <Text role="caption" accessibilityLiveRegion="polite" testID="deck-encouragement">
          {model.encouragement}
        </Text>
        {model.changed ? <Notice tone="info" text={model.changed} announcement="polite" /> : null}
        {model.unavailable ? (
          <Notice tone="info" text={model.unavailable} announcement="polite" />
        ) : null}
        {model.loading ? (
          <Skeleton label={model.loadingLabel} motion={presentation.motion} variant="media" />
        ) : null}
        {top ? (
          <View style={s.stack}>
            {model.stack
              .slice(1)
              .reverse()
              .map((card) => (
                <View
                  key={card.id}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    s.rear,
                    {
                      transform: [
                        {
                          translateY: t.space.sm * card.depth,
                        },
                        { scale: card.scale },
                      ],
                    },
                  ]}
                >
                  <DeckCard
                    model={card}
                    renderImage={renderImage}
                    motion="reduced"
                    busy
                    onAction={() => undefined}
                    onOpen={() => undefined}
                  />
                </View>
              ))}
            {MotionSurface ? (
              <MotionSurface
                available={model.available}
                motion={presentation.motion}
                transition={state.transition}
                operation={state.operation}
                onChoose={onAction}
                onSettled={onSettled}
                overlays={model.actions.map((a) => ({
                  direction: a.id,
                  content: <Badge label={a.label} tone={a.tone} />,
                }))}
              >
                {surface}
              </MotionSurface>
            ) : (
              surface
            )}
          </View>
        ) : null}
        {model.notice ? (
          <Notice
            text={model.notice}
            announcement="urgent"
            testID="deck-notice"
            {...(model.canRetry ? { action: { label: model.retry, onPress: onRetry } } : {})}
          />
        ) : null}
        {model.endTitle ? (
          <View
            ref={focusRef}
            accessible
            accessibilityRole="header"
            accessibilityLabel={model.endName}
            testID="deck-end"
            style={s.end}
          >
            <Text role="display">{model.endTitle}</Text>
            {model.counts.map((count, i) => (
              <Text key={i}>{count.label}</Text>
            ))}
            {model.finishing && Finishing ? (
              <Finishing tone="ok" motion={presentation.motion} onEnd={onFinishEnd} />
            ) : null}
          </View>
        ) : null}
        <View style={s.controls} testID="deck-actions">
          {model.actions.map((a) => (
            <Button
              key={a.id}
              label={a.label}
              icon={a.icon}
              tone={a.tone === "danger" ? "destructive" : "secondary"}
              disabled={!a.enabled}
              busy={a.busy}
              onPress={() => onAction(a.id)}
              testID={`deck-${a.id}`}
            />
          ))}
        </View>
        {model.canRefresh ? (
          <Button label={model.refresh} tone="plain" onPress={onRefresh} testID="deck-refresh" />
        ) : null}
        <Button label={model.back} tone="plain" onPress={onBack} testID="deck-back" />
      </View>
    </Screen>
  );
}

function DeckCard({
  model,
  renderImage,
  motion,
  busy,
  onAction,
  onOpen,
  focusRef,
}: {
  readonly model: DeckCardModel;
  readonly renderImage: ImageRenderer | undefined;
  readonly motion: Motion;
  readonly busy: boolean;
  readonly onAction: (id: string, operation?: number) => void;
  readonly onOpen: () => void;
  readonly focusRef?: React.Ref<View> | undefined;
}) {
  const s = useStyles(styles);
  return (
    <Pressable
      ref={focusRef}
      testID="deck-card"
      accessible
      accessibilityRole="button"
      accessibilityLabel={model.name}
      accessibilityState={{ disabled: busy, busy }}
      accessibilityActions={model.actions}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") {
          if (!busy) onOpen();
        } else onAction(event.nativeEvent.actionName);
      }}
      onPress={onOpen}
      style={s.card}
    >
      {model.image && renderImage && model.imageState !== "error" ? (
        <View style={s.picture}>{renderImage(model.image)}</View>
      ) : null}
      {model.imageState === "error" ? (
        <Text role="caption" tone="muted">
          {model.imageFailure}
        </Text>
      ) : null}
      <View style={s.words}>
        {model.status ? <Badge {...model.status} motion={motion} /> : null}
        <Text role="display">{model.title}</Text>
        {model.summary ? <Text tone="muted">{model.summary}</Text> : null}
        {model.facts.map((fact) => (
          <View key={fact.id} style={s.fact}>
            <Text role="caption" tone="muted">
              {fact.label}
            </Text>
            <Text>{fact.value}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { width: "100%", maxWidth: t.extent.pageColumn, alignSelf: "center", gap: t.space.md },
    stack: { position: "relative", marginBottom: t.space.lg },
    card: {
      minHeight: t.extent.cover,
      borderRadius: t.radius.lg,
      backgroundColor: t.color.surfacePrimary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.color.borderDefault,
      overflow: "hidden",
    },
    picture: { height: t.extent.hero, overflow: "hidden" },
    words: { padding: t.space.lg, gap: t.space.sm },
    fact: { gap: t.space.xs },
    rear: {
      transformOrigin: "bottom",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: "hidden",
      borderRadius: t.radius.lg,
    },
    controls: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm, justifyContent: "center" },
    end: { paddingVertical: t.space.xl, gap: t.space.md, alignItems: "center" },
  });
