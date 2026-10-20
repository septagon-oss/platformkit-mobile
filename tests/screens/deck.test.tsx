// The deck hook serializes input, reads its declared queue and counts only a direct validated command acceptance.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, renderHook, screen, waitFor, fireEvent } from "@testing-library/react-native";
import React from "react";
import { useResourceDeck } from "../../src/screens/useResourceDeck";
import { ResourceDeck } from "../../src/screens/ResourceDeck";
import { ResourceList } from "../../src/screens/ResourceList";
import { createOutbox } from "../../src/effects/outbox";
import { fakeOutboxStore } from "../fakes/store";
import { heldWrite } from "../../src/core/outbox";
import { commandPath } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
import { confirm } from "../../src/ui/chooser";
import { feedback } from "../fakes/presentation";
import { fakeApi, shell, shellValue } from "../fakes/shell";
import { deckDocument, deckEntryFixture, deckRows } from "../fakes/deck";
import { parseCatalog } from "../../src/core/catalog";
import { reset } from "../fakes/router";
import * as Haptics from "expo-haptics";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));
const entry = deckEntryFixture();
let api: ReturnType<typeof fakeApi>;
beforeEach(() => {
  reset();
  jest.clearAllMocks();
  api = fakeApi();
  api.list.mockResolvedValue({ items: deckRows, total: 3 });
  shell.value = shellValue(api);
});
async function mount() {
  const hook = await renderHook(() =>
    useResourceDeck(entry, entry.hints!.deck!, feedback.copy, false),
  );
  await waitFor(() => expect(hook.result.current.state.phase).toBe("ready"));
  return hook;
}

test("all queue pages are captured before choices and accepted commands submit once without an invented body", async () => {
  let accept!: (row: { id: string }) => void;
  api.command.mockImplementation(
    () =>
      new Promise((resolve) => {
        accept = resolve;
      }),
  );
  const { result } = await mount();
  expect(api.list).toHaveBeenCalledWith(entry, {
    offset: 0,
    limit: 20,
    sort: "title",
    filters: ["status:open"],
  });
  await act(async () => {
    result.current.action("right");
    result.current.action("right");
    result.current.action("down");
  });
  expect(api.command).toHaveBeenCalledTimes(1);
  expect(api.command).toHaveBeenCalledWith(entry, "A", "accept");
  expect(result.current.state.history).toHaveLength(0);
  await act(async () => accept({ id: "A" }));
  await waitFor(() => expect(result.current.state.phase).toBe("ready"));
  expect(result.current.state.active[0]).toBe("B");
  expect(result.current.state.history).toHaveLength(1);
  expect(shell.value!.wrote).toHaveBeenCalledTimes(1);
});

test("button and named card action both enter the same confirmation and cancellation sends nothing", async () => {
  await render(<ResourceDeck entry={entry} />);
  await waitFor(() => expect(screen.getByTestId("deck-left")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("deck-left"));
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(api.command).not.toHaveBeenCalled();
  const asked = jest.mocked(confirm);
  await act(async () => asked.mock.calls[0]![3]?.onCancel?.());
  await fireEvent(screen.getByTestId("deck-card"), "accessibilityAction", {
    nativeEvent: { actionName: "left" },
  });
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
  await act(async () => asked.mock.calls[1]![1].onPress());
  await waitFor(() => expect(api.command).toHaveBeenCalledTimes(1));
  expect(api.command).toHaveBeenCalledWith(entry, "A", "archive");
});

test.each([403, 404, 409, 422])(
  "definitive %s refusal restores the same card with safe words and no choice credit",
  async (status) => {
    api.command.mockRejectedValue(new ApiError(status, "private server detail"));
    const { result } = await mount();
    await act(async () => result.current.action("right"));
    await waitFor(() => expect(result.current.state.phase).toBe("ready"));
    expect(result.current.state.active[0]).toBe("A");
    expect(result.current.state.history).toHaveLength(0);
    expect(result.current.state.notice).not.toContain("private");
    expect(result.current.state.notice).not.toBe("");
    expect(shell.value!.wrote).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  },
);

test.each([0, 200, 408, 429, 503])(
  "unconfirmed %s result locks the card without offering another send",
  async (status) => {
    api.command.mockRejectedValue(new ApiError(status, "unconfirmed"));
    const { result } = await mount();
    await act(async () => result.current.action("right"));
    await waitFor(() => expect(result.current.state.phase).toBe("unknown"));
    await act(async () => {
      result.current.action("right");
      result.current.retry();
      result.current.refresh();
    });
    expect(api.command).toHaveBeenCalledTimes(1);
    expect(result.current.state.history).toHaveLength(0);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  },
);

test("a defaulted command sends no argument and a local skip and rewind send no command", async () => {
  const doc = deckDocument();
  doc.resources[0].commands[0].fields = [{ name: "reason", type: "string", default: "accepted" }];
  const defaulted = parseCatalog(doc).resources[0]!;
  const { result } = await renderHook(() =>
    useResourceDeck(defaulted, defaulted.hints!.deck!, feedback.copy, false),
  );
  await waitFor(() => expect(result.current.state.phase).toBe("ready"));
  await act(async () => result.current.action("down"));
  await act(async () => result.current.action("rewind"));
  expect(api.command).not.toHaveBeenCalled();
  expect(result.current.state.active[0]).toBe("A");
  await act(async () => result.current.action("right"));
  await waitFor(() => expect(api.command).toHaveBeenCalledTimes(1));
  expect(api.command).toHaveBeenCalledWith(defaulted, "A", "accept");
});

test("the list's Review count comes from the declared queue rather than the ordinary list total", async () => {
  api.list.mockImplementation(async (_entry, window) => ({
    items: deckRows,
    total: window?.filters?.includes("status:open") ? 6 : 41,
  }));
  await render(<ResourceList entry={entry} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Review 6" })).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Review 41" })).toBeNull();
});

