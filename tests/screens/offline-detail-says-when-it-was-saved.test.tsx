// A record the phone answered rather than the server is drawn with the same
// quiet line a list carries: what it is, and when this device last received it.
// One derivation (deriveOffline) says it for both pages, so a record read on the
// train cannot be shown in the tunnel as though it had just been read.
import React from "react";
import { expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { deriveCopy } from "../../src/core/derive";
import { createReadCache } from "../../src/effects/read-cache";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";
import { clock, fakeReadStore } from "../fakes/store";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

const words = deriveCopy("en").state;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("a record answered from the phone says it is offline and when it was last updated", async () => {
  reset();
  const api = fakeApi();
  const reads = createReadCache({
    store: fakeReadStore().store,
    clock: clock(),
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
  });
  shell.value = shellValue(api, { reads });
  const row = { id: "saved-note", title: "Recorded on site" };
  api.get.mockResolvedValue(row);
  const online = await render(
    <ThemeProvider mode="light">
      <ResourceDetail entry={note} id={row.id} />
    </ThemeProvider>,
  );
  // The row is on screen when the record's own facts are: the title the row is
  // called by is drawn in the native header, so it is the information block that
  // says a row arrived, not a piece of the row's text.
  await waitFor(() => expect(screen.getByTestId("record-information")).toBeOnTheScreen());
  expect(screen.queryByText(words.offline.title)).toBeNull();
  await online.unmount();

  api.get.mockRejectedValue(new TypeError("Network request failed"));
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail entry={note} id={row.id} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("record-information")).toBeOnTheScreen());
  expect(screen.getByText(words.offline.title)).toBeOnTheScreen();
  expect(screen.getByText(new RegExp(`^${escape(words.updatedAt(""))}`))).toBeOnTheScreen();
});
