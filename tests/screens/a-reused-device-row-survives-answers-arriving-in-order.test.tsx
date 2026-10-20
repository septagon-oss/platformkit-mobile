// The server reuses a device row for the same tenant, platform, token and person. When an older
// sign-out's registration and a newer same-person sign-in's registration both answer late, in the
// order they were sent, the older sign-out still cannot take away the row the newer one now holds.
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

test("a sign-out whose registration answers first leaves the same person's newer address registered", async () => {
  resetPush();
  platform.permission = true;
  platform.token = "ExponentPushToken[answers-in-order]";
  const host = "https://workspace.example.test";
  const row = answering({
    id: "70000000-0000-4000-8000-0000000000c4",
    recipientId: loginIdentity.userId,
    platform: "expo",
    token: platform.token,
    createdAt: "2026-10-20T10:00:00Z",
    updatedAt: "2026-10-20T10:00:00Z",
  });
  const removed = answering({ done: true });
  // The server holds one row for this person, token and host: a register writes it (or answers
  // the one standing) the moment the request arrives, a remove deletes it. Only the answers wait.
  let addressable = false;
  const firstAnswer = Promise.withResolvers<void>();
  const nextAnswer = Promise.withResolvers<void>();
  const firstRegister = jest.fn<typeof row.notificationDeviceRegister>(async (input) => {
    addressable = true;
    await firstAnswer.promise;
    return row.notificationDeviceRegister(input);
  });
  const nextRegister = jest.fn<typeof row.notificationDeviceRegister>(async (input) => {
    addressable = true;
    await nextAnswer.promise;
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
  const nextKey = { token: "pk_live_in_order", id: "30000000-0000-4000-8000-0000000000c5" };
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
  expect(value().state.phase).toBe("ready");

  // The answers arrive in the order their requests were sent: the older session's first, with
  // everything it sets moving settled before the newer one lands.
  await act(async () => {
    firstAnswer.resolve();
    await new Promise((done) => setTimeout(done, 0));
  });
  await settlePush();
  await act(async () => {
    nextAnswer.resolve();
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
