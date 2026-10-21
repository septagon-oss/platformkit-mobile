// The server reuses a device row for the same tenant, platform, token and person. An older
// sign-out cannot remove the address a newer completed sign-in now holds on that same host.
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

test("a sign-out awaiting registration leaves the same person's newer address registered", async () => {
  resetPush();
  platform.permission = true;
  platform.token = "ExponentPushToken[returning-person]";
  const host = "https://workspace.example.test";
  const row = answering({
    id: "70000000-0000-4000-8000-0000000000a8",
    recipientId: loginIdentity.userId,
    platform: "expo",
    token: platform.token,
    createdAt: "2026-10-20T08:00:00Z",
    updatedAt: "2026-10-20T08:00:00Z",
  });
  const removed = answering({ done: true });
  const pending = Promise.withResolvers<void>();
  let addressable = false;
  const firstRegister = jest.fn<typeof row.notificationDeviceRegister>(async (input) => {
    addressable = true;
    await pending.promise;
    return row.notificationDeviceRegister(input);
  });
  const nextRegister = jest.fn<typeof row.notificationDeviceRegister>(async (input) => {
    addressable = true;
    return row.notificationDeviceRegister(input);
  });
  const takeBack = jest.fn<typeof removed.notificationDeviceRemove>(async (input) => {
    addressable = false;
    return removed.notificationDeviceRemove(input);
  });
  const first = fakeApi({
    notificationDeviceRegister: firstRegister,
    notificationDeviceRemove: takeBack,
  });
  const next = fakeApi({
    notificationDeviceRegister: nextRegister,
    notificationDeviceRemove: takeBack,
  });
  first.me.mockResolvedValue(loginIdentity);
  next.me.mockResolvedValue(loginIdentity);
  const nextKey = { token: "pk_live_returning", id: "30000000-0000-4000-8000-0000000000b9" };
  first.signIn.mockResolvedValue({ kind: "signed-in", bearer });
  next.signIn.mockResolvedValue({ kind: "signed-in", bearer: nextKey });
  next.bearer.mockReturnValue(nextKey);
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

  let signedOut = Promise.resolve();
  await act(async () => {
    signedOut = value().signOut();
    await new Promise((done) => setTimeout(done, 0));
  });
  connection = next;
  let signedIn = Promise.resolve();
  await act(async () => {
    signedIn = value()
      .signIn(host, loginIdentity.email, "password")
      .then(() => {});
    await new Promise((done) => setTimeout(done, 0));
  });
  await settlePush();

  await act(async () => {
    pending.resolve();
    await signedOut;
    await signedIn;
  });
  await settlePush();
  await act(async () => await value().refresh());
  await settlePush();

  expect(value().state.phase).toBe("ready");
  expect(nextRegister).toHaveBeenCalled();
  expect(value().push.status).toBe("registered");
  expect(addressable).toBe(true);
});
