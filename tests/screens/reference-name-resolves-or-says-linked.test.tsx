// A screen that points at another record names it: one read per pointed-at
// record on a record's own screen, the word for a record it cannot name, and
// never the identifier in between. A refusal settles that pointer for the visit
// rather than retrying it, and a session the server withdrew withdraws every
// name the screen holds.
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react-native";
import { key, parseCatalog, type Catalog, type Entry } from "../../src/core/catalog";
import { nameKey, type Names, type Pointer } from "../../src/core/derive";
import { ApiError } from "../../src/effects/api";
import { useRecordNames } from "../../src/screens/useReferenceNames";
import { fakeApi, shell, shellValue, type FakeApi } from "../fakes/shell";

jest.mock("../../src/shell", () => ({ useShell: () => require("../fakes/shell").shell.value }));

const ID = "3f2a8c1d-4b5e-4a6b-9c8d-1e2f3a4b5c6d";
const OTHER = "aaaaaaaa-0000-4000-8000-000000000000";
const at = (id: string) => nameKey("user/user", id);

/**
 * served is the pinned golden with a person mounted and the note's assignee
 * declared as a pointer at them — the shape the reference kernel serves.
 */
function served(): { readonly catalog: Catalog; readonly user: Entry } {
  const doc = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
  doc.resources[0].fields.push({
    name: "assigneeId",
    type: "uuid",
    presentation: { reference: { resource: "user/user" } },
  });
  doc.resources.push({
    module: "user",
    entity: "user",
    path: "/api/v1/user/users",
    screen: "/app/user/users",
    writable: false,
    fields: [
      { name: "id", type: "uuid", readOnly: true },
      { name: "displayName", type: "string" },
      { name: "email", type: "string" },
    ],
  });
  const catalog = parseCatalog(doc);
  return { catalog, user: catalog.resources.find((r) => r.module === "user")! };
}

const pointer = (id: string): readonly Pointer[] => [{ resource: "user/user", id }];

let catalog: Catalog;
let user: Entry;

/** installed is the shell the hook reads: the served kernel above, not the fixture's own. */
function installed(api: FakeApi): void {
  shell.value = shellValue(api, { state: { phase: "ready", generation: 1, catalog } });
}

beforeEach(() => {
  const servedKernel = served();
  catalog = servedKernel.catalog;
  user = servedKernel.user;
  expect(key(user)).toBe("user/user");
});
afterEach(() => {
  shell.value = undefined;
});

/**
 * let the mount's reads land, one turn at a time. The hook sets its names from an
 * await no `act` wraps, so a test that ends with a read in the air lands it inside
 * the next test's scope, which React reports as an open `act`.
 */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** close the mount inside an act of its own, for the same reason. */
const leave = async (unmount: () => void) => {
  await act(async () => {
    unmount();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const settled = async (result: { readonly current: Names }, at: string, want: string) => {
  for (let turn = 0; turn < 20 && result.current?.[at] !== want; turn++) await flush();
  expect(result.current?.[at]).toBe(want);
};

describe("useRecordNames", () => {
  test("a record's screen asks once per pointed-at record, and the answer is the name", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: ID, displayName: "Ada Lovelace", email: "ada@acme.test" });
    installed(api);
    const { result, unmount } = await renderHook(() => useRecordNames(pointer(ID)));
    await settled(result, at(ID), "Ada Lovelace");
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith(user, ID);
    await flush();
    expect(api.get).toHaveBeenCalledTimes(1);
    await leave(unmount);
  });

  test("a person with nothing to read as a name stays the word, and the identifier is never in the map", async () => {
    const api = fakeApi();
    api.get.mockResolvedValue({ id: ID, email: "invited@acme.test" });
    installed(api);
    const { result, unmount } = await renderHook(() => useRecordNames(pointer(ID)));
    await flush();
    expect(result.current[at(ID)]).toBe("Assigned");
    // Not this person's identifier, and not any other uuid the record happens to
    // carry: a pointer's own value is the only thing a name replaces.
    for (const value of Object.values(result.current)) expect(value).not.toContain(ID);
    await leave(unmount);
  });

  test("a refused record leaves the word in place, asks once, and reports no failure", async () => {
    const api = fakeApi();
    api.get.mockRejectedValue(new ApiError(403, "Not yours."));
    installed(api);
    const { result, unmount } = await renderHook(() => useRecordNames(pointer(ID)));
    await flush();
    expect(result.current[at(ID)]).toBe("Assigned");
    await flush();
    expect(api.get).toHaveBeenCalledTimes(1);
    await leave(unmount);
  });

  test("a refused session withdraws every name, and the words stand", async () => {
    const api = fakeApi();
    api.get.mockImplementation(async (_entry: unknown, id: string) =>
      id === ID ? { id: ID, displayName: "Ada Lovelace" } : Promise.reject(new ApiError(401, "")),
    );
    installed(api);
    const { result, unmount } = await renderHook(() =>
      useRecordNames([...pointer(ID), ...pointer(OTHER)]),
    );
    for (let turn = 0; turn < 20 && api.get.mock.calls.length < 2; turn++) await flush();
    expect(api.get).toHaveBeenCalledTimes(2);
    await flush();
    // The read that had already answered is withdrawn with the session rather than
    // kept as the one name on a screen that can no longer be trusted.
    expect(result.current[at(ID)]).toBe("Assigned");
    expect(result.current[at(OTHER)]).toBe("Assigned");
    await leave(unmount);
  });

  test("a resource this tenant does not mount is never asked about, and reads as the word", async () => {
    const api = fakeApi();
    const elsewhere: readonly Pointer[] = [{ resource: "site/site", id: ID }];
    installed(api);
    const { result, unmount } = await renderHook(() => useRecordNames(elsewhere));
    await flush();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
    expect(result.current[nameKey("site/site", ID)]).toBe("Linked");
    await leave(unmount);
  });

  test("a pointer moved on is asked for, and a pointer settled is never asked again", async () => {
    const api = fakeApi();
    api.get.mockImplementation(async (_entry: unknown, id: string) => ({
      id,
      displayName: `Named ${id}`,
    }));
    installed(api);
    // The screen is asked to draw the same note again with another pointer in it —
    // what happens when the record itself answers who the note is assigned to.
    const { result, rerender, unmount } = await renderHook(
      (pointers: readonly Pointer[]) => useRecordNames(pointers),
      { initialProps: pointer(ID) },
    );
    await settled(result, at(ID), `Named ${ID}`);
    await act(async () => {
      await rerender([...pointer(ID), ...pointer(OTHER)]);
    });
    await settled(result, at(OTHER), `Named ${OTHER}`);
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenLastCalledWith(user, OTHER);
    await flush();
    // Neither pointer is asked a second time, settled as they are.
    expect(api.get).toHaveBeenCalledTimes(2);
    await leave(unmount);
  });

  test("an answer that arrives after the screen went away sets nothing", async () => {
    const api = fakeApi();
    const slow = Promise.withResolvers<Record<string, unknown>>();
    api.get.mockReturnValueOnce(slow.promise);
    installed(api);
    const { result, unmount } = await renderHook(() => useRecordNames(pointer(ID)));
    // The word stands while the read is in the air.
    expect(result.current[at(ID)]).toBe("Assigned");
    await act(async () => {
      unmount();
    });
    slow.resolve({ id: ID, displayName: "Ada Lovelace" });
    await flush();
    // The answer arrived to a screen that is gone: the map holds no name for it.
    expect(result.current?.[at(ID)]).toBe("Assigned");
    expect(api.get).toHaveBeenCalledTimes(1);
    await flush();
  });
});
