import { expect, jest, test } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react-native";
import { createReadCache } from "../../src/effects/read-cache";
import { useResourceList } from "../../src/screens/useResourceList";
import { useResourceDetail } from "../../src/screens/useResourceDetail";
import { feedback } from "../fakes/presentation";
import { clock, fakeReadStore } from "../fakes/store";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

function setup() {
  const api = fakeApi();
  const reads = createReadCache({
    store: fakeReadStore().store,
    clock: clock(),
    scope: () => ({ server: "https://acme.test", userId: "ada" }),
  });
  shell.value = shellValue(api, { reads });
  return api;
}

test("a resource list reopened offline shows its last successful page", async () => {
  const api = setup();
  const row = { id: "saved-note", title: "Recorded on site" };
  api.list.mockResolvedValue({ items: [row], total: 1 });
  const online = await renderHook(() => useResourceList(note, feedback));
  await waitFor(() => expect(online.result.current.rows).toEqual([row]));
  await online.unmount();
  api.list.mockRejectedValue(new TypeError("Network request failed"));
  const offline = await renderHook(() => useResourceList(note, feedback));
  await waitFor(() => expect(offline.result.current.loading).toBe(false));
  expect(offline.result.current.rows).toEqual([row]);
});

test("a resource detail reopened offline shows its last successful row", async () => {
  const api = setup();
  const row = { id: "saved-note", title: "Recorded on site" };
  api.get.mockResolvedValue(row);
  const online = await renderHook(() => useResourceDetail(note, row.id, feedback));
  await waitFor(() => expect(online.result.current.row).toEqual(row));
  await online.unmount();
  api.get.mockRejectedValue(new TypeError("Network request failed"));
  const offline = await renderHook(() => useResourceDetail(note, row.id, feedback));
  await waitFor(() => expect(offline.result.current.row).toEqual(row));
});
