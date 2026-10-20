// A registration refusal from an ended session cannot decide whether the next workspace
// registers this phone. Each completed sign-in must read its own platform and server answers.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act } from "@testing-library/react-native";
import * as transport from "../../src/effects/api";
import { catalog } from "../fakes/shell";
import { firstServer, secondServer, mountPushSession, settlePush } from "../fakes/push-session";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

afterEach(() => {
  jest.restoreAllMocks();
});

test.each(["before", "during"] as const)(
  "a registration refusal arriving %s the next sign-in cannot suppress its notification pass",
  async (arrival) => {
    const phone = await mountPushSession("registration");
    const refused = Promise.withResolvers<void>();
    phone.firstRegister.mockImplementation(async () => {
      await refused.promise;
      throw new transport.ApiError(422, "This workspace has no adapter for this platform.");
    });
    const next = transport.createApi(secondServer);
    const loaded = Promise.withResolvers<typeof catalog>();
    jest.mocked(next.catalog).mockImplementation(() => loaded.promise);

    await phone.signIn(firstServer);
    expect(phone.firstRegister).toHaveBeenCalledTimes(1);
    expect(phone.value().state.phase).toBe("ready");
    const out = await phone.startSignOut();
    if (arrival === "before") {
      await act(async () => {
        refused.resolve();
        await out.done;
      });
    }

    let signedIn = Promise.resolve();
    await act(async () => {
      signedIn = phone
        .value()
        .signIn(secondServer, "reader@example.test", "password")
        .then(() => {});
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(next.catalog).toHaveBeenCalledTimes(1);

    await act(async () => {
      refused.resolve();
      await out.done;
    });
    await settlePush();
    await act(async () => {
      loaded.resolve(catalog);
      await signedIn;
    });
    await settlePush();

    expect(phone.value().state.phase).toBe("ready");
    expect(phone.value().baseURL).toBe(secondServer);
    expect(phone.secondRegister).toHaveBeenCalledTimes(1);
    expect(phone.value().push.status).toBe("registered");
  },
);
