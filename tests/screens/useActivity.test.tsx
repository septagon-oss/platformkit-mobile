import { pageResponse as response } from "../fakes/wire";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { deriveEventActivity } from "../../src/core/derive";
import { createApi, type Trail } from "../../src/effects/api";
import { useActivity } from "../../src/screens/useActivity";
import { presentation } from "../fakes/presentation";
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
      id: "c7a78f10-73e6-574a-a2e7-b23ced3d0842",
      name: "note.note.updated",
      occurredAt: "2026-09-07T10:00:00Z",
      actor: "63b9a861-2c2d-58fd-a66e-c323e3f186cb",
      payload: { id: "note-14" },
    },
  ],
  total: 3,
};

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
    items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", displayName: "Earlier actor" }],
    total: 1,
  });
  const users = { ...note, module: "user", entity: "user" };
  const scope = shellValue(api);
  shell.value = {
    ...scope,
    state: { ...scope.state, catalog: { ...scope.state.catalog!, resources: [note, users] } },
  };
  const { result } = await renderHook(() => useActivity(note, "note-14"));
  await waitFor(() =>
    expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe("Earlier actor"),
  );
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
  recovered.resolve(
    response({
      items: [{ ...first.items[0]!, id: "1b1ec132-86f1-5b73-be9a-e81fd18e4846" }],
      total: 1,
    }),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.denied).toBe(false);
  expect(result.current.events.map((e) => e.id)).toEqual(["1b1ec132-86f1-5b73-be9a-e81fd18e4846"]);
  expect(result.current.names).toEqual({});
  expect(result.current.error).toBe("");
});

test("an ordinary page failure retains readable history and retries the same offset", async () => {
  const fetch = jest.fn<typeof globalThis.fetch>();
  fetch
    .mockResolvedValueOnce(response(first))
    .mockResolvedValueOnce(response({ detail: "Temporarily unavailable" }, 503))
    .mockResolvedValueOnce(
      response({
        items: [{ ...first.items[0]!, id: "4a0b7293-0b09-5d5c-b06a-fdf785d7e62f" }],
        total: 2,
      }),
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

test.each([403, 404])(
  "directory HTTP %s withdraws email enrichment until a fresh lookup while history remains readable",
  async (status) => {
    const fetch = jest.fn<typeof globalThis.fetch>();
    const recovered = Promise.withResolvers<Response>();
    fetch
      .mockResolvedValueOnce(
        response({
          items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", email: "earlier@example.test" }],
          total: 1,
        }),
      )
      .mockResolvedValueOnce(response({ detail: "Temporary directory failure" }, 503))
      .mockResolvedValueOnce(response({ detail: "Directory access withdrawn" }, status))
      .mockResolvedValueOnce(response({ detail: "Still unavailable" }, 503))
      .mockReturnValueOnce(recovered.promise);
    const api = fakeApi();
    api.events.mockResolvedValue(first);
    api.list.mockImplementation(createApi("https://example.test", fetch).list);
    const users = { ...note, module: "user", entity: "user" };
    const scope = shellValue(api);
    shell.value = {
      ...scope,
      state: { ...scope.state, catalog: { ...scope.state.catalog!, resources: [note, users] } },
    };
    const { result } = await renderHook(() => useActivity(note, "note-14"));
    await waitFor(() =>
      expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe(
        "earlier@example.test",
      ),
    );

    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("Temporary directory failure"));
    expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe(
      "earlier@example.test",
    );

    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("Directory access withdrawn"));
    expect(result.current.names).toEqual({});
    expect(result.current.events).toEqual(first.items);
    expect(result.current.denied).toBe(false);
    expect(result.current.more).toBe(true);
    const activity = deriveEventActivity(result.current, presentation);
    expect(activity.ok).toBe(true);
    if (activity.ok) {
      // The read lost its directory, so the row says a name is unavailable. It is
      // never the user id: that is a fact about the store, quoted to a person who
      // cannot look anything up with it.
      expect(activity.value.rows.map((row) => row.actor)).toEqual([
        presentation.copy.kit.nameUnavailable,
      ]);
      expect(activity.value.more).toBeDefined();
    }

    api.events.mockResolvedValueOnce({
      items: [{ ...first.items[0]!, id: "831f9205-139e-5518-bf01-60e00c2588f5" }],
      total: 2,
    });
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(api.events).toHaveBeenLastCalledWith({ record: "note-14", offset: 1, limit: 20 });
    expect(api.list).toHaveBeenCalledTimes(3);
    expect(result.current.names).toEqual({});

    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("Still unavailable"));
    expect(result.current.names).toEqual({});
    expect(result.current.events).toEqual(first.items);

    await act(async () => result.current.reload());
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(5));
    expect(result.current.loading).toBe(true);
    expect(result.current.names).toEqual({});
    recovered.resolve(
      response({
        items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", email: "fresh@example.test" }],
        total: 1,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe("fresh@example.test");
    expect(result.current.error).toBe("");
  },
);

test.each([403, 404])(
  "an obsolete directory success cannot restore names after HTTP %s",
  async (status) => {
    const obsolete = Promise.withResolvers<Response>();
    const fetch = jest.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        response({
          items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", displayName: "Earlier actor" }],
          total: 1,
        }),
      )
      .mockReturnValueOnce(obsolete.promise)
      .mockResolvedValueOnce(response({ detail: "Directory access withdrawn" }, status));
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
    await waitFor(() =>
      expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe("Earlier actor"),
    );
    await act(async () => result.current.reload());
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("Directory access withdrawn"));
    await act(async () => {
      obsolete.resolve(
        response({
          items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", displayName: "Obsolete actor" }],
          total: 1,
        }),
      );
      await api.list.mock.results[1]!.value;
    });
    expect(result.current.names).toEqual({});
    expect(result.current.events).toEqual(first.items);
    expect(result.current.error).toBe("Directory access withdrawn");
  },
);

