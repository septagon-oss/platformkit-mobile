// One owner decides what a scope is. The queue asks `heldScope`, which normalises
// the server the way the transport does, so a server saved with a trailing slash
// is the same server; a page that asks the read cache instead of that rule would
// keep its answers under a different name than the writes beside them — and a
// name the cache refuses is no answers at all, quietly.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { catalog } from "./fakes/shell";
import { clock, fakeOutboxStore, fakeRecentsStore, fakeReadStore, mint } from "./fakes/store";
import { issuedTokenResponse, loginIdentity } from "./fakes/wire";

/** login is the answer this test needs: the person, and the session cookie a real server sets with them. */
const login = () =>
  new Response(JSON.stringify(loginIdentity), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": "pk=on-the-wire-only" },
  });

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

let latest: ShellValue;
function Session() {
  const value = useShell();
  React.useEffect(() => {
    latest = value;
  });
  return null;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a server typed with a trailing slash is one scope for the queue and the cache", async () => {
  const reads = fakeReadStore();
  globalThis.fetch = (async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/auth/login") return login();
    if (path === "/api/v1/auth/tokens") return issuedTokenResponse();
    if (path === "/api/v1/auth/me") return login();
    if (path === "/api/v1/app/resources")
      return new Response(JSON.stringify(catalog), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    throw new Error(`Unexpected request: ${path}`);
  }) as typeof fetch;
  await render(
    <Shell
      baseURL="https://acme.test/"
      renderers={{}}
      store={{
        outbox: fakeOutboxStore().store,
        reads: reads.store,
        recents: fakeRecentsStore().store,
      }}
      clock={clock()}
      mint={mint()}
    >
      <Session />
    </Shell>,
  );
  await act(async () => {
    await latest.signIn("https://acme.test/", "ada@acme.test", "a-strong-passphrase");
  });
  await waitFor(() => expect(latest.state.phase).toBe("ready"));
  await act(async () => {
    await latest.reads?.answer(
      { kind: "row", resourceKey: "note/note", path: "/api/v1/note/notes/1" },
      async () => ({ id: "1", title: "Recorded on site" }),
    );
  });
  expect(reads.rows.map((row) => row.server)).toEqual(["https://acme.test"]);
});
