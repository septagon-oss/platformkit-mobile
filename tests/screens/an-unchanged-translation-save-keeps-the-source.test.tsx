// Saving without a changed translation must never copy its loaded words over the source,
// including when typing and undoing leaves the body exactly as it arrived.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { createApi } from "../../src/effects/api";
import { useResourceForm } from "../../src/screens/useResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { note, shell, shellValue } from "../fakes/shell";
import { pageResponse } from "../fakes/wire";

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

test.each([
  ["saving an untouched Portuguese body preserves the English source", false],
  ["saving after reverting a Portuguese body preserves the English source", true],
])("%s", async (_name, reverted) => {
  const entry: Entry = {
    ...note,
    commands: [...note.commands, { verb: "translate", fields: [] }],
    fields: note.fields.map((field) =>
      field.name === "body" ? { ...field, widget: "richtext", translatable: true } : field,
    ),
  };
  const source = "Shelter the seedlings from frost.";
  const portuguese = "Proteja as mudas da geada.";
  let storedSource = source;
  const storedPortuguese = portuguese;
  const api = createApi(
    "https://tenant-one.example.test",
    async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.pathname !== `${entry.path}/note-84`) return pageResponse({ status: 404 }, 404);
      if (request.method === "GET") {
        const response = pageResponse({
          id: "note-84",
          title: "Seedling care",
          body: storedPortuguese,
          status: "open",
        });
        response.headers.set("Content-Language", "pt");
        return response;
      }
      if (request.method === "PATCH") {
        const body = (await request.json()) as { body?: string };
        if (url.searchParams.get("lang") === "pt") {
          // An existing translation is overwritten only by its revision-aware command.
          return pageResponse({ status: 409, detail: "Use the translate command." }, 409);
        }
        if (body.body !== undefined) storedSource = body.body;
        return pageResponse({ id: "note-84", title: "Seedling care", ...body });
      }
      return pageResponse({ status: 405 }, 405);
    },
    "pk=tenant-one",
  );
  shell.value = shellValue(api, { entry: () => entry });
  const { result } = await renderHook(() => useResourceForm(entry, "note-84"), {
    wrapper: ({ children }) => <ThemeProvider mode="light">{children}</ThemeProvider>,
  });
  await waitFor(() => expect(result.current.phase).toBe("editing"));
  expect(
    result.current.blocks.flatMap((block) => block.controls).find((c) => c.field.name === "body")
      ?.value,
  ).toBe(portuguese);
  if (reverted) {
    await act(async () => result.current.change("body", `${portuguese} Ao anoitecer.`));
    await act(async () => result.current.change("body", portuguese));
  }
  await act(async () => result.current.save());
  expect(storedSource).toBe(source);
  expect(storedPortuguese).toBe(portuguese);
});
