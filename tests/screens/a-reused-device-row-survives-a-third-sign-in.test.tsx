// A device row belongs to the person currently signed in even when two earlier sign-outs are
// waiting for registrations of that same address. Answers arriving in request order cannot
// withdraw the row the third sign-in has already registered on the server.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import React from "react";
import * as transport from "../../src/effects/api";
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

test("two earlier sign-outs leave the third sign-in's reused device row registered", async () => {
  resetPush();
  platform.permission = true;
  platform.token = "ExponentPushToken[three-sign-ins]";
  const host = "https://workspace.example.test";
  const row = answering({
    id: "70000000-0000-4000-8000-0000000000e3",
    recipientId: loginIdentity.userId,
    platform: "expo",
    token: platform.token,
    createdAt: "2026-10-20T11:00:00Z",
    updatedAt: "2026-10-20T11:00:00Z",
  });
  const removed = answering({ done: true });
  let addressable = false;
  const takeBack = jest.fn<typeof removed.notificationDeviceRemove>(async (input) => {
    addressable = false;
    return removed.notificationDeviceRemove(input);
  });
  const answers = Array.from({ length: 3 }, () => Promise.withResolvers<void>());
  const registrations = answers.map((answer) =>
    jest.fn<typeof row.notificationDeviceRegister>(async (input) => {
      addressable = true;
      await answer.promise;
      return row.notificationDeviceRegister(input);
    }),
  );
  const connections = registrations.map((register, index) => {
    const connection = fakeApi({
      notificationDeviceRegister: register,
      notificationDeviceRemove: takeBack,
    });
    const key = {
      token: `pk_live_holder_${index}`,
      id: `30000000-0000-4000-8000-00000000000${index}`,
    };
    connection.me.mockResolvedValue(loginIdentity);
    connection.signIn.mockResolvedValue({ kind: "signed-in", bearer: key });
    connection.bearer.mockReturnValue(key);
    return connection;
  });
  let connection = connections[0]!;
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
  const signIn = async (index: number) => {
    connection = connections[index]!;
    await act(async () => {
      await value().signIn(host, loginIdentity.email, "password");
    });
    await settlePush();
    expect(registrations[index]).toHaveBeenCalledTimes(1);
    expect(value().state.phase).toBe("ready");
  };
  const leaving: Promise<void>[] = [];
  const signOut = async () => {
    await act(async () => {
      leaving.push(value().signOut());
      await new Promise((done) => setTimeout(done, 0));
    });
  };

  await signIn(0);
  await signOut();
  await signIn(1);
  // The first sign-out is now waiting for the second registration's answer.
  await act(async () => answers[0]!.resolve());
  await settlePush();
  await signOut();
  await signIn(2);

  // The second answer arrives while the third row is held on the server but not answered.
  await act(async () => answers[1]!.resolve());
  await settlePush();
  await act(async () => {
    answers[2]!.resolve();
    await Promise.all(leaving);
  });
  await settlePush();
  await act(async () => await value().refresh());
  await settlePush();

  expect(value().state.phase).toBe("ready");
  expect(value().push.status).toBe("registered");
  expect(addressable).toBe(true);

  await act(async () => await value().signOut());
  expect(addressable).toBe(false);
  expect(takeBack).toHaveBeenCalledTimes(1);
});
