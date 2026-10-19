// Home's counts are a read of a documented address, asked through the generated
// operation: the route table, the validator and ApiError are all in the path these tests
// walk. One pull asks both documents; a refusal withdraws the numbers it never gave.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Home } from "../../src/screens/Home";
import { ThemeProvider } from "../../src/ui/theme";
import { answering, catalog, fakeApi, note, recorded, shell, shellValue } from "../fakes/shell";
import { router } from "../fakes/router";
import { screenPath } from "../../src/core/derive";

jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);

const entries = catalog.resources;
const askedCounts = (calls: readonly string[]) =>
  calls.filter((call) => call.includes("/api/v1/app/summary"));
const asOf = { asOf: "2026-07-18T09:00:00Z" };
const drawn = (text: string) =>
  expect(screen.getAllByText(text, { hidden: true })).not.toHaveLength(0);

async function opened(operations: Parameters<typeof fakeApi>[0]) {
  const api = fakeApi(operations);
  const value = shellValue(api);
  shell.value = value;
  await render(
    <ThemeProvider mode="light">
      <Home entries={entries} />
    </ThemeProvider>,
  );
  return { api, value };
}

beforeEach(() => {
  router.push.mockClear();
});

describe("Home reads its counts", () => {
  test("it asks the documented counts address once and draws the number it answered", async () => {
    const wire = recorded({
      ...asOf,
      entries: [{ module: "note", entity: "note", total: 128, highlight: 4 }],
    });
    await opened({ appSummary: jest.fn(wire.operations.appSummary) });
    await waitFor(() => drawn("128"));
    // One question, spelled the way the document spells it: the path went through the
    // generated route table, which is the only address this build may use.
    expect(askedCounts(wire.calls)).toHaveLength(1);
    // The same number in the row's column, from the same body.
    expect(screen.getByTestId("home-count-note-note")).toHaveTextContent("128");
    expect(screen.getByTestId("home-stat-note-note")).toBeOnTheScreen();
    await screen.unmount();
  });

  test("the greeting is drawn whatever the counts read answered", async () => {
    await opened({ appSummary: jest.fn(answering({ ...asOf, entries: [] }).appSummary) });
    await waitFor(() => expect(screen.getByTestId("home-greeting")).toBeOnTheScreen());
    expect(screen.getByTestId("home-workspace")).toHaveTextContent("acme.test");
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
    await screen.unmount();
  });

  test("a summary that refuses leaves no card, no count and no zero", async () => {
    const wire = recorded({ type: "https://platformkit.test/problem", status: 500 }, 500);
    await opened({ appSummary: jest.fn(wire.operations.appSummary) });
    await waitFor(() => expect(screen.getByTestId("home")).toBeOnTheScreen());
    expect(askedCounts(wire.calls)).toHaveLength(1);
    expect(screen.queryAllByTestId(/home-stat-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/home-count-/)).toHaveLength(0);
    expect(screen.queryByText("0")).toBeNull();
    // The refusal is this read's, so the rows the catalogue already handed the screen stay.
    expect(screen.getByTestId("open-note-note")).toBeOnTheScreen();
    await screen.unmount();
  });

  test("one pull asks the catalogue and the counts again", async () => {
    const wire = recorded({ ...asOf, entries: [{ module: "note", entity: "note", total: 7 }] });
    const { value } = await opened({ appSummary: jest.fn(wire.operations.appSummary) });
    await waitFor(() => drawn("7"));
    expect(askedCounts(wire.calls)).toHaveLength(1);
    expect(value.refresh).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent(screen.getByTestId("home"), "refresh");
    });
    await waitFor(() => expect(askedCounts(wire.calls)).toHaveLength(2));
    // One gesture, both reads: the counts and the catalogue are the same question.
    expect(value.refresh).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  test("a card opens the list its row opens", async () => {
    const wire = recorded({ ...asOf, entries: [{ module: "note", entity: "note", total: 7 }] });
    await opened({ appSummary: jest.fn(wire.operations.appSummary) });
    await waitFor(() => expect(screen.getByTestId("home-stat-note-note")).toBeOnTheScreen());
    await act(async () => {
      fireEvent.press(screen.getByTestId("home-stat-note-note"));
    });
    expect(router.push).toHaveBeenLastCalledWith(screenPath(note));
    await act(async () => {
      fireEvent.press(screen.getByTestId("open-note-note"));
    });
    expect(router.push).toHaveBeenLastCalledWith(screenPath(note));
    await screen.unmount();
  });
});
