import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Shell, useShell, type ShellValue } from "../src/shell";
import { heldWrite } from "../src/core/outbox";
import { catalog } from "./fakes/shell";
import { clock, fakeOutboxStore, fakeRecentsStore, fakeReadStore, mint } from "./fakes/store";
import { loginIdentity, loginResponse } from "./fakes/wire";

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () =>
    // The key tests/fakes/wire.ts issues, spelled out: a jest.mock factory may
    // not reach an import, and this record is what a restored phone holds.
    JSON.stringify({
      version: 2,
      baseURL: "https://acme.test",
      token: "pk_live_this_phone",
      tokenId: "22222222-2222-4222-8222-222222222222",
    }),
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

test("refreshing the catalog does not send the next held write before the first finishes", async () => {
  const pending = fakeOutboxStore();
  for (const id of ["first", "second"]) {
    pending.raw(
      heldWrite(
        { kind: "delete", resourceKey: "note/note", path: `/api/v1/note/notes/${id}` },
        id,
        clock().now(),
      ),
      "https://acme.test",
      loginIdentity.userId,
    );
  }
  // The native adapter opens once per device store. Match that lifetime while
  // retaining the shared double for all row operations.
  const open = pending.store.open;
  let opened: Promise<void> | undefined;
  const store = {
    outbox: { ...pending.store, open: () => (opened ??= open()) },
    reads: fakeReadStore().store,
  };
  const first = Promise.withResolvers<Response>();
  const sent: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/auth/me") return loginResponse();
    if (path === "/api/v1/app/resources")
      return new Response(JSON.stringify({ ...catalog, catalogVersion: 2 }));
    if (init?.method === "DELETE") {
      sent.push(path);
      return path.endsWith("/first") ? first.promise : new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${path}`);
  }) as typeof fetch;
  await render(
    <Shell
      baseURL="https://acme.test"
      renderers={{}}
      store={{ ...store, recents: fakeRecentsStore().store }}
      clock={clock()}
      mint={mint()}
    >
      <Session />
    </Shell>,
  );
  await waitFor(() => expect(sent).toEqual(["/api/v1/note/notes/first"]));
  try {
    await act(async () => {
      await latest.refresh();
    });
    expect(sent).toEqual(["/api/v1/note/notes/first"]);
  } finally {
    await act(async () => {
      first.resolve(new Response(null, { status: 204 }));
      await first.promise;
    });
  }
  await waitFor(() =>
    expect(sent).toEqual(["/api/v1/note/notes/first", "/api/v1/note/notes/second"]),
  );
});
