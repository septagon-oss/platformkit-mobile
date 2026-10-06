// A directory refusal empties the actor names a trail shows, and a response to a request the
// screen no longer wants cannot put them back: the detail keeps its own history, refuses to
// enrich it from a stale lookup, and writes nothing.
import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import { deriveEventActivity } from "../../src/core/derive";
import { createApi } from "../../src/effects/api";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { useActivity } from "../../src/screens/useActivity";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

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

beforeEach(reset);

const actor = "actor-91";
const users = { ...note, module: "user", entity: "user", path: "/api/v1/user/users" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const trail = (id: string) => ({
  items: [
    {
      id,
      name: "note.note.updated",
      occurredAt: "2026-08-04T11:00:00Z",
      actor,
      payload: { id: "note-91" },
    },
  ],
  total: 1,
});

for (const mode of ["light", "dark"] as const) {
  test.each([403, 404])(
    `${mode} activity removes cached actor details after directory HTTP %s`,
    async (status) => {
      const privateName = "Previously readable actor ninety-one";
      const fetch = jest.fn<typeof globalThis.fetch>();
      fetch
        .mockResolvedValueOnce(response(trail("event-91")))
        .mockResolvedValueOnce(
          response({ items: [{ id: actor, displayName: privateName }], total: 1 }),
        )
        .mockResolvedValueOnce(response(trail("event-92")))
        .mockResolvedValueOnce(response({ detail: "Directory unavailable" }, status))
        .mockResolvedValueOnce(response(trail("event-93")))
        .mockResolvedValueOnce(
          response({ items: [{ id: actor, displayName: "Newly authorized name" }], total: 1 }),
        );
      const transport = createApi("https://example.test", fetch);
      const api = fakeApi();
      api.events.mockImplementation(transport.events);
      api.list.mockImplementation(transport.list);
      api.get.mockResolvedValue({ id: "note-91", title: "Note ninety-one" });
      const scope = shellValue(api);
      const ready = {
        ...scope,
        state: { ...scope.state, catalog: { ...scope.state.catalog!, resources: [note, users] } },
      };
      shell.value = ready;
      const detail = () => (
        <ThemeProvider mode={mode}>
          <ResourceDetail entry={note} id="note-91" />
        </ThemeProvider>
      );
      const { rerender } = await render(detail());
      await waitFor(() => expect(screen.getByText(privateName)).toBeOnTheScreen());

      // A write invalidation uses the real generated-screen refresh path. The
      // audit read succeeds; the separate actor directory is now forbidden or
      // missing. A still-present catalog entry is not proof of current access.
      shell.value = { ...ready, writes: { "note/note": 1 } };
      await rerender(detail());
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
      await act(async () => {
        await expect(api.list.mock.results[1]!.value).rejects.toHaveProperty("status", status);
      });
      expect(await fetch.mock.results[3]!.value).toHaveProperty("status", status);
      expect(api.list).toHaveBeenLastCalledWith(users, { limit: 200 });
      expect(api.events).toHaveBeenLastCalledWith({ record: "note-91", offset: 0, limit: 20 });
      expect(api.create).not.toHaveBeenCalled();
      expect(api.update).not.toHaveBeenCalled();
      expect(api.remove).not.toHaveBeenCalled();
      expect(api.command).not.toHaveBeenCalled();
      expect(ready.wrote).not.toHaveBeenCalled();

      // Reachability is the decoded status and completed request, never the
      // forbidden name, error sentence or a redirect the cure should remove.
      await waitFor(() =>
        expect({
          text: screen.queryAllByText(privateName, { includeHiddenElements: true }).length,
          labels: screen.queryAllByLabelText(new RegExp(privateName), {
            includeHiddenElements: true,
          }).length,
        }).toEqual({ text: 0, labels: 0 }),
      );

      // Hiding all history permanently cannot satisfy the contract: only a
      // later authorized directory read may restore a resolved actor name.
      shell.value = { ...ready, writes: { "note/note": 2 } };
      await rerender(detail());
      await waitFor(() => expect(screen.getByText("Newly authorized name")).toBeOnTheScreen());
      expect(screen.queryByText(privateName, { includeHiddenElements: true })).toBeNull();
    },
  );
}

test("an obsolete actor response cannot revive a session-denied trail", async () => {
  const oldDirectory = Promise.withResolvers<Response>();
  const fetch = jest.fn<typeof globalThis.fetch>();
  fetch
    .mockResolvedValueOnce(response(trail("event-before-denial")))
    .mockReturnValueOnce(oldDirectory.promise)
    .mockResolvedValueOnce(response({ detail: "Session unavailable" }, 401))
    .mockResolvedValueOnce(response({ detail: "Temporarily unavailable" }, 503))
    .mockResolvedValueOnce(response(trail("event-after-recovery")))
    .mockResolvedValueOnce(
      response({ items: [{ id: actor, displayName: "Fresh actor" }], total: 1 }),
    );
  const transport = createApi("https://example.test", fetch);
  const api = fakeApi();
  api.events.mockImplementation(transport.events);
  api.list.mockImplementation(transport.list);
  const scope = shellValue(api);
  shell.value = {
    ...scope,
    state: { ...scope.state, catalog: { ...scope.state.catalog!, resources: [note, users] } },
  };
  const { result } = await renderHook(() => useActivity(note, "note-91"));
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
  await act(async () => result.current.reload());
  await waitFor(() => expect(result.current.denied).toBe(true));
  await act(async () => {
    oldDirectory.resolve(
      response({ items: [{ id: actor, displayName: "Obsolete actor" }], total: 1 }),
    );
    await api.list.mock.results[0]!.value;
  });
  expect(result.current.events).toEqual([]);
  expect(result.current.names).toEqual({});
  expect(result.current.more).toBe(false);
  await act(async () => result.current.reload());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.denied).toBe(true);
  const denied = deriveEventActivity(result.current, presentation);
  expect(denied.ok).toBe(true);
  if (denied.ok) {
    expect(denied.value.rows).toEqual([]);
    expect(denied.value.more).toBeUndefined();
    expect(denied.value.state?.actions).toEqual([]);
  }
  await act(async () => result.current.reload());
  await waitFor(() => expect(result.current.names[actor]).toBe("Fresh actor"));
  expect(result.current.denied).toBe(false);
  expect(result.current.events.map((event) => event.id)).toEqual(["event-after-recovery"]);
  expect(api.create).not.toHaveBeenCalled();
  expect(api.update).not.toHaveBeenCalled();
  expect(api.remove).not.toHaveBeenCalled();
  expect(api.command).not.toHaveBeenCalled();
});
