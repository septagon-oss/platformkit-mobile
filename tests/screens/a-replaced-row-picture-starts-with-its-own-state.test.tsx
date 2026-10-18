// Replacing one row's picture starts a new load even while another row keeps the old file.
import React from "react";
import { Text } from "react-native";
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import type { Catalog, Entry } from "../../src/core/catalog";
import { rowMedia } from "../../src/core/derive";
import { usePictures } from "../../src/screens/usePictures";
import { RowMedia } from "../../src/ui/molecules/RowMedia";
import { ThemeProvider } from "../../src/ui/theme";
import { nativeRequests, resetAsked } from "../fakes/image";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));
jest.mock("expo-image", () => ({
  Image: jest.requireActual<typeof import("../fakes/image")>("../fakes/image").ExpoImage,
}));

const ORIGINAL = "f1d672be-9ea5-4e52-b23a-5bdde4b7a615";
const REPLACEMENT = "34c736b8-2c7b-4cd9-bc77-28c2ce8a7486";
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
  pictures: { source: "/api/v1/file/files/{id}/content", widths: [480] },
};

function Rows({ first }: { readonly first: string }) {
  const media = usePictures([first, ORIGINAL]);
  return (
    <ThemeProvider mode="light">
      {[first, ORIGINAL].map((photo, i) => {
        const model = rowMedia(entry, { id: `row-${i}`, photo }, media.enabled, media.states);
        return (
          <React.Fragment key={i}>
            <Text testID={`picture-state-${i}`}>
              {model.kind === "picture" ? model.image.state : model.kind}
            </Text>
            <RowMedia model={model} renderImage={media.renderImage} />
          </React.Fragment>
        );
      })}
    </ThemeProvider>
  );
}

afterEach(() => {
  shell.value = undefined;
  resetAsked();
});

test("a replacement picture loads after the row's previous file failed in one shared slot", async () => {
  resetAsked();
  const api = fakeApi();
  api.get.mockImplementation(async (_entry, id) => ({
    id,
    width: 960,
    sha256: id,
    visibility: "private",
  }));
  shell.value = shellValue(api, {
    identity: { userId: "reader", email: "reader@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog },
    entry: (module, entity) =>
      catalog.resources.find((item) => item.module === module && item.entity === entity),
  });
  const view = await render(<Rows first={ORIGINAL} />);
  await waitFor(() => expect(nativeRequests).toHaveLength(2));
  const first = nativeRequests[0]!;
  const second = nativeRequests[1]!;
  await act(async () => {
    first.onError();
    second.onLoad();
  });
  expect(screen.getByTestId("picture-state-0")).toHaveTextContent("error");
  expect(screen.getByTestId("picture-state-1")).toHaveTextContent("ready");

  await view.rerender(<Rows first={REPLACEMENT} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(files, REPLACEMENT));
  expect(screen.getByTestId("picture-state-0")).toHaveTextContent("loading");
  expect(screen.getByTestId("picture-state-1")).toHaveTextContent("ready");
  await waitFor(() =>
    expect(nativeRequests.some((request) => request.source.uri.includes(REPLACEMENT))).toBe(true),
  );
  const replacement = nativeRequests.find((request) => request.source.uri.includes(REPLACEMENT))!;
  await act(async () => replacement.onLoad());
  expect(screen.getByTestId("picture-state-0")).toHaveTextContent("ready");
  expect(screen.getByTestId("picture-state-1")).toHaveTextContent("ready");
});
