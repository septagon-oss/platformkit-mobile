// A source-only field remains a source write even when the same read contains a
// translation; saving it must keep the unedited translated body out of that write.
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

test("renaming a source-only title on a Portuguese read saves the title and preserves both bodies", async () => {
  const entry: Entry = {
    ...note,
    commands: [...note.commands, { verb: "translate", fields: [] }],
    fields: note.fields.map((field) =>
      field.name === "body" ? { ...field, widget: "richtext", translatable: true } : field,
    ),
  };
  const source = "Keep the path clear.";
  const portuguese = "Mantenha o caminho livre.";
  let storedTitle = "Garden access";
  let storedSource = source;
  const writes: { language: string | null; body: Record<string, unknown> }[] = [];
  const api = createApi(
    "https://tenant-one.example.test",
    async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.pathname !== `${entry.path}/note-96`) return pageResponse({ status: 404 }, 404);
      if (request.method === "GET") {
        const response = pageResponse({
          id: "note-96",
          title: storedTitle,
          body: portuguese,
          status: "open",
        });
        response.headers.set("Content-Language", "pt");
        return response;
      }
      if (request.method === "PATCH") {
        const body = (await request.json()) as Record<string, unknown>;
        const language = url.searchParams.get("lang");
        writes.push({ language, body });
        if (language === "pt") {
          return pageResponse({ status: 422, detail: "title is not a translatable field." }, 422);
        }
        if (typeof body.title === "string") storedTitle = body.title;
        if (typeof body.body === "string") storedSource = body.body;
        return pageResponse({ id: "note-96", title: storedTitle, body: storedSource });
      }
      return pageResponse({ status: 405 }, 405);
    },
    "pk=tenant-one",
  );
  shell.value = shellValue(api, { entry: () => entry });
  const { result } = await renderHook(() => useResourceForm(entry, "note-96"), {
    wrapper: ({ children }) => <ThemeProvider mode="light">{children}</ThemeProvider>,
  });
  await waitFor(() => expect(result.current.phase).toBe("editing"));
  expect(
    result.current.blocks.flatMap((block) => block.controls).find((c) => c.field.name === "body")
      ?.value,
  ).toBe(portuguese);
  await act(async () => result.current.change("title", "North garden access"));
  await act(async () => result.current.save());
  expect(storedTitle).toBe("North garden access");
  expect(storedSource).toBe(source);
  expect(writes).toHaveLength(1);
  expect(writes[0]!.body).not.toHaveProperty("body");
  expect(result.current.phase).toBe("saved");
});
