// The still stack exposes the same named choices as its visible controls, with one readable card and truthful end states.
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ResourceDeck, type Props } from "../../src/ui/organisms/ResourceDeck";
import { deckEvent, startDeck } from "../../src/core/deck";
import { deriveCopy } from "../../src/core/derive";
import { deckEntryFixture, deckRows } from "../fakes/deck";
import { presentation } from "../fakes/presentation";

const entry = deckEntryFixture();
const initial = startDeck(entry.hints!.deck!);
const ready = deckEvent(initial, {
  type: "page",
  session: 1,
  operation: 1,
  offset: 0,
  items: deckRows,
  total: 3,
});
const props = (over: Partial<Props> = {}): Props => ({
  entry,
  state: ready,
  presentation,
  onAction: jest.fn(),
  onOpen: jest.fn(),
  onSettled: jest.fn(),
  onFinishEnd: jest.fn(),
  onRefresh: jest.fn(),
  onRetry: jest.fn(),
  onBack: jest.fn(),
  ...over,
});

test("the still stack exposes one card and the ordered declared choices without requiring a motion renderer", async () => {
  const input = props();
  await render(<ResourceDeck {...input} />);
  expect(screen.getAllByTestId("deck-card")).toHaveLength(1);
  expect(screen.getByTestId("deck-card").props.accessibilityLabel).toContain("Apple");
  expect(screen.getByTestId("deck-card").props.accessibilityActions).toEqual([
    { name: "left", label: "Archive" },
    { name: "down", label: "Review later" },
    { name: "right", label: "Accept" },
  ]);
  expect(screen.getByTestId("deck-progress").props["aria-valuetext"]).toBe("0 of 3");
  await fireEvent.press(screen.getByTestId("deck-right"));
  await fireEvent(screen.getByTestId("deck-card"), "accessibilityAction", {
    nativeEvent: { actionName: "right" },
  });
  expect(input.onAction).toHaveBeenNthCalledWith(1, "right");
  expect(input.onAction).toHaveBeenNthCalledWith(2, "right");
  await fireEvent.press(screen.getByTestId("deck-card"));
  expect(input.onOpen).toHaveBeenCalledWith("A");
});

test("busy cards announce their lock and retain their text and persistent refusal reason", async () => {
  const submitting = deckEvent(ready, {
    type: "choose",
    session: 1,
    direction: "right",
    confirmation: false,
  });
  await render(<ResourceDeck {...props({ state: { ...submitting, notice: "Cannot confirm" } })} />);
  expect(screen.getByTestId("deck-card").props.accessibilityState).toEqual({
    disabled: true,
    busy: true,
  });
  expect(screen.getByText("Apple")).toBeTruthy();
  expect(screen.getByTestId("deck-notice")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Review later" })).toBeDisabled();
});

test("a failed picture leaves a titled card that still offers the same decisions", async () => {
  const pictured = {
    ...entry,
    fields: [...entry.fields, { name: "cover", type: "uuid" as const, present: "image" }],
    hints: { ...entry.hints, coverField: "cover" },
  };
  const id = "00000000-0000-4000-8000-000000000002";
  const state = { ...ready, rows: { ...ready.rows, A: { ...deckRows[0], cover: id } } };
  await render(
    <ResourceDeck
      {...props({ entry: pictured, state, pictures: { files: {}, states: { [id]: "error" } } })}
    />,
  );
  expect(screen.getByText("Apple")).toBeTruthy();
  expect(screen.getByText(presentation.copy.kit.imageUnavailable)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Accept" })).not.toBeDisabled();
});

test("empty and finite-pass ends remain distinct and Portuguese copy covers the local skip and end", async () => {
  const empty = { ...ready, active: [], rows: {}, phase: "caught-up" as const };
  const pt = { ...presentation, copy: deriveCopy("pt"), locale: "pt-PT" };
  const root = await render(<ResourceDeck {...props({ state: empty, presentation: pt })} />);
  expect(screen.getByText("Tudo em dia")).toBeTruthy();
  expect(screen.queryByTestId("deck-card")).toBeNull();
  expect(screen.queryByTestId("deck-progress")).toBeNull();
  await root.rerender(
    <ResourceDeck
      {...props({
        state: {
          ...empty,
          phase: "pass-end",
          history: [{ id: "A", direction: "down", kind: "skip" }],
        },
        presentation: pt,
      })}
    />,
  );
  expect(screen.getByText("Revisão concluída")).toBeTruthy();
  expect(screen.getByText("1 para mais tarde")).toBeTruthy();
});
