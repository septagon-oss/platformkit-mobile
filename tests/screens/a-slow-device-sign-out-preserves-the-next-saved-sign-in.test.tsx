// An older sign-out waiting for its device answer cannot clear a newer sign-in's saved key.
// The phone must restore the workspace whose sign-in completed most recently.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { firstServer, secondServer, mountPushSession } from "../fakes/push-session";

const mockStorage = new Map<string, string>();
jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStorage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
}));

beforeEach(() => mockStorage.clear());
afterEach(() => {
  jest.restoreAllMocks();
});

const savedSignIn = () => JSON.parse(mockStorage.get("platformkit.session") ?? "null");

test("a sign-out awaiting a device registration preserves the next workspace's saved sign-in", async () => {
  const phone = await mountPushSession("registration");
  await phone.signIn(firstServer);
  expect(phone.firstRegister).toHaveBeenCalledTimes(1);

  const out = await phone.startSignOut();
  await phone.signIn(secondServer);
  expect(phone.value().state.phase).toBe("ready");
  expect(savedSignIn()).toMatchObject({ baseURL: secondServer, token: expect.any(String) });

  await act(async () => {
    phone.release();
    await out.done;
  });

  expect(phone.first.logout).toHaveBeenCalledTimes(1);
  expect(phone.value().baseURL).toBe(secondServer);
  expect(savedSignIn()).toMatchObject({ baseURL: secondServer, token: expect.any(String) });
});
