// The reads every Decide screen shares. The module's ranking, tally and roster are its own JSON
// projections rather than catalogue rows, so each is asked through the transport's one validator
// door: a body outside the shape below is refused there, never drawn as a row with a missing member.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Person } from "../../core/pictures";
import { refusalOf } from "../../screens/failure";
import { useFeedback } from "../../screens/useFeedback";
import { useShell } from "../../shell";
import { resultsWire, type ResultsWire, type TallyWire } from "./wire";
export type { TallyWire };

/** QuestionRead is one question's ranking, the refusal that stopped it, and the way to ask again. */
export interface QuestionRead {
  readonly data: ResultsWire | undefined;
  readonly error: string;
  readonly reload: () => void;
}

/**
 * useQuestionResults reads the ranking of one question. It asks when the screen is focused, when
 * `watched` changes — which is how a screen says a ballot of its own just landed — and when a
 * reload is asked for. The phone keeps the last answer it had while a later one is owed, and says
 * what refused rather than drawing a ranking it no longer holds.
 */
export function useQuestionResults(
  singular: string,
  questionId: string,
  watched: unknown,
): QuestionRead {
  const { api } = useShell();
  const feedback = useFeedback();
  // The words are read when a failure is named, not when the request is made. The feedback object is
  // new every render, so an effect keyed by it would ask again every render; it is kept beside the
  // read in a ref written by an effect, which is where a ref may be written.
  const said = useRef(feedback);
  useEffect(() => {
    said.current = feedback;
  }, [feedback]);
  const [data, setData] = useState<ResultsWire | undefined>();
  const [error, setError] = useState("");
  const [asked, setAsked] = useState(0);
  const reload = useCallback(() => setAsked((was) => was + 1), []);
  useFocusEffect(
    useCallback(() => {
      setAsked((was) => was + 1);
    }, []),
  );
  useEffect(() => {
    let live = true;
    void api
      .request(
        "GET",
        `/api/v1/decide/questions/${encodeURIComponent(questionId)}/results`,
        (body) => resultsWire.parse(body),
      )
      .then((answer) => {
        if (!live) return;
        setData(answer);
        setError("");
      })
      .catch((failure: unknown) => {
        if (live)
          setError(
            refusalOf(
              failure,
              "read",
              { singular, plural: singular, command: "", lastSeen: "" },
              said.current.copy,
            ).text,
          );
      });
    return () => {
      live = false;
    };
  }, [api, singular, questionId, watched, asked]);
  return { data, error, reload };
}

/**
 * voterFaces is everyone the ranking named, in the order it named them and once each. They are
 * bare person ids until the directory resolves them, which is what `personPointers` is for; a
 * read that named nobody answers an empty list, which draws no stack and no count.
 */
export function voterFaces(results: ResultsWire | undefined): readonly string[] {
  if (results === undefined) return [];
  const seen = new Set<string>();
  for (const option of results.options)
    for (const group of [
      option.voters.yes,
      option.voters.strong,
      option.voters.no,
      option.voters.skip,
    ])
      for (const person of group) seen.add(person);
  return [...seen];
}

/**
 * support is the ballots an option stands on: the module ranks by a weighted score that mixes
 * "yes" and "strong" at different rates, and a person reading a bar reads a count of voters, not
 * that weight. The score itself is never printed.
 */
export const support = (option: TallyWire): number => option.counts.yes + option.counts.strong;

/** voted is how many ballots the whole ranking holds, which is the denominator every bar measures against. */
export const voted = (results: ResultsWire | undefined): number =>
  (results?.options ?? []).reduce(
    (total, option) =>
      total + option.counts.yes + option.counts.strong + option.counts.no + option.counts.skip,
    0,
  );

/** agreed is who brought an option to be a match: its strong and yes ballots, in that order. */
export function agreed(
  results: ResultsWire | undefined,
  id: string | undefined,
): readonly Person[] {
  const option = results?.options.find((each) => each.option.id === id);
  if (option === undefined) return [];
  return [...option.voters.strong, ...option.voters.yes].map((person): Person => ({
    id: person,
    label: person,
  }));
}

/** matched is which options the module called a match in this answer. */
export const matched = (results: ResultsWire | undefined): readonly string[] =>
  (results?.options ?? [])
    .filter((option) => option.matched === true)
    .map((option) => option.option.id);
