// One shell over the existing API and platform fakes, with the first address answer held
// until the caller releases it. The two connections remain distinct across sign-ins.
import { jest } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import React from "react";
import * as transport from "../../src/effects/api";
import { createPush } from "../../src/screens/push";
import { Shell, useShell, type ShellValue } from "../../src/shell";
import { answering, fakeApi } from "./shell";
import { platform, resetPush } from "./push";
import { loginIdentity } from "./wire";

export const firstServer = "https://first.example.test";
export const secondServer = "https://second.example.test";
export const secondDevice = "70000000-0000-4000-8000-0000000000f6";

export const settlePush = async () => {
  await act(async () => await new Promise((done) => setTimeout(done, 0)));
};

/** mountPushSession holds either the platform token or the first registration's answer. */
export async function mountPushSession(waitFor: "token" | "registration") {
  resetPush();
  platform.permission = true;
  platform.token = "ExponentPushToken[shared-phone]";
  const pending = Promise.withResolvers<void>();
  if (waitFor === "token") platform.held = pending.promise;
  const row = {
    id: "70000000-0000-4000-8000-0000000000e5",
    recipientId: loginIdentity.userId,
    platform: "expo",
    token: platform.token,
    createdAt: "2026-10-20T04:00:00Z",
    updatedAt: "2026-10-20T04:00:00Z",
  };
  const device = answering(row);
  const removed = answering({ done: true });
  const firstRegister = jest.fn<typeof device.notificationDeviceRegister>(async (input) => {
    if (waitFor === "registration") await pending.promise;
    return device.notificationDeviceRegister(input);
  });
  const secondPerson = { ...loginIdentity, userId: "33333333-3333-4333-8333-333333333333" };
  const secondAnswer = answering({ ...row, id: secondDevice, recipientId: secondPerson.userId });
  const secondRegister = jest.fn(secondAnswer.notificationDeviceRegister);
  const secondRemove = jest.fn(removed.notificationDeviceRemove);
  const first = fakeApi({
    notificationDeviceRegister: firstRegister,
    notificationDeviceRemove: removed.notificationDeviceRemove,
  });
  const second = fakeApi({
    notificationDeviceRegister: secondRegister,
    notificationDeviceRemove: secondRemove,
  });
  first.me.mockResolvedValue(loginIdentity);
  second.me.mockResolvedValue(secondPerson);
  jest
    .spyOn(transport, "createApi")
    .mockImplementation((server) => (server === firstServer ? first : second));

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
    <Shell baseURL={firstServer} renderers={{}} push={createPush()}>
      <ObserveSession />
    </Shell>,
  );
  return {
    value,
    first,
    firstRegister,
    secondRegister,
    secondRemove,
    release: pending.resolve,
    async signIn(server: string) {
      await act(async () => {
        await value().signIn(server, loginIdentity.email, "password");
      });
      await settlePush();
    },
    async startSignOut() {
      let done = Promise.resolve();
      await act(async () => {
        done = value().signOut();
        await new Promise((next) => setTimeout(next, 0));
      });
      return { done };
    },
  };
}
