// "Recently opened" is a door onto a record, so a record this phone deleted leaves the
// list: a section that kept its row would draw a door onto a 404. The delete is asked and
// sent where the record screen is, and the door belongs to this device, so the withdrawal
// is the delete's own and nothing else is forgotten. What the outbox still holds keeps its
// door — the record is still there, and so is the reason to come back to it.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useResourceDetail } from "../../src/screens/useResourceDetail";
import { confirm } from "../../src/ui/chooser";
import type { ShellValue } from "../../src/shell";
import { heldScope, heldWrite } from "../../src/core/outbox";
import { createRecents } from "../../src/effects/recents";
import { catalog } from "../fakes/shell";
import { feedback } from "../fakes/presentation";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";
import { clock, fakeRecentsStore } from "../fakes/store";

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
jest.mock("../../src/ui/chooser", () => ({ confirm: jest.fn(), choose: jest.fn() }));

const asked = jest.mocked(confirm);
const AT = "2026-10-06T10:00:00.000Z";

/** memory is this device's list, over a store that keeps the table's own columns and scope. */
function memory() {
  const keeps = fakeRecentsStore();
  return {
    keeps,
    recents: createRecents({
      store: keeps.store,
      clock: clock(AT),
      scope: () => heldScope("https://acme.test", "person-a"),
    }),
  };
}

/** held is one write the outbox has not managed to send, and so keeps the door for. */
const held = heldWrite(
  {
    kind: "delete",
    resourceKey: "note/note",
    path: "/api/v1/note/notes/n-1",
  },
  "write-n-1",
  AT,
);

function queueThatHoldsIt() {
  // `submit` is generic over the row a live send would have returned; this double answers
  // the one case the case is about — the queue keeping the write — so the generic half is
  // supplied by the cast rather than invented.
  const submit = jest.fn(async () => ({ sent: false as const, item: held }));
  return {
    items: [held],
    submit: submit as unknown as NonNullable<ShellValue["outbox"]>["submit"],
    retry: jest.fn(async () => undefined),
    discard: jest.fn(async () => undefined),
    drain: jest.fn(async () => undefined),
  };
}

async function recordScreen(
  opened: ReturnType<typeof memory>,
  outbox?: ReturnType<typeof queueThatHoldsIt>,
) {
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "n-1", title: "Standup", status: "open", rank: 1 });
  shell.value = shellValue(api, {
    identity: { userId: "person-a", email: "ana@example.test", permissions: [] },
    state: { phase: "ready", generation: 1, catalog },
    ...(outbox === undefined ? {} : { outbox }),
  });
  shell.value = { ...shell.value!, recents: opened.recents };
  // The open this device already made, drawn the way the record screen draws it: the
  // row the delete has to take away.
  await opened.recents.opened({ resourceKey: "note/note", recordId: "n-1", title: "Standup" });
  const view = await renderHook(() => useResourceDetail(note, "n-1", feedback));
  expect(await opened.recents.list()).toHaveLength(1);
  return { api, view };
}

async function deleteChosen(view: Awaited<ReturnType<typeof recordScreen>>["view"]) {
  await act(async () => {
    view.result.current.remove();
  });
  const choice = asked.mock.calls.at(-1)?.[1];
  if (!choice) throw new Error("the delete asked no question");
  await act(async () => {
    await choice.onPress?.();
  });
}

beforeEach(() => {
  reset();
  asked.mockClear();
});

describe("a delete taken on the record it deletes", () => {
  test("the record that went is gone from what this phone remembers opening", async () => {
    const opened = memory();
    const { api, view } = await recordScreen(opened);
    await deleteChosen(view);
    await waitFor(() => expect(api.remove).toHaveBeenCalledTimes(1));
    // The door goes with the record: the list answers empty, and the scope's other rows
    // — none here — would have stayed.
    expect(await opened.recents.list()).toEqual([]);
    expect(opened.keeps.calls.filter((call) => call === "forget")).toHaveLength(1);
    // The write is counted once, as every other delete counts it.
    expect(shell.value!.wrote).toHaveBeenCalledTimes(1);
  });

  test("a delete this phone still holds keeps its door", async () => {
    const opened = memory();
    const queue = queueThatHoldsIt();
    const { view } = await recordScreen(opened, queue);
    await deleteChosen(view);
    // The queue was asked, and kept the write: nothing left this phone, so the door stays.
    expect(queue.submit).toHaveBeenCalledTimes(1);
    expect((await opened.recents.list()).map((recent) => recent.recordId)).toEqual(["n-1"]);
    expect(shell.value!.wrote).not.toHaveBeenCalled();
  });
});
