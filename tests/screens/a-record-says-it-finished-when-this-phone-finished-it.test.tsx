// A record that reaches a state its entry calls finished, through a command the person ran on this
// phone, says so once: "Note done" is drawn on the record (`record-finished`). Writes on the same
// record that finished nothing — a command that left the state where it was — are routine, and
// routine work earns no moment and spends none: the record's one moment per session is the one it
// actually finished in. The session's memory is the shell's own (`celebrate` and the writes count),
// so the real `Shell` is mounted and only the transport, the catalogue and the device store are
// laid over it.
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
// The shell's own memory — what was written, what was said, what is due its moment — is the real
// one; what a signed-in session would add on top of it (the transport, the catalogue) is laid over.
let mockSession: Partial<ShellValue> = {};
jest.mock("../../src/shell", () => {
  const actual = jest.requireActual<typeof import("../../src/shell")>("../../src/shell");
  return { ...actual, useShell: () => ({ ...actual.useShell(), ...mockSession }) };
});

const asked = jest.mocked(confirm);

/** The golden's note, served with a status the entry names and one value of it called finished. */
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
      commands: [
        { verb: "publish", summary: "Publish the note" },
        { verb: "archive", summary: "Archive the note" },
      ],
    },
  ],
});
const entry = catalog.resources[0] as Entry;

let api: FakeApi;
let status = "open";

beforeEach(() => {
  reset();
  asked.mockClear();
  status = "open";
  api = fakeApi();
  api.get.mockImplementation(async (_e, id) => ({ id, title: "Descale the kettle", status }));
  mockSession = {
    api,
    state: { phase: "ready", generation: 1, catalog },
    entry: () => entry,
    outbox: undefined,
    reads: undefined,
  };
});
afterEach(() => {
  mockSession = {};
  jest.restoreAllMocks();
});

async function openRecord() {
  await render(
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
    </Shell>,
  );
  await waitFor(() => expect(screen.getByText("Open")).toBeOnTheScreen());
}

/** run presses a record command, answers its question yes, and waits for the record to re-read. */
async function run(verb: string, reaches: string) {
  const reads = api.get.mock.calls.length;
  await fireEvent.press(screen.getByTestId(`command-${verb}`));
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

test("a command that finishes the record says the record finished", async () => {
  await openRecord();
  expect(screen.queryByTestId("record-finished")).toBeNull();

  await run("archive", "done");

  expect(screen.getByTestId("record-finished")).toHaveTextContent("Note done");
});

test("a command that finished nothing leaves the record its moment for the command that finishes it", async () => {
  await openRecord();

  await run("publish", "open");
  expect(screen.queryByTestId("record-finished")).toBeNull();
  await run("archive", "done");

  expect(screen.getByTestId("record-finished")).toHaveTextContent("Note done");
});

test("a record whose moment already played this session does not play it again", async () => {
  // A person who asked for motion, and a product that ships a burst: every burst drawn is counted,
  // and each says at once that it is over, so a second one would have to be drawn anew.
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const bursts: string[] = [];
  function Burst({ tone, onEnd }: FinishingProps) {
    React.useEffect(() => {
      bursts.push(tone);
      onEnd();
    }, [tone, onEnd]);
    return null;
  }
  mockSession = { ...mockSession, media: { finishing: Burst } };
  await openRecord();

  await run("archive", "done");
  await waitFor(() => expect(bursts).toHaveLength(1));
  await run("publish", "open");
  await run("archive", "done");

  expect(bursts).toHaveLength(1);
});
