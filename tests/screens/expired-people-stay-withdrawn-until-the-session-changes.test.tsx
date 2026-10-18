// A session refusal withdraws every retained person before peers finish. Later successes
// cannot revive that session, and a replacement workspace accepts only its own answers.
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

const FIRST = "9810df53-03e9-4e5b-93d2-4a685bf4fe8e";
const SECOND = "19b989f6-b3a9-4774-b79c-5529b5d138a7";
const PHOTO = "7da745e3-2bde-47a0-b99c-631d2b857908";
const people: Entry = {
  ...note,
  module: "user",
  entity: "user",
  path: "/api/v1/user/users",
  operations: ["read"],
  fields: [
    { name: "id", type: "uuid" },
    { name: "displayName", type: "string" },
    { name: "photo", type: "uuid", present: "avatar" },
  ],
};
const catalog: Catalog = { version: 2, resources: [people] };
const pointers = [FIRST, SECOND].map((id) => ({ resource: "user/user", id }));
const at = (id: string) => nameKey("user/user", id);

afterEach(() => {
  shell.value = undefined;
});

test("a 401 withdraws both portraits and later successful reads cannot revive the expired session", async () => {
  const api = fakeApi();
  api.get.mockImplementation(async (_entry, id) => ({
    id,
    displayName: id === FIRST ? "Ines Duarte" : "Noah Park",
    photo: PHOTO,
  }));
  shell.value = shellValue(api, { state: { phase: "ready", generation: 4, catalog } });
  const view = await renderHook((visit: number) => useRecordPeople(pointers, visit), {
    initialProps: 0,
  });
  await waitFor(() => expect(Object.keys(view.result.current.people)).toHaveLength(2));

  const refused = Promise.withResolvers<Record<string, unknown>>();
  const pending = Promise.withResolvers<Record<string, unknown>>();
  api.get.mockImplementation((_entry, id) => (id === FIRST ? refused.promise : pending.promise));
  await view.rerender(1);
  expect(api.get).toHaveBeenCalledTimes(4);
  await act(async () => refused.reject(new ApiError(401, "Session expired")));
  expect(view.result.current.people).toEqual({});
  expect(view.result.current.names).toEqual({ [at(FIRST)]: "Assigned", [at(SECOND)]: "Assigned" });

  await act(async () => pending.resolve({ id: SECOND, displayName: "Late name", photo: PHOTO }));
  api.get.mockImplementation(async (_entry, id) => ({
    id,
    displayName: "Later name",
    photo: PHOTO,
  }));
  await view.rerender(2);
  expect(api.get).toHaveBeenCalledTimes(6);
  expect(view.result.current.people).toEqual({});
  expect(view.result.current.names).toEqual({ [at(FIRST)]: "Assigned", [at(SECOND)]: "Assigned" });
  expect(api.create).not.toHaveBeenCalled();
  expect(api.update).not.toHaveBeenCalled();
  expect(api.command).not.toHaveBeenCalled();
  await view.unmount();
});

test("a replacement workspace never paints a former workspace's late people for matching row ids", async () => {
  const oldApi = fakeApi();
  const late = Promise.withResolvers<Record<string, unknown>>();
  oldApi.get.mockImplementation(async (_entry, id) =>
    id === FIRST ? { id, displayName: "Former workspace", photo: PHOTO } : late.promise,
  );
  shell.value = shellValue(oldApi, {
    baseURL: "https://first.example.test",
    state: { phase: "ready", generation: 5, catalog },
  });
  const view = await renderHook(() => useRecordPeople(pointers));
  await waitFor(() => expect(view.result.current.people[at(FIRST)]?.portrait).toBe(PHOTO));

  const nextApi = fakeApi();
  const next = Promise.withResolvers<Record<string, unknown>>();
  nextApi.get.mockImplementation(() => next.promise);
  shell.value = shellValue(nextApi, {
    baseURL: "https://second.example.test",
    state: { phase: "ready", generation: 6, catalog },
  });
  await view.rerender(undefined);
  expect(view.result.current.people).toEqual({});
  await act(async () => late.resolve({ id: SECOND, displayName: "Former peer", photo: PHOTO }));
  expect(view.result.current.people).toEqual({});
  expect(view.result.current.names).toEqual({ [at(FIRST)]: "Assigned", [at(SECOND)]: "Assigned" });

  await act(async () => next.resolve({ displayName: "Current workspace" }));
  expect(view.result.current.names[at(FIRST)]).toBe("Current workspace");
  expect(view.result.current.names[at(SECOND)]).toBe("Current workspace");
  expect(view.result.current.people[at(FIRST)]?.portrait).toBeUndefined();
  expect(view.result.current.people[at(SECOND)]?.portrait).toBeUndefined();
  expect(oldApi.get).toHaveBeenCalledTimes(2);
  expect(nextApi.get).toHaveBeenCalledTimes(2);
  await view.unmount();
});
