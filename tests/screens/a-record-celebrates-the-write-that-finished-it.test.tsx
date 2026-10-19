// Which writes owe a record its finishing moment, and which do not: the moment belongs to a write
// this phone made that moved the state into one the entry calls finished, so a read that merely
// answers a state the server already held says nothing, a record read finished from the first moment
// says nothing — for it nothing crossed — and a person who asked for less motion is given the
// sentence with no ink drawn over the record. The session's memory is the shell's own, so the real
// `Shell` is mounted and only the transport, the catalogue and the device store are laid over it.
import React from "react";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { parseCatalog, type Entry } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { Shell, type ShellValue } from "../../src/shell";
import type { FinishingProps } from "../../src/ui/organisms/ResourceDetail";
import { confirm } from "../../src/ui/chooser";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { fakeApi, type FakeApi } from "../fakes/shell";
import { clock, fakeOutboxStore, fakeReadStore, mint } from "../fakes/store";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));
let mockSession: Partial<ShellValue> = {};
// What the mounted Shell itself hands out, so a case can make the real one count a write.
let live: ShellValue | undefined;
jest.mock("../../src/shell", () => {
  const actual = jest.requireActual<typeof import("../../src/shell")>("../../src/shell");
  return {
    ...actual,
    useShell: () => {
      const value = actual.useShell();
      live = value;
      return { ...value, ...mockSession };
    },
  };
});

const asked = jest.mocked(confirm);

/** The note as served, with a state the entry names and one value of it called finished. */
const catalog = parseCatalog({
  catalogVersion: 2,
  resources: [
    {
      module: "note",
      entity: "note",
      path: "/api/v1/note/notes",
      writable: true,
      presentation: {
        singular: "note",
        plural: "notes",
        primaryField: "title",
        statusField: "status",
      },
      fields: [
        { name: "id", type: "uuid", readOnly: true },
        { name: "title", type: "string" },
        {
          name: "status",
          type: "string",
          enum: ["open", "done"],
          presentation: { enumLabels: { open: "Open", done: "Done" }, doneValues: ["done"] },
        },
      ],
      commands: [{ verb: "publish", summary: "Publish the note" }],
    },
  ],
});
const entry = catalog.resources[0] as Entry;

let api: FakeApi;
let status = "open";
let bursts: string[] = [];

/** Burst counts every finishing renderer the screen mounts, and ends the burst at once. */
function Burst({ tone }: FinishingProps) {
  React.useEffect(() => {
    bursts.push(tone);
  }, [tone]);
  return null;
}

beforeEach(() => {
  reset();
  asked.mockClear();
  status = "open";
  bursts = [];
  api = fakeApi();
  api.get.mockImplementation(async (_e, id) => ({ id, title: "Descale the kettle", status }));
  mockSession = {
    api,
    state: { phase: "ready", generation: 1, catalog },
    entry: () => entry,
    outbox: undefined,
    reads: undefined,
  };
  // Motion asked for, so a burst the screen withholds is a choice and not the absence of one.
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});
afterEach(() => {
  mockSession = {};
  jest.restoreAllMocks();
});

async function openRecord(over: Partial<ShellValue> = {}, state = "Open") {
  mockSession = { ...mockSession, ...over };
  const tree = (
    <Shell
      baseURL="https://acme.test"
      renderers={{}}
      store={{ outbox: fakeOutboxStore().store, reads: fakeReadStore().store }}
      clock={clock()}
      mint={mint()}
    >
      <ThemeProvider mode="light">
        <ResourceDetail entry={entry} id="kettle-7" />
      </ThemeProvider>
    </Shell>
  );
  await render(tree);
  await waitFor(() => expect(screen.getByText(state)).toBeOnTheScreen());
}

/** publish presses the record's command, answers its question yes, and waits for the re-read. */
async function publish(reaches: string) {
  const reads = api.get.mock.calls.length;
  await fireEvent.press(screen.getByTestId("command-publish"));
  const question = asked.mock.calls.at(-1)!;
  status = reaches;
  await act(async () => {
    await question[1].onPress();
  });
  await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(reads));
  await waitFor(() =>
    expect(screen.getByText(reaches === "done" ? "Done" : "Open")).toBeOnTheScreen(),
  );
}

test("a read that answers a state the server already reached says nothing", async () => {
  await openRecord({ media: { finishing: Burst } });
  // Another phone's write moved the state. This phone counted it, so the next focus reads the row
  // again and finds it finished — and a record this person never wrote to has nothing to say.
  status = "done";
  const before = api.get.mock.calls.length;
  await act(async () => {
    live!.wrote("note/note");
  });
  await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(before));
  await waitFor(() => expect(screen.getByText("Done")).toBeOnTheScreen());
  expect(screen.queryByTestId("record-finished")).toBeNull();
  expect(bursts).toEqual([]);
});

test("a record read finished from the first moment keeps quiet about it", async () => {
  // It arrived finished and nothing crossed under this person's hand, so there is no moment owed.
  status = "done";
  await openRecord({ media: { finishing: Burst } }, "Done");
  expect(screen.queryByTestId("record-finished")).toBeNull();
  expect(bursts).toEqual([]);
});

test("a person who asked for less motion is given the sentence and no ink", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  await openRecord({ media: { finishing: Burst } });
  await publish("done");
  expect(screen.getByTestId("record-finished")).toHaveTextContent("Note done");
  expect(bursts).toEqual([]);
});

test("the burst a motion-asking person is given is drawn once, over the record it belongs to", async () => {
  await openRecord({ media: { finishing: Burst } });
  await publish("done");
  await waitFor(() => expect(bursts).toHaveLength(1));
  expect(screen.getByTestId("record-finished")).toHaveTextContent("Note done");
});
