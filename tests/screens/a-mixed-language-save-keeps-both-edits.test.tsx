// A mixed-language Save refuses without sending either edit; reverting the translated
// field then lets the source edit save without copying the loaded translation over its source.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { copyForLocale } from "../../src/core/copy";
import { createApi } from "../../src/effects/api";
import { useResourceForm } from "../../src/screens/useResourceForm";
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
    .mockReturnValue({ ...options, locale: "pt-PT" });
});
afterEach(() => {
  jest.restoreAllMocks();
});

test.each([
  ["a complete translated answer", "pt", false],
  ["an answer naming a regional language", "pt-PT", false],
  ["an untagged answer with a field language", "", true],
])(
  "%s keeps both edits on refusal and saves a source edit after reversion",
  async (_name, language, noted) => {
    const entry: Entry = {
      ...note,
      commands: [...note.commands, { verb: "translate", fields: [] }],
      fields: note.fields.map((field) =>
        field.name === "body" ? { ...field, widget: "richtext", translatable: true } : field,
      ),
    };
    const source = "Move pots indoors at dusk.";
    const portuguese = "Leve os vasos para dentro ao anoitecer.";
    const editedBody = `${portuguese} Proteja as folhas.`;
    let storedSource = source;
    let storedTitle = "Pot storage";
    const writes: { language: string | null; body: Record<string, unknown> }[] = [];
    const api = createApi(
      "https://tenant-one.example.test",
      async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname !== `${entry.path}/note-73`) return pageResponse({ status: 404 }, 404);
        if (request.method === "GET") {
          const response = pageResponse({
            id: "note-73",
            title: storedTitle,
            body: portuguese,
            status: "open",
            ...(noted ? { _i18n: { body: { locale: "pt", status: "complete" } } } : {}),
          });
          if (language !== "") response.headers.set("Content-Language", language);
          return response;
        }
        if (request.method === "PATCH") {
          const body = (await request.json()) as Record<string, unknown>;
          const writing = url.searchParams.get("lang");
          writes.push({ language: writing, body });
          if (writing !== null) return pageResponse({ status: 422 }, 422);
          if (typeof body.title === "string") storedTitle = body.title;
          if (typeof body.body === "string") storedSource = body.body;
          return pageResponse({ id: "note-73", title: storedTitle, body: storedSource });
        }
        return pageResponse({ status: 405 }, 405);
      },
      key,
    );
    const session = shellValue(api, { entry: () => entry });
    shell.value = session;
    const { result } = await renderHook(() => useResourceForm(entry, "note-73"), {
      wrapper: ({ children }) => <ThemeProvider mode="dark">{children}</ThemeProvider>,
    });
    await waitFor(() => expect(result.current.phase).toBe("editing"));
    const loaded = result.current.blocks.flatMap((block) => block.controls);
    expect(loaded.find((control) => control.field.name === "body")?.value).toBe(portuguese);
    await act(async () => result.current.change("title", "Indoor shelf"));
    await act(async () => result.current.change("body", editedBody));
    await act(async () => result.current.save());
    expect(writes).toEqual([]);
    expect(storedTitle).toBe("Pot storage");
    expect(storedSource).toBe(source);
    expect(result.current.phase).toBe("editing");
    expect(result.current.held).toMatchObject({ title: "Indoor shelf", body: editedBody });
    expect(result.current.detail).toBe(copyForLocale("pt-PT").kit.mixedLanguageWrite);
    expect(result.current.awaiting).toBe("title");
    expect(session.wrote).not.toHaveBeenCalled();
    expect(session.say).not.toHaveBeenCalled();

    await act(async () => result.current.change("body", portuguese));
    await act(async () => result.current.save());
    expect(writes).toHaveLength(1);
    expect(writes[0]!.language).toBeNull();
    expect(writes[0]!.body).not.toHaveProperty("body");
    expect(storedTitle).toBe("Indoor shelf");
    expect(storedSource).toBe(source);
    expect(result.current.phase).toBe("saved");
    expect(session.wrote).toHaveBeenCalledTimes(1);
  },
);
