// Content-Language names the requested locale; _i18n may instead name the source of a
// fallback. A translator's edit in that locale must preserve the source in both cases.
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

test.each([
  [
    "saving a complete Portuguese translation named by the response header preserves the English source",
    false,
  ],
  [
    "translating an English fallback in the requested Portuguese locale preserves the English source",
    true,
  ],
])("%s", async (_name, fallback) => {
  const entry: Entry = {
    ...note,
    commands: [...note.commands, { verb: "translate", fields: [] }],
    fields: note.fields.map((f) =>
      f.name === "body" ? { ...f, widget: "richtext", translatable: true } : f,
    ),
  };
  const source = "Water the herbs in the evening.";
  let storedSource = source;
  let storedPortuguese: string | undefined = fallback ? undefined : "Regue as ervas à noite.";
  const requests: Request[] = [];
  const api = createApi(
    "https://tenant-one.example.test",
    async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      requests.push(request);
      const url = new URL(request.url);
      if (url.pathname !== `${entry.path}/note-73`) return pageResponse({ status: 404 }, 404);
      if (request.method === "GET") {
        const portuguese = request.headers.get("Accept-Language")?.startsWith("pt");
        const response = pageResponse({
          id: "note-73",
          title: "Herb care",
          status: "open",
          body: portuguese ? (storedPortuguese ?? storedSource) : storedSource,
          ...(portuguese && storedPortuguese === undefined
            ? { _i18n: { body: { locale: "en", status: "missing" } } }
            : {}),
        });
        response.headers.set("Content-Language", portuguese ? "pt" : "en");
        return response;
      }
      if (request.method === "PATCH") {
        const body = (await request.json()) as { body?: string };
        if (body.body !== undefined) {
          if (url.searchParams.get("lang") === "pt") storedPortuguese = body.body;
          else storedSource = body.body;
        }
        return pageResponse({ id: "note-73", title: "Herb care", status: "open", ...body });
      }
      return pageResponse({ status: 405 }, 405);
    },
    key,
  );
  shell.value = shellValue(api, { entry: () => entry });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} id="note-73" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("save")).toBeEnabled());
  expect(screen.getByTestId("input-body").props.value).toBe(
    fallback ? storedSource : storedPortuguese,
  );
  const edited = "Regue as ervas à noite. Use pouca água.";
  await fireEvent.changeText(screen.getByTestId("input-body"), edited);
  await fireEvent.press(screen.getByTestId("save"));
  await waitFor(() => expect(requests.some((request) => request.method === "PATCH")).toBe(true));
  expect(storedSource).toBe(source);
  expect(storedPortuguese).toBe(edited);
  const patch = requests.find((request) => request.method === "PATCH")!;
  expect(new URL(patch.url).searchParams.get("lang")).toBe("pt");
});
