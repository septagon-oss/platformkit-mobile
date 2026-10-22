// QuestionResults is the ranking as the module ranked it: score order, with the tally and the
// faces beside each option, the winner on top with its photo, and the words that say voting has
// ended. It never sorts, never breaks a tie a second time and never prints the score — a person
// reads a count of voters, and the weighted score is the ranking's internal arithmetic. Each bar
// and the percentage beside it come from the same pair of numbers, so the two cannot disagree.
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { screenPath, personPointers, nameKey, rowCommands, timeText } from "../../core/derive";
import { avatarStack, type Person } from "../../core/pictures";
import { deriveMeter } from "../../core/progress";
import type { ScreenProps } from "../../renderers";
import { refusalOf } from "../../screens/failure";
import { useFeedback } from "../../screens/useFeedback";
import { usePictures } from "../../screens/usePictures";
import { useDirectoryPeople } from "../../screens/useReferenceNames";
import { useShell } from "../../shell";
import { Button } from "../../ui/atoms/Button";
import { Notice } from "../../ui/atoms/Notice";
import { Text } from "../../ui/atoms/Text";
import { AvatarStack } from "../../ui/molecules/AvatarStack";
import { DetailRow } from "../../ui/molecules/DetailRow";
import { ProgressMeter } from "../../ui/molecules/ProgressMeter";
import { Section } from "../../ui/molecules/Section";
import { Screen } from "../../ui/templates/Screen";
import { confirm } from "../../ui/chooser";
import { useStyles, useTheme, type Theme } from "../../ui/theme";
import { extent } from "../../ui/scale";
import { InviteBlock } from "./invite";
import { support, useQuestionResults, voted, type TallyWire } from "./read";
import type { InvitePorts } from "./invite";
import { questionWire, type QuestionWire } from "./wire";

/**
 * QuestionResults draws one question's standing and offers what can still be done to it: vote,
 * invite, and — when the entry printed the `close` command for this caller — end it. Every fact is
 * the read's: acceptance comes from `acceptingVotes` rather than from a comparison against this
 * phone's clock, because a phone whose clock is wrong must not open or close voting on its own.
 */
