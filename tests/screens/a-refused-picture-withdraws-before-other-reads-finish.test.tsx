// An explicit refusal settles its picture independently of unrelated pending metadata reads.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { Catalog, Entry } from "../../src/core/catalog";
import type { ImageSlotProps } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
import { usePictures } from "../../src/screens/usePictures";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

const REFUSED = "072aecbf-c97c-4e6d-b606-f2b195f8f4da";
const PENDING = "54d50bef-e0ca-425a-a4b4-6104cc966959";
const files: Entry = {
  ...note,
  module: "file",
  entity: "file",
  path: "/api/v1/file/files",
  operations: ["read"],
};
const catalog: Catalog = {
  version: 2,
  resources: [files],
  pictures: { source: "/api/v1/file/files/{id}/content" },
};
const slot: ImageSlotProps = {
  id: REFUSED,
  instance: "portrait",
  description: "",
  decorative: true,
  fit: "cover",
  aspectRatio: 1,
};

afterEach(() => {
  shell.value = undefined;
});

test.each([
  { status: 403, supersede: false },
  { status: 404, supersede: false },
  { status: 403, supersede: true },
  { status: 404, supersede: true },
])(
  "HTTP $status withdraws its picture despite a pending peer and a superseding refresh: $supersede",
  async ({ status, supersede }) => {
    const api = fakeApi();
    api.get.mockImplementation(async (_entry, id) => ({ id, visibility: "private" }));
    shell.value = shellValue(api, {
      identity: { userId: "reader", email: "reader@example.test", permissions: [] },
      state: { phase: "ready", generation: 1, catalog },
      entry: () => files,
    });
    const view = await renderHook((visit: number) => usePictures([REFUSED, PENDING], visit), {
      initialProps: 0,
    });
    await waitFor(() => expect(view.result.current.renderImage(slot)).not.toBeNull());
    const previous = view.result.current.renderImage(slot)!;
    await act(async () => previous.props.onState(REFUSED, "ready"));
    expect(view.result.current.states.portrait).toBe("ready");

    const refused = Promise.withResolvers<Record<string, unknown>>();
    const pending = Promise.withResolvers<Record<string, unknown>>();
    api.get.mockImplementation((_entry, id) =>
      id === REFUSED ? refused.promise : pending.promise,
    );
    await view.rerender(1);
    expect(api.get).toHaveBeenCalledTimes(4);
    await act(async () => refused.reject(new ApiError(status, "Refused")));
    try {
      if (supersede) {
        api.get.mockRejectedValue(new ApiError(503, "Unavailable"));
        await view.rerender(2);
        expect(api.get).toHaveBeenCalledTimes(6);
        await act(async () => {
          await Promise.resolve();
        });
      }
      expect(view.result.current.renderImage(slot)).toBeNull();
      await act(async () => previous.props.onState(REFUSED, "ready"));
      expect(view.result.current.renderImage(slot)).toBeNull();
    } finally {
      await act(async () => pending.resolve({ id: PENDING, visibility: "private" }));
      await view.unmount();
    }
  },
);
