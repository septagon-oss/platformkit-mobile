import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { Home } from "../../src/screens/Home";
import { Text as NativeText } from "react-native";
import { ResourceList } from "../../src/screens/ResourceList";
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import type { Catalog, Entry } from "../../src/core/catalog";
import { avatar, rowMedia } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
import { usePictures } from "../../src/screens/usePictures";
import { Avatar } from "../../src/ui/molecules/Avatar";
import { RowMedia } from "../../src/ui/molecules/RowMedia";
import { ThemeProvider } from "../../src/ui/theme";
import { asked, nativeRequests, resetAsked } from "../fakes/image";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

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
const FILE = "73f9dbb7-ddf0-43f1-a680-d935cbd96bf0";
const OTHER = "e18ea2af-7c22-4130-95ae-690efcc5ac0f";
const entry: Entry = {
  ...note,
  hints: { icon: "document", thumbnailField: "photo" },
  fields: [...note.fields, { name: "photo", type: "uuid", present: "image" }],
};
const files: Entry = {
  ...note,
  module: "file",
  entity: "file",
  path: "/api/v1/file/files",
  operations: ["read"],
};
const catalog: Catalog = {
  version: 2,
  resources: [entry, files],
  pictures: { source: "/api/v1/file/files/{id}/content", widths: [480, 960] },
};
function Harness({
  id = FILE,
  visit = 0,
  portrait = false,
}: {
  readonly id?: string;
  readonly visit?: number;
  readonly portrait?: boolean;
}) {
  const media = usePictures([id, id], visit);
  return (
    <ThemeProvider mode="light">
      {portrait ? (
        <Avatar
          model={avatar(
            { id: "a", name: "Ana", label: "Ana", portrait: id },
            media.states,
            media.enabled,
          )}
          renderImage={media.renderImage}
        />
      ) : (
        <RowMedia
          model={rowMedia(entry, { photo: id }, media.enabled, media.states)}
          renderImage={media.renderImage}
          testID="thumbnail"
        />
      )}
    </ThemeProvider>
  );
}
beforeEach(() => resetAsked());
afterEach(() => {
  shell.value = undefined;
});
function installed(visibility = "private") {
  const api = fakeApi();
  api.get.mockResolvedValue({ id: FILE, width: 1600, height: 900, sha256: "frame-v1", visibility });
  shell.value = shellValue(api, {
    identity: { userId: "person-a", email: "ana@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog },
    entry: (module, entity) => (module === "file" && entity === "file" ? files : entry),
  });
  return api;
}

test("one metadata read prepares header-authorized private bytes without a native cache", async () => {
  const api = installed();
  await render(<Harness />);
  await waitFor(() => expect(asked.length).toBeGreaterThan(0));
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith(files, FILE);
  expect(asked[0]?.headers).toEqual({ Authorization: "Bearer pk_live_1" });
  expect(asked[0]?.uri).toMatch(new RegExp(`/api/v1/file/files/${FILE}/content\\?w=480$`));
  expect(nativeRequests[0]?.cachePolicy).toBe("none");
  expect(nativeRequests[0]?.transition).toBe(0);
  expect(nativeRequests[0]?.source.cacheKey).not.toContain("pk_live_1");
});
test("fresh public versioned metadata earns memory caching and a new visit changes its identity", async () => {
  const api = installed("public");
  const view = await render(<Harness />);
  await waitFor(() => expect(nativeRequests.length).toBeGreaterThan(0));
  const first = nativeRequests[0]!;
  expect(first.cachePolicy).toBe("memory");
  await view.rerender(<Harness visit={1} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(nativeRequests.at(-1)?.source.cacheKey).not.toBe(first.source.cacheKey),
  );
});
test.each([403, 404])(
  "metadata HTTP %s prevents a byte request and preserves the initials",
  async (status) => {
    const api = installed();
    api.get.mockRejectedValue(new ApiError(status, "Refused"));
    await render(<Harness portrait />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(asked).toHaveLength(0);
    expect(screen.getByText("Ana")).toBeOnTheScreen();
    expect(screen.getByText("A", { includeHiddenElements: true })).toBeOnTheScreen();
  },
);
test("a transient metadata error uses only the uncached declared door", async () => {
  const api = installed();
  api.get.mockRejectedValue(new Error("Unreachable"));
  await render(<Harness />);
  await waitFor(() => expect(asked.length).toBeGreaterThan(0));
  expect(asked[0]?.uri).toBe(`https://acme.test/api/v1/file/files/${FILE}/content?w=480`);
  expect(nativeRequests[0]?.cachePolicy).toBe("none");
});
test("missing identity or bearer prepares no metadata or byte read", async () => {
  const api = installed();
  api.bearer.mockReturnValue(undefined);
  await render(<Harness />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(api.get).not.toHaveBeenCalled();
  expect(asked).toHaveLength(0);
});
test("an obsolete file load cannot replace the current picture's state", async () => {
  installed();
  const view = await render(<Harness />);
  await waitFor(() => expect(nativeRequests.length).toBeGreaterThan(0));
  const first = nativeRequests[0]!;
  await view.rerender(<Harness id={OTHER} />);
  await waitFor(() => expect(asked.at(-1)?.uri).toContain(OTHER));
  await act(async () => first.onError());
  expect(nativeRequests.at(-1)?.source.uri).toContain(OTHER);
  const active = nativeRequests.at(-1)!;
  await act(async () => active.onError());
  const count = asked.length;
  await view.rerender(<Harness id={OTHER} />);
  expect(asked.length).toBe(count);
  expect(screen.getByTestId("thumbnail", { includeHiddenElements: true })).toBeOnTheScreen();
});
test("an account change withdraws old resources before new metadata arrives", async () => {
  const api = installed("public");
  const view = await render(<Harness />);
  await waitFor(() => expect(nativeRequests.length).toBeGreaterThan(0));
  const old = nativeRequests[0]!;
  let answer!: (row: Record<string, unknown>) => void;
  api.get.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  shell.value = {
    ...shell.value!,
    identity: { userId: "person-b", email: "ben@example.test", permissions: [] },
    state: { phase: "ready", generation: 2, catalog },
  };
  resetAsked();
  await view.rerender(<Harness />);
  expect(asked).toHaveLength(0);
  await act(async () => old.onLoad());
  expect(asked).toHaveLength(0);
  await act(async () => answer({ id: FILE, width: 900, sha256: "frame-v1", visibility: "public" }));
  await waitFor(() => expect(nativeRequests.length).toBeGreaterThan(0));
  expect(nativeRequests[0]?.source.cacheKey).not.toBe(old.source.cacheKey);
});

test("the same file in two rows keeps independent loading and failure states", async () => {
  installed();
  function Twins() {
    const media = usePictures([FILE]);
    const models = ["one", "two"].map((id) =>
      rowMedia(entry, { id, photo: FILE }, media.enabled, media.states),
    );
    return (
      <ThemeProvider mode="light">
        {models.map((model, i) => (
          <React.Fragment key={i}>
            <NativeText testID={`state-${i}`}>
              {model.kind === "picture" ? model.image.state : model.kind}
            </NativeText>
            <RowMedia model={model} renderImage={media.renderImage} />
          </React.Fragment>
        ))}
      </ThemeProvider>
    );
  }
  await render(<Twins />);
  await waitFor(() => expect(nativeRequests.length).toBe(2));
  const first = nativeRequests[0]!,
    second = nativeRequests[1]!;
  expect(first.source.uri).toBe(second.source.uri);
  expect(first.recyclingKey).not.toBe(second.recyclingKey);
  await act(async () => first.onLoad());
  expect(screen.getByTestId("state-0")).toHaveTextContent("ready");
  expect(screen.getByTestId("state-1")).toHaveTextContent("loading");
  await act(async () => second.onError());
  expect(screen.getByTestId("state-0")).toHaveTextContent("ready");
  expect(screen.getByTestId("state-1")).toHaveTextContent("error");
});

test("the generated list composes its thumbnail and named assignee from the same authorized file read", async () => {
  const api = installed();
  const users: Entry = {
    ...note,
    module: "user",
    entity: "user",
    path: "/api/v1/user/users",
    fields: [
      { name: "id", type: "uuid" },
      { name: "displayName", type: "string" },
      { name: "portraitFile", type: "uuid", present: "avatar" },
    ],
  };
  const tasks: Entry = {
    ...entry,
    hints: { ...entry.hints, summaryFields: ["assigneeId"] },
    fields: [
      ...entry.fields,
      { name: "assigneeId", type: "uuid", hints: { reference: { resource: "user/user" } } },
    ],
  };
  const served = { ...catalog, resources: [tasks, files, users] };
  shell.value = { ...shell.value!, state: { phase: "ready", generation: 1, catalog: served } };
  api.list.mockImplementation(async (target) =>
    target.module === "user"
      ? { total: 1, items: [{ id: "person-a", displayName: "Ana Stone", portraitFile: FILE }] }
      : {
          total: 1,
          items: [{ id: "bridge", title: "Bridgework", photo: FILE, assigneeId: "person-a" }],
        },
  );
  await render(
    <ThemeProvider mode="light">
      <ResourceList entry={tasks} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByText("Ana Stone")).toBeOnTheScreen());
  await waitFor(() => expect(nativeRequests.length).toBeGreaterThanOrEqual(2));
  expect(screen.getByText("Bridgework")).toBeOnTheScreen();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith(files, FILE);
  expect(asked.every((request) => !request.uri.includes("pk_live_1"))).toBe(true);
});

test("the authenticated account uses its declared display name without a speculative portrait read", async () => {
  const api = installed();
  shell.value = {
    ...shell.value!,
    identity: {
      userId: "person-a",
      displayName: "Ana Stone",
      email: "ana@example.test",
      permissions: [],
    },
  };
  await render(
    <ThemeProvider mode="light">
      <Home entries={[entry]} />
    </ThemeProvider>,
  );
  expect(screen.getByText("Ana Stone")).toBeOnTheScreen();
  expect(screen.getByText("AS", { includeHiddenElements: true })).toBeOnTheScreen();
  expect(api.get).not.toHaveBeenCalled();
});
