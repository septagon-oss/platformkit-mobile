// A look the service would not refresh remains the last copy the phone read, with a visible way to
// ask again. This is the fragile boundary between the read's refusal and the detail screen.
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

beforeEach(() => reset());

describe("a refused look refresh", () => {
  test("keeps the last look visible with a retry action", async () => {
    shell.value = shellValue(outfitApi());
    const view = await render(<OutfitLook entry={looksEntry} id={firstKey()} />);
    await tick();
    await waitFor(() => expect(screen.getByText("City layers")).toBeTruthy());

    const retrying = outfitApi({
      [encodeURIComponent(firstKey())]: new Error("the service went away"),
    });
    shell.value = shellValue(retrying);
    await view.rerender(<OutfitLook entry={looksEntry} id={firstKey()} />);
    await tick();

    expect(screen.getByText("City layers")).toBeTruthy();
    expect(screen.getByText("This could not be loaded")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Retry/ })).toBeTruthy();
  });
});