test.each([401, 403, 404, 503])(
  "retained pagination callbacks wait for the current event and directory read, including HTTP %s",
  async (status) => {
    const refreshed = Promise.withResolvers<Trail>();
    const directory = Promise.withResolvers<Response>();
    const fetch = jest.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        response({
          items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", email: "earlier@example.test" }],
          total: 1,
        }),
      )
      .mockReturnValueOnce(directory.promise);
    const api = fakeApi();
    api.events.mockResolvedValueOnce(first).mockReturnValueOnce(refreshed.promise);
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
    expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe(
      "earlier@example.test",
    );
    const more = result.current.loadMore;

    // A callback retained by a consumer must observe the new read even before
    // React renders its loading state.
    await act(async () => {
      result.current.reload();
      more();
    });
    expect(api.events).toHaveBeenCalledTimes(2);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(true);
    const refreshing = deriveEventActivity(result.current, presentation);
    expect(refreshing.ok).toBe(true);
    if (refreshing.ok) expect(refreshing.value.more).toMatchObject({ busy: true, enabled: false });

    await act(async () => refreshed.resolve(first));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    await act(async () => more());
    expect(api.events).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    const enriching = deriveEventActivity(result.current, presentation);
    expect(enriching.ok).toBe(true);
    if (enriching.ok) expect(enriching.value.more).toMatchObject({ busy: true, enabled: false });

    await act(async () => {
      directory.resolve(response({ detail: "Directory read failed" }, status));
      await expect(api.list.mock.results[1]!.value).rejects.toHaveProperty("status", status);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.loadingMore).toBe(false);
    expect(result.current.error).toBe("Directory read failed");
    expect(result.current.names).toEqual(
      status === 503 ? { "63b9a861-2c2d-58fd-a66e-c323e3f186cb": "earlier@example.test" } : {},
    );
    expect(result.current.events).toEqual(status === 401 ? [] : first.items);
    expect(result.current.denied).toBe(status === 401);

    api.events.mockResolvedValue(first);
    fetch.mockResolvedValue(
      response({
        items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", displayName: "Current actor" }],
        total: 1,
      }),
    );
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe("Current actor");
    expect(result.current.denied).toBe(false);
    expect(result.current.error).toBe("");
    const ready = deriveEventActivity(result.current, presentation);
    expect(ready.ok).toBe(true);
    if (ready.ok) expect(ready.value.more).toMatchObject({ busy: false, enabled: true });

    const older = Promise.withResolvers<Trail>();
    api.events.mockReturnValueOnce(older.promise);
    await act(async () => {
      more();
      more();
    });
    expect(api.events).toHaveBeenCalledTimes(4);
    expect(api.events).toHaveBeenLastCalledWith({ record: "note-14", offset: 1, limit: 20 });
    expect(result.current.loadingMore).toBe(true);
    await act(async () =>
      older.resolve({
        items: [{ ...first.items[0]!, id: "28ce5fd3-865e-5523-b021-54b4c16e1af3" }],
        total: 2,
      }),
    );
    expect(result.current.events.map((event) => event.id)).toEqual([
      "c7a78f10-73e6-574a-a2e7-b23ced3d0842",
      "28ce5fd3-865e-5523-b021-54b4c16e1af3",
    ]);
    expect(result.current.loadingMore).toBe(false);
    expect(result.current.more).toBe(false);
    expect(api.list).toHaveBeenCalledTimes(3);
  },
);

test("an obsolete read cannot unlock pagination while a newer directory read is pending", async () => {
  const obsolete = Promise.withResolvers<Response>();
  const current = Promise.withResolvers<Response>();
  const fetch = jest.fn<typeof globalThis.fetch>();
  fetch
    .mockResolvedValueOnce(
      response({
        items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", displayName: "Earlier actor" }],
        total: 1,
      }),
    )
    .mockReturnValueOnce(obsolete.promise)
    .mockReturnValueOnce(current.promise);
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
  await act(async () => result.current.reload());
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  await act(async () => result.current.reload());
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(3));

  await act(async () => {
    obsolete.resolve(
      response({
        items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", displayName: "Obsolete" }],
        total: 1,
      }),
    );
    await api.list.mock.results[1]!.value;
  });
  await act(async () => result.current.loadMore());
  expect(api.events).toHaveBeenCalledTimes(3);
  expect(result.current.loading).toBe(true);
  expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe("Earlier actor");

  await act(async () => {
    current.resolve(
      response({
        items: [{ id: "63b9a861-2c2d-58fd-a66e-c323e3f186cb", displayName: "Current" }],
        total: 1,
      }),
    );
    await api.list.mock.results[2]!.value;
  });
  expect(result.current.loading).toBe(false);
  expect(result.current.names["63b9a861-2c2d-58fd-a66e-c323e3f186cb"]).toBe("Current");
  api.events.mockResolvedValueOnce({ items: [{ ...first.items[0]!, id: "older-74" }], total: 2 });
  await act(async () => result.current.loadMore());
  expect(api.events).toHaveBeenLastCalledWith({ record: "note-14", offset: 1, limit: 20 });
  expect(result.current.events).toHaveLength(2);
  expect(result.current.more).toBe(false);
});
