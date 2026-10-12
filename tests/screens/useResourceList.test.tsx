// useResourceList is the list's imperative shell, and this file is its half of the
// rule a refusal is classified with its reason: a first read that failed leaves no
// rows and says the resource could not be loaded, a refresh that could not be
// answered keeps the rows a person is looking at and says when they were last read,
// and a record set the server took away is taken off the screen.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useResourceList } from "../../src/screens/useResourceList";
import { ApiError } from "../../src/effects/api";
import { feedback } from "../fakes/presentation";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

let api: ReturnType<typeof fakeApi>;

beforeEach(() => {
  reset();
  api = fakeApi();
  shell.value = shellValue(api);
});

const rows = [
  { id: "1", title: "Buy milk" },
  { id: "2", title: "Write the brief" },
];

describe("useResourceList", () => {
  test("a first read answered 500 says the resource could not be loaded and shows no rows", async () => {
    api.list.mockRejectedValue(new ApiError(500, "crud: invalid: upstream"));
    const { result } = await renderHook(() => useResourceList(note, feedback));
    await waitFor(() => expect(result.current.error).toBe("We couldn't load notes."));
    expect(result.current.rows).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  test("a refresh answered 503 keeps the rows and names the last read", async () => {
    api.list.mockResolvedValueOnce({ items: rows, total: 2 });
    const { result } = await renderHook(() => useResourceList(note, feedback));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    api.list.mockRejectedValueOnce(new ApiError(503, "upstream"));
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.error).toMatch(/^Couldn't refresh\./));
    expect(result.current.rows).toHaveLength(2);
  });

  test("a refresh answered 403 takes the rows away and says the access went", async () => {
    api.list.mockResolvedValueOnce({ items: rows, total: 2 });
    const { result } = await renderHook(() => useResourceList(note, feedback));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    api.list.mockRejectedValueOnce(new ApiError(403, "not yours"));
    await act(async () => result.current.refresh());
    await waitFor(() =>
      expect(result.current.error).toBe("You no longer have access to this item."),
    );
    expect(result.current.rows).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  test("the order a list was narrowed to is the order its next page is asked for", async () => {
    api.list.mockResolvedValue({ items: rows, total: 4 });
    const { result } = await renderHook(() => useResourceList(note, feedback));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    await act(async () =>
      result.current.setOrder({ sort: "dueAt", filters: { status: "resolved" } }),
    );
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(api.list.mock.calls[1]![1]).toEqual({
      offset: 0,
      limit: 20,
      sort: "dueAt",
      filters: ["status:resolved"],
    });
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(3));
    // The window grew under the same question: paging is not a fresh one.
    expect(api.list.mock.calls[2]![1]).toEqual({
      offset: 2,
      limit: 20,
      sort: "dueAt",
      filters: ["status:resolved"],
    });
  });

  test("a changed order re-reads from the first page instead of stitching a new one on", async () => {
    api.list.mockResolvedValue({ items: rows, total: 60 });
    const { result } = await renderHook(() => useResourceList(note, feedback));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(4));
    await act(async () => result.current.setOrder({ sort: "title", filters: {} }));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    const last = api.list.mock.calls[api.list.mock.calls.length - 1]![1];
    expect(last).toMatchObject({ offset: 0, sort: "title", filters: [] });
  });

  test("one sheet holds the screen at a time, and closing it is the same answer", async () => {
    api.list.mockResolvedValue({ items: rows, total: 2 });
    const { result } = await renderHook(() => useResourceList(note, feedback));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.sheet).toBe("none");
    await act(async () => result.current.setSheet("sort"));
    expect(result.current.sheet).toBe("sort");
    await act(async () => result.current.setSheet("filters"));
    expect(result.current.sheet).toBe("filters");
    await act(async () => result.current.setSheet("none"));
    expect(result.current.sheet).toBe("none");
  });

  test("a read the screen abandoned changes nothing about the rows it left", async () => {
    api.list.mockResolvedValueOnce({ items: rows, total: 2 });
    const { result } = await renderHook(() => useResourceList(note, feedback));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    const abandoned = new Error("The request was cancelled.");
    abandoned.name = "AbortError";
    api.list.mockRejectedValueOnce(abandoned);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe("");
    expect(result.current.rows).toHaveLength(2);
  });
});
