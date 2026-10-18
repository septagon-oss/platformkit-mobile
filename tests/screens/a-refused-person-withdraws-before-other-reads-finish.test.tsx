import { afterEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { Catalog, Entry } from "../../src/core/catalog";
import { nameKey } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
import { useRecordPeople } from "../../src/screens/useReferenceNames";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

const REFUSED = "b1450910-9154-4f1c-936a-d09cd9ed10eb";
const PENDING = "c2b79e1f-4b6e-4130-af6c-299527bc02ab";
const PORTRAIT = "aa172760-0dcb-42ef-ab7d-8b303f42f221";
const users: Entry = {
  ...note,
  module: "user",
  entity: "user",
  path: "/api/v1/user/users",
  operations: ["read"],
  fields: [
    { name: "id", type: "uuid" },
    { name: "displayName", type: "string" },
    { name: "portrait", type: "uuid", present: "avatar" },
  ],
};
const catalog: Catalog = { version: 2, resources: [users] };
const pointers = [REFUSED, PENDING].map((id) => ({ resource: "user/user", id }));
const at = nameKey("user/user", REFUSED);

afterEach(() => {
  shell.value = undefined;
});

test.each([
  { status: 403, supersede: false },
  { status: 404, supersede: false },
  { status: 403, supersede: true },
  { status: 404, supersede: true },
])(
  "HTTP $status withdraws a person's name and portrait despite a pending peer and superseding refresh: $supersede",
  async ({ status, supersede }) => {
    const api = fakeApi();
    api.get.mockImplementation(async (_entry, id) => ({
      id,
      displayName: id === REFUSED ? "Lina Ramos" : "Pavel Chen",
      portrait: PORTRAIT,
    }));
    shell.value = shellValue(api, {
      identity: { userId: "reader", email: "reader@example.test", permissions: [] },
      state: { phase: "ready", generation: 1, catalog },
    });
    const view = await renderHook((visit: number) => useRecordPeople(pointers, visit), {
      initialProps: 0,
    });
    await waitFor(() => expect(view.result.current.people[at]?.portrait).toBe(PORTRAIT));
    expect(view.result.current.names[at]).toBe("Lina Ramos");

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
      expect(view.result.current.people[at]).toBeUndefined();
      expect(view.result.current.names[at]).not.toBe("Lina Ramos");
      expect(view.result.current.people[nameKey("user/user", PENDING)]?.name).toBe("Pavel Chen");
    } finally {
      await act(async () => pending.resolve({ id: PENDING, displayName: "Pavel Chen" }));
      await view.unmount();
    }
  },
);
