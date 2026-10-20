// A new sign-in has its own notification pass even while an earlier session's answer is
// pending. Finishing the earlier sign-out must leave the new workspace addressable.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act } from "@testing-library/react-native";
import {
  firstServer,
  secondServer,
  secondDevice,
  mountPushSession,
  settlePush,
} from "../fakes/push-session";
import { platform } from "../fakes/push";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

afterEach(() => {
  jest.restoreAllMocks();
});

test("a second workspace registers when the earlier push pass already finished", async () => {
  const phone = await mountPushSession("registration");
  phone.release();
  await phone.signIn(firstServer);
  expect(phone.firstRegister).toHaveBeenCalledTimes(1);
  const out = await phone.startSignOut();
  await act(async () => await out.done);

  await phone.signIn(secondServer);
  expect(phone.secondRegister).toHaveBeenCalledTimes(1);
  expect(phone.value().push.status).toBe("registered");
});

test.each(["token", "registration"] as const)(
  "a new workspace registers after sign-out while the earlier %s answer finishes",
  async (waitingFor) => {
    const phone = await mountPushSession(waitingFor);
    await phone.signIn(firstServer);
    expect(phone.value().state.phase).toBe("ready");
    if (waitingFor === "registration") expect(phone.firstRegister).toHaveBeenCalledTimes(1);

    const out = await phone.startSignOut();
    platform.held = undefined;
    await phone.signIn(secondServer);
    expect(phone.value().state.phase).toBe("ready");
    expect(phone.value().baseURL).toBe(secondServer);

    await act(async () => {
      phone.release();
      await out.done;
    });
    await settlePush();

    expect(phone.secondRegister).toHaveBeenCalledTimes(1);
    expect(phone.value().push.status).toBe("registered");

    const secondOut = await phone.startSignOut();
    await act(async () => await secondOut.done);
    expect(phone.secondRemove).toHaveBeenCalledWith({ path: { id: secondDevice } });
  },
);
