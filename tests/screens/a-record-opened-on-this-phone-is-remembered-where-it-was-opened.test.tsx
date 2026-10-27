// The junction: a record screen that got its row writes the open it just drew. The port,
// the table and the screen's own title rule are each tested where they live; what is proven
// here is that they meet — that a person who opened a record on this phone finds it remembered
// under the words they read, and that a read that never arrived leaves nothing remembered.
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { readFileSync } from "node:fs";
import { act, render, waitFor } from "@testing-library/react-native";
import { parseCatalog } from "../../src/core/catalog";
import { heldScope } from "../../src/core/outbox";
import { createRecents } from "../../src/effects/recents";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { header, reset } from "../fakes/router";
import { fakeApi, shell, shellValue } from "../fakes/shell";
import { clock, fakeRecentsStore } from "../fakes/store";
import { unresolved } from "../fakes/unresolved";

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
jest.mock("expo-image", () => ({
  Image: jest.requireActual<typeof import("../fakes/image")>("../fakes/image").ExpoImage,
}));

const catalog = parseCatalog(unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))));
const note = catalog.resources.find((r) => r.entity === "note")!;
const AT = "2026-10-06T10:00:00.000Z";

/** opened is the phone's memory, over a store that keeps the table's own columns and scope. */
function memory(at = AT) {
  const keeps = fakeRecentsStore();
  const recents = createRecents({
    store: keeps.store,
    clock: clock(at),
    scope: () => heldScope("https://acme.test", "person-a"),
  });
  return { keeps, recents };
}

function recordOn(row: Record<string, unknown>) {
  const api = fakeApi();
  api.get.mockResolvedValue(row);
  shell.value = shellValue(api, {
    identity: { userId: "person-a", email: "ana@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog },
    entry: (module, entity) =>
      catalog.resources.find((r) => r.module === module && r.entity === entity),
  });
  return api;
}

beforeEach(() => reset());
afterEach(() => {
  shell.value = undefined;
});

describe("an open is remembered on the phone that opened it", () => {
  test("the record that arrived is stored under the words the screen drew", async () => {
    const { keeps, recents } = memory();
    recordOn({ id: "n-1", title: "Standup", status: "open", rank: 1 });
    shell.value = { ...shell.value!, recents };
    await render(
      <ThemeProvider mode="light">
        <ResourceDetail entry={note} id="n-1" />
      </ThemeProvider>,
    );
    await waitFor(() => expect(keeps.rows).toHaveLength(1));
    // The row carries what the person read, the resource it belongs to, and the instant
    // from the clock this phone was given — nothing else, and nothing sent anywhere.
    expect(keeps.rows.map((row) => [row.server, row.userId, row.item])).toEqual([
      [
        "https://acme.test",
        "person-a",
        { resourceKey: "note/note", recordId: "n-1", title: "Standup", openedAt: AT },
      ],
    ]);
    // The native header's title and the remembered title are one answer, not two spellings.
    expect((header.options as { title?: string }).title).toBe("Standup");
  });

  test("the same record opened again is one memory, stamped again", async () => {
    const { keeps, recents } = memory();
    recordOn({ id: "n-1", title: "Standup", status: "open", rank: 1 });
    shell.value = { ...shell.value!, recents };
    const page = await render(
      <ThemeProvider mode="light">
        <ResourceDetail entry={note} id="n-1" />
      </ThemeProvider>,
    );
    await waitFor(() => expect(keeps.rows).toHaveLength(1));
    await page.unmount();
    await render(
      <ThemeProvider mode="light">
        <ResourceDetail entry={note} id="n-1" />
      </ThemeProvider>,
    );
    await waitFor(() => expect(keeps.calls.filter((call) => call === "save")).toHaveLength(2));
    expect(keeps.rows).toHaveLength(1);
  });

  test("a record that never arrived is not remembered", async () => {
    const { keeps, recents } = memory();
    const api = fakeApi();
    api.get.mockRejectedValue(new Error("the server refused"));
    shell.value = {
      ...shellValue(api, {
        identity: { userId: "person-a", email: "ana@example.test", permissions: [] },
        state: { phase: "ready", generation: 1, catalog },
        entry: (module, entity) =>
          catalog.resources.find((r) => r.module === module && r.entity === entity),
      }),
      recents,
    };
    await render(
      <ThemeProvider mode="light">
        <ResourceDetail entry={note} id="n-1" />
      </ThemeProvider>,
    );
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    // The read has been answered and settled: the load's own catch has run. Anything the
    // screen was going to remember it would have remembered by now.
    await act(async () => {
      await Promise.resolve();
    });
    expect(keeps.calls).toEqual([]);
    expect(keeps.rows).toEqual([]);
  });
});
