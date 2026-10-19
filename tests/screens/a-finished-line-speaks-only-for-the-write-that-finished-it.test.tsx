// The finished line ("Note done", `record-finished`) is about the state the record holds and the
// write this phone made. When a later write takes the record back to open, the line goes with the
// state it described. When the re-read after a write never answers, the write's filing is spent
// anyway, so a Retry that later finds the record finished (because someone elsewhere finished it)
// draws no line. The real `Shell` is mounted; only the transport, the catalogue and the device store
// are laid over it.
import React from "react";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { parseCatalog, type Entry } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { Shell, type ShellValue } from "../../src/shell";
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
jest.mock("../../src/shell", () => {
  const actual = jest.requireActual<typeof import("../../src/shell")>("../../src/shell");
  return { ...actual, useShell: () => ({ ...actual.useShell(), ...mockSession }) };
});

const asked = jest.mocked(confirm);

/** A note whose status the entry names, with one value of it called finished. */
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

/** press presses a record command and answers its question yes, the server reaching `reaches`. */
async function press(verb: string, reaches: string) {
  await fireEvent.press(screen.getByTestId(`command-${verb}`));
  const question = asked.mock.calls.at(-1)!;
  status = reaches;
  await act(async () => {
    await question[1].onPress();
  });
}

test("a record taken back to open after it finished no longer says it finished", async () => {
  await openRecord();
  await press("archive", "done");
  await waitFor(() => expect(screen.getByText("Done")).toBeOnTheScreen());
  expect(screen.getByTestId("record-finished")).toHaveTextContent("Note done");

  await press("publish", "open");
  await waitFor(() => expect(screen.getByText("Open")).toBeOnTheScreen());

  expect(screen.queryByTestId("record-finished")).toBeNull();
});

test("a retry after a write's re-read failed draws no line for a state this phone did not write", async () => {
  await openRecord();
  const reads = api.get.mock.calls.length;
  api.get.mockRejectedValueOnce(new TypeError("Network request failed"));
  await press("publish", "open");
  await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(reads));

  // Someone elsewhere finishes the record while this phone's read is refused.
  status = "done";
  const retry = await screen.findByRole("button", { name: "Retry" });
  await fireEvent.press(retry);
  await waitFor(() => expect(screen.getByText("Done")).toBeOnTheScreen());

  expect(screen.queryByTestId("record-finished")).toBeNull();
});
