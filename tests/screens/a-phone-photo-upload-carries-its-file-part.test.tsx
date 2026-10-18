// A camera image must reach the real API transport as a native file part, retain its
// session, and enter the body only after the file endpoint accepts that part.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { createApi } from "../../src/effects/api";
import { ResourceForm } from "../../src/screens/ResourceForm";
import { ThemeProvider } from "../../src/ui/theme";
import type { Choice } from "../../src/ui/chooser";
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
jest.mock("../../src/ui/chooser", () => ({ choose: jest.fn(), confirm: jest.fn() }));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///cache/herbs.jpg", fileName: "herbs.jpg", mimeType: "image/jpeg" }],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

interface NativePart {
  readonly fieldName: string;
  readonly uri?: string;
  readonly string?: string;
  readonly headers: Readonly<Record<string, string>>;
}

const originalFormData = globalThis.FormData;
beforeEach(() => {
  reset();
  jest.clearAllMocks();
  // Use React Native's own FormData rather than a second implementation of its file shape.
  globalThis.FormData = jest.requireActual<{ default: typeof FormData }>(
    "react-native/Libraries/Network/FormData",
  ).default;
});
afterEach(() => {
  globalThis.FormData = originalFormData;
});

test("a camera file part survives generated serialization and is inserted after authenticated upload", async () => {
  const entry: Entry = {
    ...note,
    fields: note.fields.map((f) => (f.name === "body" ? { ...f, widget: "richtext" } : f)),
  };
  const files: Entry = { ...note, module: "file", entity: "files", path: "/api/v1/file/files" };
  const fileID = "55555555-5555-4555-8555-555555555555";
  const uploads: { parts: readonly NativePart[]; credential: string | null; query: string }[] = [];
  let stored = 0;
  const api = createApi(
    "https://tenant-one.example.test",
    async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "GET" && url.pathname === `${entry.path}/note-73`)
        return pageResponse({
          id: "note-73",
          title: "Herb care",
          body: "Water the herbs in the evening.",
          status: "open",
        });
      if (init?.method === "GET" && url.pathname === files.path)
        return pageResponse({ items: [], total: 0 });
      if (init?.method === "POST" && url.pathname === files.path) {
        const form = init.body as unknown as { getParts(): readonly NativePart[] };
        const parts = form.getParts();
        uploads.push({
          parts,
          credential: new Headers(init.headers).get("Authorization"),
          query: url.search,
        });
        if (
          !parts.some(
            (part) => part.uri && part.headers["content-disposition"]?.includes("filename="),
          )
        )
          return pageResponse({ status: 422, detail: "This form carries no file." }, 422);
        stored++;
        return pageResponse(
          {
            id: fileID,
            name: "herbs.jpg",
            contentType: "image/jpeg",
            alt: "Herbs in a pot",
            decorative: false,
          },
          201,
        );
      }
      return pageResponse({ status: 404 }, 404);
    },
    key,
  );
  shell.value = shellValue(api, { entry: (module) => (module === "file" ? files : entry) });
  await render(
    <ThemeProvider mode="light">
      <ResourceForm entry={entry} id="note-73" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("save")).toBeEnabled());
  await fireEvent.press(screen.getByRole("button", { name: "Image" }));
  const { choose } =
    jest.requireMock<typeof import("../../src/ui/chooser")>("../../src/ui/chooser");
  await waitFor(() => expect(choose).toHaveBeenCalled());
  const options = jest.mocked(choose).mock.calls[0]![1] as readonly Choice[];
  const camera = options.find((option) => option.label === "Take photo");
  expect(camera).toBeDefined();
  await act(async () => camera!.onPress());
  await waitFor(() => expect(uploads).toHaveLength(1));
  expect(uploads[0]!.credential).toBe("Bearer pk_live_tenant_one");
  expect(uploads[0]!.query).toBe("?image=true");
  expect(uploads[0]!.parts).toEqual([
    expect.objectContaining({
      fieldName: "file",
      uri: "file:///cache/herbs.jpg",
      headers: {
        "content-disposition": 'form-data; name="file"; filename="herbs.jpg"',
        "content-type": "image/jpeg",
      },
    }),
  ]);
  expect(stored).toBe(1);
  expect(screen.getByTestId("input-body").props.value).toContain("Water the herbs in the evening.");
  expect(screen.getByTestId("input-body").props.value).toContain(`pk-file:${fileID}`);
});
