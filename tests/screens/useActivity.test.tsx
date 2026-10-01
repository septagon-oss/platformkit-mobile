import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createApi, type Trail } from "../../src/effects/api";
import { useActivity } from "../../src/screens/useActivity";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

beforeEach(reset);

const first: Trail = {
  items: [
    {
      id: "event-14",
      name: "note.note.updated",
      occurredAt: "2026-09-07T10:00:00Z",
      actor: "actor-6",
      payload: { id: "note-14" },
    },
  ],
  total: 3,
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("session denial clears actor names and history through a pending reload until fresh content arrives", async () => {
  const fetch = jest.fn<typeof globalThis.fetch>();
  const recovered = Promise.withResolvers<Response>();
  fetch
    .mockResolvedValueOnce(response(first))
    .mockResolvedValueOnce(response({ detail: "Session refused" }, 401))
    .mockReturnValueOnce(recovered.promise);
  const api = fakeApi();
  api.events.mockImplementation(createApi("https://example.test", fetch).events);
  api.list.mockResolvedValue({
    items: [{ id: "actor-6", displayName: "Earlier actor" }],
    total: 1,
  });
  const users = { ...note, module: "user", entity: "user" };
  const scope = shellValue(api);
  shell.value = {
    ...scope,
    state: { ...scope.state, catalog: { ...scope.state.catalog!, resources: [note, users] } },
  };
  const { result } = await renderHook(() => useActivity(note, "note-14"));
  await waitFor(() => expect(result.current.names["actor-6"]).toBe("Earlier actor"));
  expect(result.current.events).toEqual(first.items);
  await act(async () => result.current.loadMore());
  await waitFor(() => expect(result.current.error).toBe("Session refused"));
  expect(result.current.denied).toBe(true);
  expect(result.current.events).toEqual([]);
  expect(result.current.names).toEqual({});
  expect(result.current.more).toBe(false);
  expect(result.current.loadingMore).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(2);

  await act(async () => result.current.reload());
  expect(result.current.loading).toBe(true);
  expect(result.current.denied).toBe(true);
  expect(result.current.events).toEqual([]);
  expect(api.events).toHaveBeenLastCalledWith({ record: "note-14", offset: 0, limit: 20 });
  api.list.mockResolvedValue({ items: [], total: 0 });
  recovered.resolve(response({ items: [{ ...first.items[0]!, id: "fresh-event" }], total: 1 }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.denied).toBe(false);
  expect(result.current.events.map((e) => e.id)).toEqual(["fresh-event"]);
  expect(result.current.names).toEqual({});
  expect(result.current.error).toBe("");
});

test("an ordinary page failure retains readable history and retries the same offset", async () => {
  const fetch = jest.fn<typeof globalThis.fetch>();
  fetch
    .mockResolvedValueOnce(response(first))
    .mockResolvedValueOnce(response({ detail: "Temporarily unavailable" }, 503))
    .mockResolvedValueOnce(
      response({ items: [{ ...first.items[0]!, id: "older-event" }], total: 2 }),
    );
  const api = fakeApi();
  api.events.mockImplementation(createApi("https://example.test", fetch).events);
  shell.value = shellValue(api);
  const { result } = await renderHook(() => useActivity(note, "note-14"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.loadMore());
  await waitFor(() => expect(result.current.error).toBe("Temporarily unavailable"));
  expect(result.current.denied).toBe(false);
  expect(result.current.events).toEqual(first.items);
  expect(result.current.more).toBe(true);
  await act(async () => result.current.loadMore());
  await waitFor(() => expect(result.current.events).toHaveLength(2));
  expect(api.events.mock.calls.slice(1)).toEqual([
    [{ record: "note-14", offset: 1, limit: 20 }],
    [{ record: "note-14", offset: 1, limit: 20 }],
  ]);
  expect(result.current.error).toBe("");
});

test.each([403, 404])(
  "a decoded HTTP %s empty trail withdraws previously read pages",
  async (status) => {
    const fetch = jest.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(response(first))
      .mockResolvedValueOnce(response({ detail: "Unavailable" }, status));
    const api = fakeApi();
    api.events.mockImplementation(createApi("https://example.test", fetch).events);
    shell.value = shellValue(api);
    const { result } = await renderHook(() => useActivity(note, "note-14"));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.more).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBe("");
  },
);

test("a session refusal during actor lookup withdraws the already read events", async () => {
  const fetch = jest.fn<typeof globalThis.fetch>();
  fetch.mockResolvedValueOnce(response({ detail: "Session refused" }, 401));
  const api = fakeApi();
  api.events.mockResolvedValue(first);
  api.list.mockImplementation(createApi("https://example.test", fetch).list);
  const scope = shellValue(api);
  shell.value = {
    ...scope,
    state: {
      ...scope.state,
      catalog: {
        ...scope.state.catalog!,
        resources: [note, { ...note, module: "user", entity: "user" }],
      },
    },
  };
  const { result } = await renderHook(() => useActivity(note, "note-14"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("Session refused");
  expect(result.current.denied).toBe(true);
  expect(result.current.events).toEqual([]);
  expect(result.current.more).toBe(false);
});
