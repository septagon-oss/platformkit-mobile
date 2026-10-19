// What the reference app keeps on the phone is one list in src/screens/device.ts, and the
// shell only remembers the workspaces a person has connected to when that list hands it the
// table for them. A store the device creates and never passes on is a list no person sees.
import { expect, jest, test } from "@jest/globals";
import { device } from "../src/screens/device";
import { deviceStore } from "../src/effects/native-store";

jest.mock("expo-crypto", () => ({ randomUUID: () => "00000000-0000-4000-8000-000000000000" }));
jest.mock("expo-network", () => ({
  addNetworkStateListener: () => ({ remove: () => undefined }),
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));
jest.mock("expo-sqlite", () => ({ openDatabaseAsync: async () => ({}) }));

test("the device hands the shell the table of workspaces this phone has connected to", () => {
  const store: Readonly<Record<string, unknown>> = device.store;
  expect(store.workspaces).toBe(deviceStore.workspaces);
});
