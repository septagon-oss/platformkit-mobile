// Three of the shell's filings carry words or a moment a person was owed: the sentence a write said
// for the record its person lands on, the receipt of an act that opened nothing, and the moment a
// record plays over its own change. A write answers when it answers, so an answer can arrive after
// the session that earned it has gone — and then it belongs to nobody standing here. Held against
// the shell itself, because it is the shell that decides whether a filing reaches a screen: the
// channel a write files through is one the caller holds, so a caller that is gone holds a filing
// that is gone with it. Filing from the session that *is* standing here still lands all three.
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
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

const record = "/notes/note/7";
const sentence = "The note was resolved";
const receipt = "3 tasks were closed";

function filings(v: ShellValue) {
  return { say: v.say, report: v.report, celebrate: v.celebrate };
}

const original = globalThis.fetch;
beforeEach(() => {
  latest = undefined;
  mockSaved.clear();
  // No session is saved and no server answers: whether a filing reaches a screen asks
  // nothing of the network, and signing out is the shell's own decision either way.
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

test("a sentence, a receipt and a moment earned by a session that has ended reach nobody", async () => {
  const shell = await mounted();
  // The filers one session was handed: what a write still in the air holds.
  const earned = filings(shell());
  await act(async () => {
    await shell()
      .signOut()
      .catch(() => undefined);
  });
  await act(async () => {
    earned.say(record, sentence);
    earned.report(receipt);
    earned.celebrate(record);
  });
  expect(shell().heard(record)).toBe("");
  expect(shell().reporting()).toBeUndefined();
  expect(shell().celebrating(record)).toBe(false);
});

test("the session standing here is owed all three of its own filings", async () => {
  const shell = await mounted();
  await act(async () => {
    filings(shell()).say(record, sentence);
    filings(shell()).report(receipt);
    filings(shell()).celebrate(record);
  });
  expect(shell().celebrating(record)).toBe(true);
  expect(shell().reporting()).toEqual({ sentence: receipt, token: 1 });
  expect(shell().heard(record)).toBe(sentence);
  // Heard once: the record says what its write did once, not on every visit afterwards.
  expect(shell().heard(record)).toBe("");
});
