// The caught-up deck hands its finishing renderer the arrived tone and the person's motion only when the
// derived model asks for a finish: normal motion mounts it inside the end state and its end reaches the
// screen's finish call; reduced motion, or a product with no renderer, draws the same still title and
// counts with no renderer mounted.
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import React from "react";
import { Pressable } from "react-native";
import { deckEvent, startDeck, type DeckInput, type DeckState } from "../../src/core/deck";
import type { Presentation } from "../../src/core/derive";
import type { FinishingProps } from "../../src/ui/organisms/ResourceDetail";
import { ResourceDeck, type Props } from "../../src/ui/organisms/ResourceDeck";
import { deckEntryFixture, deckRows } from "../fakes/deck";
import { presentation as still } from "../fakes/presentation";

const entry = deckEntryFixture();
const moving: Presentation = { ...still, motion: "normal" };
const words = still.copy.review;
const event = (s: DeckState, input: DeckInput): DeckState =>
  deckEvent(s, { ...input, session: s.session });

/** caughtUp confirms one command on a one-card queue and answers its final count with none left. */
function caughtUp(): DeckState {
  let s = startDeck(entry.hints!.deck!);
  s = event(s, {
    type: "page",
    operation: s.operation,
    offset: 0,
    items: [deckRows[0]!],
    total: 1,
  });
  s = event(s, { type: "choose", direction: "right", confirmation: false });
  s = event(s, { type: "accepted", operation: s.operation });
  s = event(s, { type: "settled", operation: s.operation });
  s = event(s, { type: "count", operation: s.operation, total: 0 });
  expect(s.phase).toBe("caught-up");
  return s;
}

const drawn: FinishingProps[] = [];
function Finishing(props: FinishingProps) {
  drawn.push(props);
  return <Pressable testID="finishing-renderer" onPress={props.onEnd} />;
}

const props = (over: Partial<Props>): Props => ({
  entry,
  state: caughtUp(),
  presentation: still,
  renderFinishing: Finishing,
  onAction: jest.fn(),
  onOpen: jest.fn(),
  onSettled: jest.fn(),
  onFinishEnd: jest.fn(),
  onRefresh: jest.fn(),
  onRetry: jest.fn(),
  onBack: jest.fn(),
  ...over,
});

test("normal motion mounts the finishing renderer in the end state and its end reaches the finish call", async () => {
  drawn.length = 0;
  const input = props({ presentation: moving });
  await render(<ResourceDeck {...input} />);
  const end = within(screen.getByTestId("deck-end"));
  expect(end.getByText(words.caughtUp)).toBeTruthy();
  expect(end.getByTestId("finishing-renderer")).toBeTruthy();
  expect(drawn.at(-1)).toMatchObject({ tone: "ok", motion: "normal" });
  await fireEvent.press(screen.getByTestId("finishing-renderer"));
  expect(input.onFinishEnd).toHaveBeenCalledTimes(1);
});

test("reduced motion draws the same caught-up title and counts with no finishing renderer", async () => {
  drawn.length = 0;
  const normal = await render(<ResourceDeck {...props({ presentation: moving })} />);
  const counts = normal.getByTestId("deck-end").props.accessibilityLabel;
  await normal.unmount();
  drawn.length = 0;
  await render(<ResourceDeck {...props({ presentation: still })} />);
  expect(within(screen.getByTestId("deck-end")).getByText(words.caughtUp)).toBeTruthy();
  expect(screen.getByTestId("deck-end").props.accessibilityLabel).toBe(counts);
  expect(screen.queryByTestId("finishing-renderer")).toBeNull();
  expect(drawn).toHaveLength(0);
});

test("a product with no finishing renderer keeps the caught-up end whole under normal motion", async () => {
  drawn.length = 0;
  await render(<ResourceDeck {...props({ presentation: moving, renderFinishing: undefined })} />);
  expect(within(screen.getByTestId("deck-end")).getByText(words.caughtUp)).toBeTruthy();
  expect(screen.queryByTestId("finishing-renderer")).toBeNull();
  expect(drawn).toHaveLength(0);
});
