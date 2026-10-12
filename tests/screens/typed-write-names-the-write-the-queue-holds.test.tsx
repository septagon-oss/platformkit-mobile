// A sheet's own typed call carries the idempotency key the queue minted for the
// write — not only the later replay does. The attempt the transport refused may
// have reached the server, and a server that honours the header can only match
// the replay to it when both attempts named the same write, which is the same
// string the held row is kept under.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { createApi } from "../../src/effects/api";
import { createOutbox } from "../../src/effects/outbox";
import type { PendingWrite } from "../../src/core/outbox";
import { useCommandAsk } from "../../src/screens/useCommand";
import { useResourceDetail } from "../../src/screens/useResourceDetail";
import { useResourceForm } from "../../src/screens/useResourceForm";
import { confirm } from "../../src/ui/chooser";
import type { OutboxValue } from "../../src/shell";
import { feedback } from "../fakes/presentation";
import { reset } from "../fakes/router";
import { clock, fakeOutboxStore, mint } from "../fakes/store";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);
const archive = note.commands.find((c) => c.verb === "archive")!;

/** phone is the same queue over the same refusing network, for one screen's write. */
function phone() {
  const store = fakeOutboxStore();
  const queue = createOutbox({
    store: store.store,
    api: createApi("https://acme.test", (async () => {
      throw new TypeError("Network request failed");
    }) as typeof fetch),
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
  });
  const outbox: OutboxValue = {
    items: [],
    submit: queue.submit,
    retry: jest.fn(async () => undefined),
    discard: jest.fn(async () => undefined),
    drain: queue.drain,
  };
  return { queue, outbox };
}

beforeEach(() => {
  reset();
  asked.mockClear();
});

test("the write a sheet makes while the network will not take it names itself on the attempt that failed", async () => {
  const api = fakeApi();
  api.create.mockRejectedValue(new TypeError("Network request failed"));
  const queue = createOutbox({
    store: fakeOutboxStore().store,
    api: createApi("https://acme.test", (async () => {
      throw new TypeError("Network request failed");
    }) as typeof fetch),
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
  });
  const outbox: OutboxValue = {
    items: [],
    submit: queue.submit,
    retry: jest.fn(async () => undefined),
    discard: jest.fn(async () => undefined),
    drain: queue.drain,
  };
  shell.value = shellValue(api, { outbox });
  const { result } = await renderHook(() => useResourceForm(note, undefined));
  await act(async () => result.current.change("title", "Made in the field"));
  await act(async () => {
    await result.current.save();
  });
  const held = await queue.list();
  expect(held.length).toBe(1);
  expect(api.create).toHaveBeenCalledWith(
    note,
    expect.objectContaining({ title: "Made in the field" }),
    { idempotencyKey: held[0]!.id },
  );
  await waitFor(() => expect(result.current.phase).toBe("saved"));
});

test("the edit a sheet makes names itself the same way, on the attempt that failed", async () => {
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "4", title: "Ward A" });
  api.update.mockRejectedValue(new TypeError("Network request failed"));
  const store = fakeOutboxStore();
  const queue = createOutbox({
    store: store.store,
    api: createApi("https://acme.test", (async () => {
      throw new TypeError("Network request failed");
    }) as typeof fetch),
    clock: clock(),
    mint: mint(),
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
  });
  const outbox: OutboxValue = {
    items: [],
    submit: queue.submit,
    retry: jest.fn(async () => undefined),
    discard: jest.fn(async () => undefined),
    drain: queue.drain,
  };
  shell.value = shellValue(api, { outbox });
  const { result } = await renderHook(() => useResourceForm(note, "4"));
  await waitFor(() => expect(result.current.phase).toBe("editing"));
  await act(async () => result.current.change("title", "Ward B"));
  await act(async () => {
    await result.current.save();
  });
  const held = await queue.list();
  expect(held.length).toBe(1);
  expect(held[0]!.kind).toBe("update");
  expect(api.update).toHaveBeenCalledWith(note, "4", expect.objectContaining({ title: "Ward B" }), {
    idempotencyKey: held[0]!.id,
  });
  await waitFor(() => expect(result.current.phase).toBe("saved"));
});

test("the delete a record asks about names itself on the attempt that failed", async () => {
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "4", title: "Ward A" });
  api.remove.mockRejectedValue(new TypeError("Network request failed"));
  const { queue, outbox } = phone();
  shell.value = shellValue(api, { outbox });
  const { result } = await renderHook(() => useResourceDetail(note, "4", feedback));
  await waitFor(() => expect(result.current.row).toBeDefined());
  await act(async () => result.current.remove());
  const [, choice] = asked.mock.calls[0]!;
  await act(async () => {
    choice!.onPress();
  });
  let held: readonly PendingWrite[] = [];
  await waitFor(async () => {
    held = await queue.list();
    expect(held.map((item) => item.kind)).toEqual(["delete"]);
  });
  expect(api.remove).toHaveBeenCalledWith(note, "4", { idempotencyKey: held[0]!.id });
});

test("the command a person answers yes to names itself on the attempt that failed", async () => {
  const api = fakeApi();
  api.command.mockRejectedValue(new TypeError("Network request failed"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const { queue, outbox } = phone();
  shell.value = shellValue(api, { outbox });
  const { result } = await renderHook(() => useCommandAsk(note, undefined));
  await act(async () => result.current.ask(archive));
  const [, choice] = asked.mock.calls[0]!;
  await act(async () => {
    choice!.onPress();
  });
  let held: readonly PendingWrite[] = [];
  await waitFor(async () => {
    held = await queue.list();
    expect(held.map((item) => item.kind)).toEqual(["command"]);
  });
  expect(api.command).toHaveBeenCalledWith(note, undefined, "archive", undefined, {
    idempotencyKey: held[0]!.id,
  });
  alert.mockRestore();
});
