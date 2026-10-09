// Both read contracts must settle successfully before readiness. A malformed
// identity fails the active load in either arrival order, with no later catalog
// publication or unhandled rejection; an obsolete session cannot change it.
import { afterEach, expect, jest, test } from "@jest/globals";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { loginIdentity } from "./fakes/wire";
import { Shell, useShell, type ShellValue } from "../src/shell";

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () =>
    JSON.stringify({ version: 1, baseURL: "https://contract.test", cookie: "pk=synthetic" }),
  setItemAsync: async () => undefined,
}));
let shell: ShellValue | undefined;
function State() {
  const value = useShell();
  React.useEffect(() => {
    shell = value;
  });
  return (
    <Text testID="phase">
      {value.state.phase}:{value.state.error ?? ""}
    </Text>
  );
}
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  shell = undefined;
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

for (const first of ["identity", "catalog"] as const) {
  test(`malformed identity refuses readiness when ${first} answers first`, async () => {
    const identity = Promise.withResolvers<Response>();
    const catalog = Promise.withResolvers<Response>();
    globalThis.fetch = ((url: string) =>
      url.endsWith("/me") ? identity.promise : catalog.promise) as typeof fetch;
    await render(
      <Shell baseURL="https://contract.test" renderers={{}}>
        <State />
      </Shell>,
    );
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(/^loading:/));
    await act(async () => {
      if (first === "identity") identity.resolve(json({ ...loginIdentity, userId: 5 }));
      else catalog.resolve(json({ resources: [] }));
    });
    await act(async () => {
      if (first === "identity") catalog.resolve(json({ resources: [] }));
      else identity.resolve(json({ ...loginIdentity, userId: 5 }));
    });
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(/^failed:/));
    // The person reads the sentence the copy table holds, not the field that failed.
    expect(shell?.state.error).toBe("Update the app to open this workspace.");
    expect(shell?.state.catalog).toBeUndefined();
  });
}

test("a late malformed identity and a second rejection cannot undo sign-out", async () => {
  const identity = Promise.withResolvers<Response>();
  const catalog = Promise.withResolvers<Response>();
  globalThis.fetch = ((url: string) =>
    url.endsWith("/me")
      ? identity.promise
      : url.endsWith("/resources")
        ? catalog.promise
        : Promise.resolve(json({ signedOut: true }))) as typeof fetch;
  await render(
    <Shell baseURL="https://contract.test" renderers={{}}>
      <State />
    </Shell>,
  );
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(/^loading:/));
  await act(async () => {
    await shell!.signOut();
  });
  await act(async () => {
    identity.resolve(json({ ...loginIdentity, userId: 5 }));
    catalog.resolve(json({ detail: "unavailable" }, 503));
  });
  await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent(/^anonymous:/));
  expect(shell?.identity).toBeUndefined();
});
