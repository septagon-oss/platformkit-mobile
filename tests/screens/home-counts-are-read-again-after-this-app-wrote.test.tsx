// The counts on Home are the workspace's now. This app writes records behind that screen,
// so coming back asks the counts door again once a write moved — the same rule the three
// generated screens keep for their own resource, asked of the one body that counts them all.
// A focus that found nothing written asks nothing, a write to a resource these numbers do
// not count asks nothing, and a pull settles what the screen has already been told.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Home } from "../../src/screens/Home";
import { ThemeProvider } from "../../src/ui/theme";
import { catalog, fakeApi, recorded, shell, shellValue } from "../fakes/shell";
import { router } from "../fakes/router";

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
const asOf = { asOf: "2026-10-18T09:00:00Z" };
const body = { ...asOf, entries: [{ module: "note", entity: "note", total: 128 }] };
const askedCounts = (calls: readonly string[]) =>
  calls.filter((call) => call.includes("/api/v1/app/summary"));
const drawn = (text: string) =>
  expect(screen.getAllByText(text, { hidden: true })).not.toHaveLength(0);

/** page is Home opened over a wire that answers the counts body, and the shell it runs on. */
async function page(wire: ReturnType<typeof recorded>) {
  const api = fakeApi({ appSummary: jest.fn(wire.operations.appSummary) });
  shell.value = shellValue(api);
  const view = await render(
    <ThemeProvider mode="light">
      <Home entries={entries} />
    </ThemeProvider>,
  );
  await waitFor(() => drawn("128"));
  return view;
}

/** returned is the person coming back to Home: the same page, the shell as it is now. */
async function returned(view: Awaited<ReturnType<typeof page>>) {
  await act(async () => {
    view.rerender(
      <ThemeProvider mode="light">
        <Home entries={entries} />
      </ThemeProvider>,
    );
  });
}

/** wrote is this app writing to one resource while Home stood behind it. */
function wrote(resourceKey: string, times = 1) {
  const was = shell.value!.writes;
  shell.value = {
    ...shell.value!,
    writes: { ...was, [resourceKey]: (was[resourceKey] ?? 0) + times },
  };
}

beforeEach(() => {
  router.push.mockClear();
});

describe("Home's counts after this app wrote", () => {
  test("coming back after a write to a counted resource asks the counts door again", async () => {
    const wire = recorded(body);
    const view = await page(wire);
    expect(askedCounts(wire.calls)).toHaveLength(1);
    await returned(view);
    // Nothing was written: the number on screen is the one the read answered, so nothing
    // is asked and nothing on the page changes.
    expect(askedCounts(wire.calls)).toHaveLength(1);
    wrote("note/note");
    await returned(view);
    await waitFor(() => expect(askedCounts(wire.calls)).toHaveLength(2));
    // A second focus with nothing new written asks nothing further.
    await returned(view);
    expect(askedCounts(wire.calls)).toHaveLength(2);
    await screen.unmount();
  });

  test("a write to a resource these counts do not count asks nothing", async () => {
    const wire = recorded(body);
    const view = await page(wire);
    // No entry of this catalogue counts `task/task`, so the body these cards are joined
    // from cannot have changed for it.
    wrote("task/task");
    await returned(view);
    expect(askedCounts(wire.calls)).toHaveLength(1);
    await screen.unmount();
  });

  test("a pull asks the counts on its own, and the focus after it owes no second read", async () => {
    const wire = recorded(body);
    const view = await page(wire);
    await act(async () => {
      fireEvent(screen.getByTestId("home"), "refresh");
    });
    await waitFor(() => expect(askedCounts(wire.calls)).toHaveLength(2));
    // The person asked; the screen read. Coming back with nothing written since asks
    // nothing, because the read the pull started is the read these numbers came from.
    await returned(view);
    expect(askedCounts(wire.calls)).toHaveLength(2);
    await screen.unmount();
  });
});
