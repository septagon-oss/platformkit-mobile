import React from "react";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { type CrudVerb, type Entry } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ResourceList } from "../../src/screens/ResourceList";
import { Singleton } from "../../src/screens/Singleton";
import { ThemeProvider } from "../../src/ui/theme";
import { reset, header } from "../fakes/router";
import { fakeApi, note, setting, shell, shellValue } from "../fakes/shell";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

// `operations` says which doors the server mounted, and a door it did not mount
// must not be drawn. The hooks are proven beside this file (write-doors.test.tsx
// sends nothing for a verb nobody mounts); what this file proves is the drawing,
// in the one place a person looks: the native header. Every button a generated
// screen owns lives in the header slots, so each case below renders the screen
// and asks the header what it drew.

const ALL: readonly CrudVerb[] = ["list", "read", "create", "update", "delete"];
const NONE: readonly CrudVerb[] = [];
const NO_CREATE: readonly CrudVerb[] = ["list", "read", "update", "delete"];
const NO_DELETE: readonly CrudVerb[] = ["list", "read", "create", "update"];
const NO_UPDATE: readonly CrudVerb[] = ["list", "read", "delete"];
const CREATE_ONLY: readonly CrudVerb[] = ["list", "read", "create"];
const UPDATE_ONLY: readonly CrudVerb[] = ["list", "read", "update"];

const api = fakeApi();

beforeEach(() => {
  reset();
  shell.value = shellValue(api);
});

/** view is what a screen looks like to a person: themed, and reading the shell. */
const view = (children: React.ReactElement) => (
  <ThemeProvider mode="light">{children}</ThemeProvider>
);

/**
 * An empty list is the fastest thing to render, and it asks both halves of the
 * question at once: the header drew at all (the `Order` button is always in it),
 * and the create door agrees between the header and the empty state's own
 * primary action.
 */
async function renderList(entry: Entry) {
  await render(view(<ResourceList entry={entry} />));
  await waitFor(() => expect(screen.getByRole("button", { name: "Order" })).toBeOnTheScreen());
}

const expectNoCreate = () => {
  expect(screen.queryByRole("button", { name: "New" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^New / })).toBeNull();
};

const expectEveryCreate = () => {
  expect(screen.getByRole("button", { name: "New" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: /^New / })).toBeOnTheScreen();
};

test("a list whose resource names no operations keeps the New it always had", async () => {
  await renderList(note);
  expectEveryCreate();
});

test("a list whose resource lists all five verbs keeps the New it always had", async () => {
  await renderList({ ...note, operations: ALL });
  expectEveryCreate();
});

test("a list whose resource lists an empty set of verbs keeps the New it always had", async () => {
  // An empty list means all five (kit/rest's own rule), which is the same
  // promise the absent one makes: a server that says nothing keeps its screens.
  await renderList({ ...note, operations: NONE });
  expectEveryCreate();
});

test("a list whose resource mounts no create draws no New", async () => {
  await renderList({ ...note, operations: NO_CREATE });
  expectNoCreate();
  // Not an empty header: the doors that are mounted are still drawn.
  expect(screen.getByRole("button", { name: "Order" })).toBeOnTheScreen();
});

test("a list a caller may not write draws no New whatever its operations say", async () => {
  // `writable` is the caller's guard and `operations` the mounted set; neither
  // opens a door the other closed. This is the row a single gate gets wrong in
  // both directions, which is why both halves sit in one case.
  await renderList({ ...note, writable: false, operations: CREATE_ONLY });
  expectNoCreate();
  await renderList({ ...note, writable: false, operations: NO_CREATE });
  expectNoCreate();
});

const row = { id: "note-7", title: "Kickoff" };

test("a record whose resource mounts no delete loses Delete and keeps Edit", async () => {
  api.get.mockResolvedValueOnce(row);
  await render(view(<ResourceDetail entry={{ ...note, operations: NO_DELETE }} id={row.id} />));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeOnTheScreen());
  expect(screen.queryByTestId("delete")).toBeNull();
});

test("a record whose resource mounts no update loses Edit and keeps Delete", async () => {
  api.get.mockResolvedValueOnce(row);
  await render(view(<ResourceDetail entry={{ ...note, operations: NO_UPDATE }} id={row.id} />));
  await waitFor(() => expect(screen.getByTestId("delete")).toBeOnTheScreen());
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  // The other half of the same door: the option is handed over *empty*, not
  // omitted. A native stack keeps the option it was last given, so an omitted
  // headerRight leaves the Edit of the row before this one sitting in the
  // header, greyed and doing nothing — a door drawn closed is not a door the
  // navigator was never told about. `Singleton` spells both sides out for the
  // reason; this is the same rule on the screen that gained a second door.
  expect(header.options?.headerRight).toBeInstanceOf(Function);
  expect(header.options?.headerRight?.()).toBeNull();
});

test("a record whose resource says nothing about operations draws both doors", async () => {
  api.get.mockResolvedValueOnce(row);
  await render(view(<ResourceDetail entry={note} id={row.id} />));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeOnTheScreen());
  await waitFor(() => expect(screen.getByTestId("delete")).toBeOnTheScreen());
});

test("a singleton whose resource names an update draws its Edit", async () => {
  // A singleton writes its one row with a PUT, which the kernel names `update`;
  // singleton.go prints no operation set, so the named set is the case that
  // would otherwise be read as "no door at all".
  await render(view(<Singleton entry={{ ...setting, operations: UPDATE_ONLY }} />));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeOnTheScreen());
});

test("a singleton whose resource names no update draws no Edit", async () => {
  await render(view(<Singleton entry={{ ...setting, operations: NO_UPDATE }} />));
  await waitFor(() => expect(screen.getByTestId("resource-detail")).toBeOnTheScreen());
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  expect(screen.queryByTestId("save")).toBeNull();
});