export function QuestionResults({
  entry,
  id,
  ports,
}: ScreenProps & { readonly ports?: InvitePorts }) {
  const feedback = useFeedback();
  const copy = feedback.copy.decide;
  const presentation = { ...feedback, weekStartsOn: 1 as const };
  const theme = useTheme();
  const { api, state, entry: lookUp } = useShell();
  const router = useRouter();
  const s = useStyles(styles);
  const [question, setQuestion] = useState<QuestionWire | undefined>();
  const [detail, setDetail] = useState("");
  const [pass, setPass] = useState(0);
  const read = useQuestionResults(copy.questionTitle, id ?? "", pass);
  useFocusEffect(useCallback(() => setPass((was) => was + 1), []));
  // The row is read when the screen opens and after a write of its own, never on a re-render. The
  // feedback object is new every render, so an effect keyed by it would read again every render; its
  // words are kept beside the read in a ref that an effect writes.
  const said = useRef(feedback);
  useEffect(() => {
    said.current = feedback;
  }, [feedback]);
  useEffect(() => {
    if (id === undefined) return;
    let live = true;
    void api
      .get(entry, id)
      .then((row) => {
        if (live) setQuestion(questionWire.parse(row));
      })
      .catch((failure: unknown) => {
        if (!live) return;
        // The words come from the ref, not from this render: keyed on them, this read would run
        // again on every render, because the feedback object is new each time.
        const called = said.current.copy.decide.questionTitle;
        setDetail(
          refusalOf(
            failure,
            "read",
            { singular: called, plural: called, command: "", lastSeen: "" },
            said.current.copy,
          ).text,
        );
      });
    return () => {
      live = false;
    };
  }, [api, entry, id, pass]);
  const results = read.data;
  const ballots = voted(results);
  const ranking = results?.options ?? [];
  const winner = ranking[0];
  const tied = ranking.length > 1 && ranking[1]?.score === winner?.score;
  const ids = ranking.flatMap((option) => [
    ...option.voters.yes,
    ...option.voters.strong,
    ...option.voters.no,
    ...option.voters.skip,
  ]);
  const directory = state.catalog?.resources ?? [];
  const names = useDirectoryPeople(personPointers(directory, ids), pass);
  const pictures = usePictures(
    winner?.option.imageId === undefined ? [] : [winner.option.imageId],
    pass,
    extent.cover,
  );
  const commands = id === undefined ? [] : rowCommands(entry);
  const close = commands.find((command) => command.verb === "close");
  const closing = () => {
    if (id === undefined || question === undefined) return;
    void api
      .request(
        "POST",
        `/api/v1/decide/questions/${encodeURIComponent(id)}/close`,
        (body) => questionWire.parse(body),
        { ifRevision: question.revision },
      )
      .then(() => {
        setDetail("");
        setPass((was) => was + 1);
      })
      // A stale revision is the server's news that the question moved: the row is read again and
      // the button is offered against the revision that read printed, never the one it replaced.
      .catch((failure: unknown) => {
        setDetail(
          refusalOf(
            failure,
            "command",
            {
              singular: copy.questionTitle,
              plural: copy.questionTitle,
              command: copy.close,
              lastSeen: "",
            },
            feedback.copy,
          ).text,
        );
        setPass((was) => was + 1);
      });
  };
  const asked = () =>
    confirm(copy.close, { label: copy.close, destructive: true, onPress: closing }, theme.mode, {
      message: copy.closeConsequence,
      cancel: feedback.copy.choice.cancel,
      onCancel: () => undefined,
    });
  const cards = lookUp("decide", "card");
  const options = useMemo(
    () => ({ title: copy.results, headerLargeTitleEnabled: false }),
    [copy.results],
  );
  return (
    <>
      <Stack.Screen options={options} />
      <Screen testID="resource-detail">
        {detail || read.error ? (
          <Notice announcement="urgent" text={detail || read.error} testID="form-detail" />
        ) : null}
        {question ? (
          <QuestionLine question={question} results={results?.acceptingVotes ?? true} />
        ) : null}
        {results === undefined || ranking.length === 0 ? null : (
          <Section title={copy.results} testID="decide-results">
            {ballots === 0 ? <Text role="caption">{copy.noVotersYet}</Text> : null}
            {winner && ballots > 0 ? (
              <View style={s.winner} testID="decide-winner">
                <Text role="title">{tied ? copy.tied : copy.winner}</Text>
                <Text>{winner.option.title}</Text>
                {pictures.enabled && winner.option.imageId
                  ? pictures.renderImage({
                      id: winner.option.imageId,
                      description: winner.option.title,
                      decorative: true,
                      fit: "cover",
                      aspectRatio: 1,
                    })
                  : null}
              </View>
            ) : null}
            {ranking.map((option) => (
              <View key={option.option.id} style={s.row} testID="decide-option-row">
                <DetailRow
                  term={option.option.title}
                  value={
                    support(option) === 0 ? copy.noVotersYet : copy.votes(String(support(option)))
                  }
                  shown={<Text role="numeric">{percent(option, ballots, presentation)}</Text>}
                />
                {bar(option, ballots, presentation)}
                <AvatarStack
                  model={avatarStack(
                    faces(option.voters.yes, option.voters.strong, names.people),
                    feedback,
                  )}
                  decorative
                />
                {option.counts.skip > 0 ? (
                  <Text role="caption" tone="muted">
                    {copy.skipped(String(option.counts.skip))}
                  </Text>
                ) : null}
              </View>
            ))}
            <Text role="caption">{feedback.copy.state.updatedAt(results.observedAt)}</Text>
          </Section>
        )}
        {id !== undefined ? (
          <InviteBlock
            questionId={id}
            question={question}
            {...(ports === undefined ? {} : { ports })}
          />
        ) : null}
        <View style={s.actions}>
          {results?.acceptingVotes === true && cards !== undefined && id !== undefined ? (
            <Button
              testID="decide-vote"
              label={copy.vote}
              tone="primary"
              onPress={() =>
                router.push(`${screenPath(cards)}/review?question=${encodeURIComponent(id)}`)
              }
            />
          ) : null}
          {close && question ? (
            <Button testID="decide-close" label={copy.close} tone="destructive" onPress={asked} />
          ) : null}
        </View>
      </Screen>
    </>
  );
}

/** QuestionLine is what a question is called and whether it is still open, as the row said. */
function QuestionLine({
  question,
  results,
}: {
  readonly question: QuestionWire;
  readonly results: boolean;
}) {
  const feedback = useFeedback();
  const copy = feedback.copy.decide;
  const s = useStyles(styles);
  return (
    <View style={s.head} testID="decide-question-title">
      <Text role="title">{question.title}</Text>
      {results ? null : <Text role="caption">{copy.closed}</Text>}
      {question.closedAt ? (
        <Text role="caption">{copy.closedAt(timeText(new Date(question.closedAt), feedback))}</Text>
      ) : null}
    </View>
  );
}

/** faces is who voted for an option, named by the directory page this screen already read. */
function faces(
  yes: readonly string[],
  strong: readonly string[],
  people: Readonly<Record<string, Person>>,
): readonly Person[] {
  return [...strong, ...yes].map((id) => people[nameKey("user/user", id)] ?? { id, label: id });
}

/**
 * bar and percent are the same fact drawn twice: the meter's own model gives the filled fraction
 * and the string beside it, so a leader's bar can never disagree with the number printed next to
 * it. A ranking with no ballots has no denominator, and the kit's meter refuses to draw one — the
 * option is drawn with no bar and no percentage rather than with a zero invented for it.
 */
function bar(option: TallyWire, ballots: number, p: Parameters<typeof deriveMeter>[1]) {
  const model = deriveMeter(
    { label: option.option.title, value: support(option), max: ballots, format: "percent" },
    p,
  );
  return model.ok ? <ProgressMeter model={model.value} /> : null;
}

function percent(option: TallyWire, ballots: number, p: Parameters<typeof deriveMeter>[1]) {
  const model = deriveMeter(
    { label: option.option.title, value: support(option), max: ballots, format: "percent" },
    p,
  );
  return model.ok ? model.value.text : "";
}

const styles = (t: Theme) =>
  StyleSheet.create({
    head: { gap: t.space.xs },
    winner: { gap: t.space.xs },
    row: { gap: t.space.xs },
    actions: { gap: t.space.sm },
  });
