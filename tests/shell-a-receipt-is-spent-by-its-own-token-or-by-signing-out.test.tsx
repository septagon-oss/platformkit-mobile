// The receipt a row's command leaves is the shell's, so its life is the shell's to keep: a filing
// replaces the one before it under a new token, a timer holding a replaced token closes nothing,
// the bar's own token closes it, and signing out ends it with the rest of what a session that is
// going away leaves behind. Held against the shell itself, not a double of it.
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import React from "react";
import { Shell, useShell, type ShellValue } from "../src/shell";

const mockSaved = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockSaved.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSaved.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockSaved.delete(key);
  },
}));
jest.mock("expo-router", () => require("./fakes/router").expoRouter);
jest.mock("expo-router/react-navigation", () => require("./fakes/router").reactNavigation);

let latest: ShellValue | undefined;
function Probe() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return null;
}

const original = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  mockSaved.clear();
  // No session is saved and no server answers: the receipt's life asks nothing of the network.
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = original;
});

async function mounted(): Promise<() => ShellValue> {
  await render(
    <Shell baseURL="https://acme.test" renderers={{}}>
      <Probe />
    </Shell>,
  );
  return () => {
    if (latest === undefined) throw new Error("the shell never rendered its probe");
    return latest;
  };
}

describe("the receipt the shell keeps", () => {
  test("a newer filing replaces the sentence, and only its own token closes it", async () => {
    const shell = await mounted();
    expect(shell().reporting()).toBeUndefined();
    await act(async () => shell().report("Task resolved"));
    const first = shell().reporting();
    expect(first?.sentence).toBe("Task resolved");
    await act(async () => shell().report("Note published"));
    const second = shell().reporting();
    expect(second?.sentence).toBe("Note published");
    expect(second?.token).not.toBe(first?.token);
    await act(async () => shell().spent(first!.token));
    expect(shell().reporting()?.sentence).toBe("Note published");
    await act(async () => shell().spent(second!.token));
    expect(shell().reporting()).toBeUndefined();
  });

  test("signing out ends the receipt still owed, and a later spend of it closes nothing", async () => {
    const shell = await mounted();
    await act(async () => shell().report("Task resolved"));
    const owed = shell().reporting();
    expect(owed?.sentence).toBe("Task resolved");
    await act(async () => {
      await shell()
        .signOut()
        .catch(() => undefined);
    });
    expect(shell().reporting()).toBeUndefined();
    await act(async () => shell().report("Note published"));
    await act(async () => shell().spent(owed!.token));
    expect(shell().reporting()?.sentence).toBe("Note published");
  });
});