test("a callback from a left deck cannot put a card into a replacement declaration's session", async () => {
  let accept!: (row: { id: string }) => void;
  api.command.mockImplementation(
    () =>
      new Promise((resolve) => {
        accept = resolve;
      }),
  );
  const view = await render(<ResourceDeck entry={entry} />);
  await waitFor(() => expect(screen.getByTestId("deck-right")).not.toBeDisabled());
  await fireEvent.press(screen.getByTestId("deck-right"));
  await waitFor(() => expect(api.command).toHaveBeenCalledTimes(1));
  const doc = deckDocument();
  doc.resources[0].presentation.deck.directions = { down: { skip: true } };
  const replacement = parseCatalog(doc).resources[0]!;
  await view.rerender(<ResourceDeck entry={replacement} />);
  await waitFor(() => expect(screen.getByTestId("deck-down")).not.toBeDisabled());
  await act(async () => accept({ id: "A" }));
  expect(screen.getByTestId("deck-progress").props["aria-valuenow"]).toBe(0);
  expect(shell.value!.wrote).not.toHaveBeenCalled();
  expect(screen.getByTestId("deck-card").props.accessibilityLabel).toContain("Apple");
});

test("a success body naming another row remains unknown and earns no accepted-write feedback", async () => {
  api.command.mockResolvedValue({ id: "other" });
  const { result } = await mount();
  await act(async () => result.current.action("right"));
  await waitFor(() => expect(result.current.state.phase).toBe("unknown"));
  expect(result.current.state.history).toHaveLength(0);
  expect(shell.value!.wrote).not.toHaveBeenCalled();
});

test("a real outbox hold and later disappearance never masquerade as a direct command acceptance", async () => {
  const held = createOutbox({
    store: fakeOutboxStore().store,
    api,
    clock: { now: () => feedback.now },
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
    mint: () => "00000000-0000-4000-8000-000000000099",
    reached: () => false,
  });
  await held.open();
  shell.value = shellValue(api, {
    outbox: {
      items: [],
      submit: held.submit,
      drain: held.drain,
      retry: async (id) => {
        await held.retry(id);
      },
      discard: async (id) => {
        await held.discard(id);
      },
    },
  });
  const { result, rerender } = await mount();
  await act(async () => result.current.action("right"));
  await waitFor(() => expect(result.current.state.phase).toBe("held"));
  expect(result.current.state.history).toHaveLength(0);
  expect(api.command).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  const items = await held.list();
  expect(items).toHaveLength(1);
  shell.value = { ...shell.value!, outbox: { ...shell.value!.outbox!, items } };
  await rerender({});
  await act(async () => {
    result.current.action("right");
    result.current.action("down");
  });
  expect(await held.list()).toHaveLength(1);
  await held.discard(items[0]!.id);
  shell.value = { ...shell.value!, outbox: { ...shell.value!.outbox!, items: [] } };
  await rerender({});
  await waitFor(() => expect(result.current.state.phase).toBe("closed"));
  expect(result.current.state.history).toHaveLength(0);
  expect(shell.value!.wrote).not.toHaveBeenCalled();
});

test("an existing unknown outbox write blocks every direction before the first card can be acted on", async () => {
  const item = {
    ...heldWrite(
      { kind: "command", resourceKey: "notes/note", path: commandPath(entry, "accept", "A") },
      "00000000-0000-4000-8000-000000000098",
      feedback.now,
    ),
    resourceKey: `${entry.module}/${entry.entity}`,
    state: "unknown" as const,
  };
  shell.value = shellValue(api, {
    outbox: {
      items: [item],
      submit: async () => ({ sent: false, item }),
      retry: async () => undefined,
      discard: async () => undefined,
      drain: async () => undefined,
    },
  });
  const { result } = await renderHook(() =>
    useResourceDeck(entry, entry.hints!.deck!, feedback.copy, false),
  );
  await waitFor(() => expect(result.current.state.phase).toBe("unknown"));
  await act(async () => result.current.action("down"));
  expect(result.current.state.history).toHaveLength(0);
  expect(api.command).not.toHaveBeenCalled();
});

test("a queued release for the former top cannot choose the next card", async () => {
  const { result } = await mount();
  const previous = result.current.state.operation;
  await act(async () => result.current.action("down"));
  await waitFor(() => expect(result.current.state.active[0]).toBe("B"));
  await act(async () => {
    result.current.action("right", previous);
    result.current.action("unknown");
  });
  expect(api.command).not.toHaveBeenCalled();
  expect(result.current.state.history).toHaveLength(1);
});

test("leaving a failed final count offers a read retry without another command or a queue-empty claim", async () => {
  api.list
    .mockResolvedValueOnce({ items: [deckRows[0]!], total: 1 })
    .mockRejectedValueOnce(new ApiError(503, "read unavailable"));
  const { result } = await mount();
  await act(async () => result.current.action("right"));
  await waitFor(() => expect(result.current.state.phase).toBe("pass-end"));
  expect(result.current.state.notice).toBe(feedback.copy.review.checkFailed);
  expect(result.current.state.finishing).toBe(false);
  expect(result.current.state.history).toHaveLength(1);
  api.list.mockResolvedValueOnce({ items: [], total: 0 });
  await act(async () => result.current.retry());
  await waitFor(() => expect(result.current.state.phase).toBe("caught-up"));
  expect(api.command).toHaveBeenCalledTimes(1);
  expect(result.current.state.finishing).toBe(true);
});
