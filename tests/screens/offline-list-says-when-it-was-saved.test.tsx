import React from "react";
import { expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { deriveCopy } from "../../src/core/derive";
import { createReadCache } from "../../src/effects/read-cache";
import { ResourceList } from "../../src/screens/ResourceList";
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

// A page answered from the phone rather than the server is drawn with a quiet
// line that says so and when it was saved: a person in a tunnel must be able to
// tell yesterday's list from today's. The words are the copy table's own.
const words = deriveCopy("en").state;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("a list answered from the phone says it is offline and when it was last updated", async () => {
  reset();
  const api = fakeApi();
  const reads = createReadCache({
    store: fakeReadStore().store,
    clock: clock(),
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
  });
  shell.value = shellValue(api, { reads });
  const row = { id: "saved-note", title: "Recorded on site" };
  api.list.mockResolvedValue({ items: [row], total: 1 });
  const online = await render(
    <ThemeProvider mode="light">
      <ResourceList entry={note} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByText("Recorded on site")).toBeOnTheScreen());
  expect(screen.queryByText(words.offline.title)).toBeNull();
  await online.unmount();

  api.list.mockRejectedValue(new TypeError("Network request failed"));
  await render(
    <ThemeProvider mode="light">
      <ResourceList entry={note} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByText("Recorded on site")).toBeOnTheScreen());
  expect(screen.getByText(words.offline.title)).toBeOnTheScreen();
  expect(screen.getByText(new RegExp(`^${escape(words.updatedAt(""))}`))).toBeOnTheScreen();
});
