// Arriving at a look is one read of it. The mount that has not been shown yet asks nothing and the
// focus that shows the screen asks once, so the transport's own record of where it was sent is the
// measure: a page that read the same record on mount and again on focus would double every ask a
// person makes of the service, and the wall already counts one ask per screen it draws.
import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { OutfitLook } from "../../src/packs/outfit/look";
import { firstKey, looksEntry, outfitApi } from "../fakes/outfit";
import { reset } from "../fakes/router";
import { shell, shellValue } from "../fakes/shell";

jest.mock("expo-router", () => require("../fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("../fakes/router").reactNavigation);
jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

const tick = async (): Promise<void> =>
  act(async () => {
    await new Promise((settle) => setTimeout(settle, 0));
  });

beforeEach(() => {
  reset();
});

describe("opening one look", () => {
  test("the page asks for the record its address names, once", async () => {
    const api = outfitApi();
    shell.value = shellValue(api);
    render(<OutfitLook entry={looksEntry} id={firstKey()} />);
    await tick();
    await waitFor(() => expect(screen.getByText("City layers")).toBeTruthy());
    expect(api.asks().filter((path) => path.startsWith(`${looksEntry.path}/`))).toEqual([
      `${looksEntry.path}/${encodeURIComponent(firstKey())}`,
    ]);
  });
});
