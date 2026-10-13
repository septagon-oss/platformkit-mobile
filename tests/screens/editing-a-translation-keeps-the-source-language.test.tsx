// A translated read cannot be sent back as the source-language value on Save.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { createApi } from "../../src/effects/api";
import { ResourceForm } from "../../src/screens/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { note, shell, shellValue } from "../fakes/shell";
import { pageResponse } from "../fakes/wire";

/** key is the credential this connection signs with: a phone presents a key, never a session. */
const key = { token: "pk_live_tenant_one", id: "00000000-0000-4000-8000-000000000001" };

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

beforeEach(() => {
  reset();
  const options = Intl.DateTimeFormat().resolvedOptions();
  jest
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockReturnValue({ ...options, locale: "pt-BR" });
});
afterEach(() => {
  jest.restoreAllMocks();
});

test("saving Portuguese content preserves the English source and writes the Portuguese locale", async () => {
  const entry: Entry = {
    ...note,
    commands: [...note.commands, { verb: "translate", fields: [] }],
    fields: note.fields.map((f) =>
      f.name === "body" ? { ...f, widget: "richtext", translatable: true } : f,
    ),
  };
  const source = "Provide fresh water.";
  let storedSource = source;
  let storedPortuguese = "Dê água fresca.";
  const requests: Request[] = [];
  const api = createApi(
    "https://tenant-one.example.test",
    async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      requests.push(request);
      const url = new URL(request.url);
      if (url.pathname !== `${entry.path}/note-46`) return pageResponse({ status: 404 }, 404);
      if (request.method === "GET") {
        const portuguese =
          url.searchParams.get("lang") === "pt" ||
          (!url.searchParams.has("lang") &&
            request.headers.get("Accept-Language")?.startsWith("pt"));
        return pageResponse({
          id: "note-46",
          title: "Daily care",
          status: "open",
          body: portuguese ? storedPortuguese : storedSource,
          _i18n: { body: { locale: portuguese ? "pt" : "en", status: "complete" } },
        });
      }
      if (request.method === "PATCH") {
        const body = (await request.json()) as { body?: string };
        if (body.body !== undefined) {
          if (url.searchParams.get("lang") === "pt") storedPortuguese = body.body;
          else storedSource = body.body;
        }
        return pageResponse({
          id: "note-46",
          title: "Daily care",
          body: body.body,
          status: "open",
        });
      }
      return pageResponse({ status: 405 }, 405);
    },
    key,
  );
  shell.value = shellValue(api, { entry: () => entry });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} id="note-46" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("save")).toBeEnabled());
  const loaded = screen.getByTestId("input-body").props.value as string;
  const edited = `${loaded} Sempre.`;
  await fireEvent.changeText(screen.getByTestId("input-body"), edited);
  await fireEvent.press(screen.getByTestId("save"));
  await waitFor(() => expect(requests.some((request) => request.method === "PATCH")).toBe(true));
  expect(storedSource).toBe(source);
  expect(storedPortuguese).toBe(edited);
});
