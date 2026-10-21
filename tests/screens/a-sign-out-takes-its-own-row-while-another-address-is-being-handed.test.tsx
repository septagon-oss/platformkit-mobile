// The server keys a device row on the token it was handed, so a registration for another address
// can never be answered with the row an ending session holds. That sign-out waits for the live
// session's ask for *this* address, and for nothing else: the key which reaches its own row is
// being spent behind the asking, and a pass over another address cannot change what it holds.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import React from "react";
import * as transport from "../../src/effects/api";
import { createPush } from "../../src/screens/push";
import { Shell, useShell, type ShellValue } from "../../src/shell";
import { platform, resetPush } from "../fakes/push";
import { settlePush } from "../fakes/push-session";
import { answering, bearer, fakeApi } from "../fakes/shell";
import { loginIdentity } from "../fakes/wire";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

afterEach(() => {
  jest.restoreAllMocks();
});

test("a sign-out asks for its own row back while the live session is handed another address", async () => {
  resetPush();
  platform.permission = true;
  platform.token = "ExponentPushToken[held-before]";
  const host = "https://workspace.example.test";
  const oldRow = answering({
    id: "70000000-0000-4000-8000-0000000000d1",
    recipientId: loginIdentity.userId,
    platform: "expo",
    token: platform.token,
    createdAt: "2026-10-20T11:00:00Z",
    updatedAt: "2026-10-20T11:00:00Z",
  });
  const newRow = answering({
    id: "70000000-0000-4000-8000-0000000000d2",
    recipientId: loginIdentity.userId,
    platform: "expo",
    token: "ExponentPushToken[held-after]",
    createdAt: "2026-10-20T11:00:00Z",
    updatedAt: "2026-10-20T11:00:00Z",
  });
  const withdrawn = answering({ done: true });
  const oldAnswer = Promise.withResolvers<void>();
  const newAnswer = Promise.withResolvers<void>();
  const oldRegister = jest.fn<typeof oldRow.notificationDeviceRegister>(async (input) => {
    await oldAnswer.promise;
    return oldRow.notificationDeviceRegister(input);
  });
  const newRegister = jest.fn<typeof newRow.notificationDeviceRegister>(async (input) => {
    await newAnswer.promise;
    return newRow.notificationDeviceRegister(input);
  });
  const tookBack = jest.fn<typeof withdrawn.notificationDeviceRemove>(
    withdrawn.notificationDeviceRemove,
  );
  const leaving = fakeApi({
    notificationDeviceRegister: oldRegister,
    notificationDeviceRemove: tookBack,
  });
  const living = fakeApi({
    notificationDeviceRegister: newRegister,
    notificationDeviceRemove: tookBack,
  });
  leaving.me.mockResolvedValue(loginIdentity);
  living.me.mockResolvedValue(loginIdentity);
  const livingKey = { token: "pk_live_other_address", id: "30000000-0000-4000-8000-0000000000d3" };
  leaving.signIn.mockResolvedValue({ kind: "signed-in", bearer });
  living.signIn.mockResolvedValue({ kind: "signed-in", bearer: livingKey });
  living.bearer.mockReturnValue(livingKey);
  let connection = leaving;
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
  expect(oldRegister).toHaveBeenCalledTimes(1);

  let signedOut = Promise.resolve();
  await act(async () => {
    signedOut = value().signOut();
    await new Promise((done) => setTimeout(done, 0));
  });
  // The platform replaced this phone's address before the next sign-in, so the live session is
  // being handed a row the ending session's ask could never be answered with.
  platform.token = "ExponentPushToken[held-after]";
  connection = living;
  await act(async () => {
    await value()
      .signIn(host, loginIdentity.email, "password")
      .then(() => {});
  });
  await settlePush();
  expect(newRegister).toHaveBeenCalledTimes(1);
  expect(value().state.phase).toBe("ready");

  // The ending session's own answer comes home; the other address stays on the wire.
  let asked = false;
  const askedBack = signedOut.then(() => {
    asked = true;
  });
  await act(async () => {
    oldAnswer.resolve();
    await new Promise((done) => setTimeout(done, 0));
    await new Promise((done) => setTimeout(done, 0));
  });

  expect(asked).toBe(true);
  expect(tookBack).toHaveBeenCalledTimes(1);
  expect(tookBack).toHaveBeenCalledWith({
    path: { id: "70000000-0000-4000-8000-0000000000d1" },
  });
  expect(newRegister).toHaveBeenCalledTimes(1);

  await act(async () => {
    newAnswer.resolve();
    await askedBack;
    await settlePush();
  });
  expect(value().state.phase).toBe("ready");
  expect(value().push.status).toBe("registered");
});
