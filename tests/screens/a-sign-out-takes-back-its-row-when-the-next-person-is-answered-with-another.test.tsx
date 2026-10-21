// A sign-out waiting on the live connection's registration of the same address leaves the row
// only when that answer names the same row. A different person on the same host is answered
// with their own row, and a refused registration is answered with none: either way the ending
// session's row is still its own, and it is asked back with that session's key.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import React from "react";
import * as transport from "../../src/effects/api";
import { ApiError } from "../../src/effects/api";
import { createPush } from "../../src/screens/push";
import { Shell, useShell, type ShellValue } from "../../src/shell";
import { platform, resetPush } from "../fakes/push";
import { settlePush } from "../fakes/push-session";
import { answering, fakeApi } from "../fakes/shell";
import { loginIdentity } from "../fakes/wire";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

afterEach(() => {
  jest.restoreAllMocks();
});

const host = "https://shared-phone.example.test";
const firstRow = "70000000-0000-4000-8000-0000000000c1";
const nextRow = "70000000-0000-4000-8000-0000000000c2";
const nextPerson = { ...loginIdentity, userId: "44444444-4444-4444-8444-444444444444" };

type NextAnswer = "another row" | "refused";

async function signOutWhileTheNextPersonRegisters(next: NextAnswer) {
  resetPush();
  platform.permission = true;
  platform.token = "ExponentPushToken[handed-between-people]";
  const device = (id: string, recipientId: string) =>
    answering({
      id,
      recipientId,
      platform: "expo",
      token: platform.token,
      createdAt: "2026-10-20T11:30:00Z",
      updatedAt: "2026-10-20T11:30:00Z",
    });
  const firstDevice = device(firstRow, loginIdentity.userId);
  const nextDevice = device(nextRow, nextPerson.userId);
  const removed = answering({ done: true });
  const firstAnswer = Promise.withResolvers<void>();
  const nextAnswer = Promise.withResolvers<void>();
  const firstRegister = jest.fn<typeof firstDevice.notificationDeviceRegister>(async (input) => {
    await firstAnswer.promise;
    return firstDevice.notificationDeviceRegister(input);
  });
  const nextRegister = jest.fn<typeof nextDevice.notificationDeviceRegister>(async (input) => {
    await nextAnswer.promise;
    if (next === "refused") throw new ApiError(403, "This device may not be registered.");
    return nextDevice.notificationDeviceRegister(input);
  });
  const firstRemove = jest.fn(removed.notificationDeviceRemove);
  const nextRemove = jest.fn(removed.notificationDeviceRemove);
  const first = fakeApi({
    notificationDeviceRegister: firstRegister,
    notificationDeviceRemove: firstRemove,
  });
  const second = fakeApi({
    notificationDeviceRegister: nextRegister,
    notificationDeviceRemove: nextRemove,
  });
  const firstKey = { token: "pk_live_first_person", id: "30000000-0000-4000-8000-0000000000c1" };
  const nextKey = { token: "pk_live_next_person", id: "30000000-0000-4000-8000-0000000000c2" };
  first.me.mockResolvedValue(loginIdentity);
  first.signIn.mockResolvedValue({ kind: "signed-in", bearer: firstKey });
  first.bearer.mockReturnValue(firstKey);
  second.me.mockResolvedValue(nextPerson);
  second.signIn.mockResolvedValue({ kind: "signed-in", bearer: nextKey });
  second.bearer.mockReturnValue(nextKey);
  let connection = first;
  jest.spyOn(transport, "createApi").mockImplementation(() => connection);

  let latest: ShellValue | undefined;
  function ObserveSession() {
    const value = useShell();
    React.useEffect(() => {
      latest = value;
    });
    return null;
  }
  const value = () => {
    if (latest === undefined) throw new Error("The shell has not rendered its session.");
    return latest;
  };
  await render(
    <Shell baseURL={host} renderers={{}} push={createPush()}>
      <ObserveSession />
    </Shell>,
  );

  await act(async () => {
    await value().signIn(host, loginIdentity.email, "password");
  });
  await settlePush();
  expect(firstRegister).toHaveBeenCalledTimes(1);

  // The first person signs out while their own registration is still away, so the sign-out
  // is still waiting when the next person signs in and asks for the same address.
  let leaving = Promise.resolve();
  await act(async () => {
    leaving = value().signOut();
    await new Promise((done) => setTimeout(done, 0));
  });
  connection = second;
  await act(async () => {
    await value().signIn(host, nextPerson.email, "password");
  });
  await settlePush();
  expect(nextRegister).toHaveBeenCalledTimes(1);
  expect(value().state.phase).toBe("ready");

  // The first answer comes home while the next person's ask for the same address is away.
  await act(async () => firstAnswer.resolve());
  await settlePush();
  await act(async () => {
    nextAnswer.resolve();
    await leaving;
  });
  await settlePush();
  return { value, firstRemove, nextRemove };
}

test("an older sign-out takes back its row when the next person is answered with another row", async () => {
  const { value, firstRemove, nextRemove } =
    await signOutWhileTheNextPersonRegisters("another row");

  expect(value().push.status).toBe("registered");
  expect(firstRemove).toHaveBeenCalledTimes(1);
  expect(firstRemove).toHaveBeenCalledWith({ path: { id: firstRow } });
  expect(nextRemove).not.toHaveBeenCalled();
});

test("an older sign-out takes back its row when the next registration of that address is refused", async () => {
  const { value, firstRemove, nextRemove } = await signOutWhileTheNextPersonRegisters("refused");

  expect(value().push.status).toBe("refused");
  expect(firstRemove).toHaveBeenCalledTimes(1);
  expect(firstRemove).toHaveBeenCalledWith({ path: { id: firstRow } });
  expect(nextRemove).not.toHaveBeenCalled();
});
