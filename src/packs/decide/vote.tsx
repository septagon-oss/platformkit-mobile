// VoteDeck is Review mode over one question's options. The deck itself — its directions, tilt,
// progress, rewind rule, still and reduced-motion forms — is the generated session's, unchanged.
// What this file adds is the question's own header (who has answered) and the moment an option
// turns out to be one the group agrees on, which is a state of this screen and not a route:
// dismissing it returns to the deck the person was voting in.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { reviewDeck } from "../../core/deck";
import { nameKey, personPointers } from "../../core/derive";
import { rowAt } from "../../core/reentry";
import { avatarStack, type Person } from "../../core/pictures";
import { DeckSession } from "../../screens/ResourceDeck";
import type { ScreenProps } from "../../renderers";
import { useFeedback } from "../../screens/useFeedback";
import { usePictures } from "../../screens/usePictures";
import { useDirectoryPeople } from "../../screens/useReferenceNames";
import { useShell } from "../../shell";
import { Button } from "../../ui/atoms/Button";
import { Notice } from "../../ui/atoms/Notice";
import { Text } from "../../ui/atoms/Text";
import { AvatarStack } from "../../ui/molecules/AvatarStack";
import { Screen } from "../../ui/templates/Screen";
import { useStyles, type Theme } from "../../ui/theme";
import { extent } from "../../ui/scale";
import { agreed, matched, useQuestionResults, voterFaces } from "./read";

/**
 * VoteDeck runs the deck the card entry declares, narrowed to one question when the route names
 * one. Without that parameter the same screen is the cross-question inbox the entry's own queue
 * answers. A ballot answers with the ballot rather than with the card, so the deck's receipt is
 * that the answer names an option at all: `optionId` is the ballot's statement of which option it
 * is, and an answer naming none is held as uncertain rather than accepted.
 */
export function VoteDeck({ entry }: ScreenProps) {
  const feedback = useFeedback();
  const router = useRouter();
  const { question } = useLocalSearchParams<{ question?: string }>();
  const [ballots, setBallots] = useState(0);
  const declared = useMemo(() => reviewDeck(entry), [entry]);
  const deck = useMemo(
    () =>
      declared === undefined || question === undefined
        ? declared
        : { ...declared, queue: [...declared.queue, `questionId:${question}`] },
    [declared, question],
  );
  const onAccepted = useCallback(() => setBallots((was) => was + 1), []);
  const receipt = useMemo(
    () => ({
      accepted: (_id: string, row: Record<string, unknown>) => row.optionId !== undefined,
      onAccepted,
    }),
    [onAccepted],
  );
  if (deck === undefined)
    return (
      <Screen>
        <Notice text={feedback.copy.review.unavailable} announcement="polite" />
      </Screen>
    );
  return (
    <DeckSession
      entry={entry}
      deck={deck}
      receipt={receipt}
      {...(question === undefined
        ? {}
        : {
            header: (
              <VoterHeader
                questionId={question}
                ballots={ballots}
                onVoted={onAccepted}
                onResults={() => router.push(rowAt("decide", "questions", question))}
              />
            ),
          })}
    />
  );
}

/**
 * VoterHeader draws who has answered, and the match when one arrives. Both come from the same read
 * so the faces above the deck and the faces in the match cannot disagree. A match is *new* only when
 * the first answer the deck saw did not hold it — the module keeps its latch to itself
 * (`firstMatchedAt` is never printed), so the phone diffs two reads and never reads a field — and it
 * interrupts once per mount: leaving the moment records that match as seen, so a later read that
 * still holds it says nothing new.
 */
function VoterHeader({
  questionId,
  ballots,
  onVoted,
  onResults,
}: {
  readonly questionId: string;
  readonly ballots: number;
  readonly onVoted: () => void;
  readonly onResults: () => void;
}) {
  const feedback = useFeedback();
  const copy = feedback.copy.decide;
  const { state } = useShell();
  const s = useStyles(styles);
  const read = useQuestionResults(copy.questionTitle, questionId, ballots);
  const ids = useMemo(() => voterFaces(read.data), [read.data]);
  const people = useDirectoryPeople(personPointers(state.catalog?.resources ?? [], ids), ballots);
  const stack = avatarStack(
    ids.map((id): Person => people.people[nameKey(DIRECTORY, id)] ?? { id, label: id }),
    feedback,
  );
  // seen is which matches this screen knows about: the ones its first read held, and every one it has
  // shown since. It lives as long as the screen, so one match interrupts a person once per session.
  const [seen, setSeen] = useState<ReadonlySet<string>>();
  // match is the moment on screen now, and holds no memory of its own once it is left.
  const [match, setMatch] = useState<string | undefined>();
  const baseline = useRef(false);
  useEffect(() => {
    if (read.data === undefined) return;
    const now = matched(read.data);
    // The first answer sets the baseline rather than announcing what it holds: a match made
    // before this person opened the deck is news to nobody sitting at it.
    if (!baseline.current) {
      baseline.current = true;
      setSeen(new Set(now));
      return;
    }
    setMatch((was) => was ?? now.find((id) => !(seen?.has(id) ?? false)));
  }, [read.data, seen]);
  // Leaving the match records it as shown: the read underneath still holds it, so forgetting it here
  // is what would let the next read announce the same match again.
  const leaveMatch = useCallback(
    (id: string) => {
      setSeen((was) => new Set<string>([...(was ?? []), id]));
      setMatch(undefined);
      onResults();
    },
    [onResults],
  );
  const faces = agreed(read.data, match);
  const pictures = usePictures(
    faces.flatMap((face) => (face.portrait ? [face.portrait] : [])),
    match,
    extent.avatar,
  );
  return (
    <View testID="decide-voters">
      {read.error ? (
        <Notice
          tone="info"
          text={read.error}
          announcement="polite"
          testID="decide-voters-refused"
        />
      ) : null}
      {ids.length === 0 ? (
        <Text role="caption">{copy.noVotersYet}</Text>
      ) : (
        <View style={s.line}>
          <AvatarStack model={stack} decorative />
          <Text role="caption" testID="decide-voted-line">
            {copy.voted(stack.description)}
          </Text>
        </View>
      )}
      {match === undefined ? null : (
        <View style={s.match} testID="decide-match">
          <Text role="title">{copy.matched}</Text>
          <Text>
            {read.data?.options.find((option) => option.option.id === match)?.option.title}
          </Text>
          <AvatarStack
            model={avatarStack(faces, feedback, pictures.states, pictures.enabled, match)}
            {...(pictures.enabled ? { renderImage: pictures.renderImage } : {})}
            decorative
          />
          <Button
            testID="decide-match-results"
            label={copy.seeResults}
            tone="primary"
            onPress={() => leaveMatch(match)}
          />
        </View>
      )}
    </View>
  );
}

const DIRECTORY = "user/user";

const styles = (t: Theme) =>
  StyleSheet.create({
    line: { flexDirection: "row", alignItems: "center", gap: t.space.sm },
    match: { gap: t.space.sm },
  });
