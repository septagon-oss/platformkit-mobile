// A translatable record is requested in the device language. A source-language
// fallback is identified in Portuguese rather than silently shown as translated content.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { Text } from "react-native";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { Shell, useShell } from "../../src/shell";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { loginIdentity, pageResponse } from "../fakes/wire";
import { unresolved } from "../fakes/unresolved";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () =>
    JSON.stringify({
      version: 2,
      baseURL: "https://tenant-one.example.test",
      token: jest.requireActual<typeof import("../fakes/wire")>("../fakes/wire").issuedToken.token,
      tokenId: jest.requireActual<typeof import("../fakes/wire")>("../fakes/wire").issuedToken.id,
    }),
  setItemAsync: async () => undefined,
}));
jest.mock(
  "expo-localization",
  () => ({
    getLocales: () => [{ languageTag: "pt-BR", languageCode: "pt", regionCode: "BR" }],
  }),
  { virtual: true },
);

const originalFetch = globalThis.fetch;

beforeEach(() => {
  reset();
  const options = Intl.DateTimeFormat().resolvedOptions();
  jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    ...options,
    locale: "pt-BR",
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

function Record() {
  const { state, entry } = useShell();
  const resource = entry("note", "note");
  return state.phase === "ready" && resource ? (
    <ResourceDetail entry={resource} id="note-46" />
  ) : (
    <Text>{state.phase}</Text>
  );
}

async function read() {
  const catalog = unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8")));
  const resource = catalog.resources.find((e: { entity: string }) => e.entity === "note");
  resource.presentation = { ...resource.presentation, previewField: "status" };
  const body = resource.fields.find((f: { name: string }) => f.name === "body");
  body.widget = "richtext";
  body.translatable = true;
  const requests: Request[] = [];
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    switch (new URL(request.url).pathname) {
      case "/api/v1/auth/me":
        return pageResponse(loginIdentity);
      case "/api/v1/app/resources":
        return pageResponse(catalog);
      case `${resource.path}/note-46`: {
        const answer = pageResponse({
          id: "note-46",
          title: "Daily care",
          status: "open",
          body: "## Care plan\n\nGive **fresh water** every morning.",
          _i18n: { body: { locale: "en", status: "missing" } },
        });
        answer.headers.set("Content-Language", "en");
        return answer;
      }
      case "/api/v1/audit/events":
        return pageResponse({ items: [], total: 0 });
      default:
        return pageResponse({ status: 404 }, 404);
    }
  };
  await render(
    <ThemeProvider mode="light">
      <Shell baseURL="https://tenant-one.example.test" renderers={{}}>
        <Record />
      </Shell>
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(
      requests.some((request) => new URL(request.url).pathname === `${resource.path}/note-46`),
    ).toBe(true),
  );
  await waitFor(() => expect(screen.getByTestId("field-body")).toBeOnTheScreen());
  return requests.filter((request) => new URL(request.url).pathname === `${resource.path}/note-46`);
}

test("a Portuguese device asks for translatable content with Accept-Language", async () => {
  const requests = await read();
  expect(requests.length).toBeGreaterThan(0);
  expect(requests[0]!.headers.get("Accept-Language")).toMatch(/^pt(?:\b|-)/);
});

test("a missing Portuguese translation names the English fallback beside the body", async () => {
  await read();
  expect(screen.getByText("fresh water")).toBeOnTheScreen();
  expect(screen.getByText("Mostrado em inglês — ainda não traduzido")).toBeOnTheScreen();
});
