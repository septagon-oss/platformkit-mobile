// A window of rows points at records it does not hold: it reads each pointed-at
// resource once, whatever the number of rows, and names every value that page
// answers. A value the page does not reach keeps the word the kit says, which is
// what a page is — the identifier the row carries is never what a person reads.
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react-native";
import { parseCatalog, type Catalog, type Entry } from "../../src/core/catalog";
import { nameKey, type Names, type Pointer } from "../../src/core/derive";
import { useDirectoryNames, useDirectoryPeople } from "../../src/screens/useReferenceNames";
import { ApiError } from "../../src/effects/api";
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
});
afterEach(() => {
  shell.value = undefined;
});

/**
 * flush lets every read this mount started land. The hook sets its names from an
 * await no `act` wraps, so a test that ended with a read in the air would land it
 * inside the next test's scope, which React reports as an open `act`.
 */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const settled = async (result: { readonly current: Names }, at: string, want: string) => {
  for (let turn = 0; turn < 20 && result.current?.[at] !== want; turn++) await flush();
  expect(result.current?.[at]).toBe(want);
};

/** close the mount inside an act of its own, for the same reason as `flush`. */
const leave = async (unmount: () => void) => {
  await act(async () => {
    unmount();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("useDirectoryNames", () => {
  test("a window reads each pointed-at resource once and names every value that page holds", async () => {
    const api = fakeApi();
    api.list.mockResolvedValue({
      total: 2,
      items: [
        { id: ID, displayName: "Ada Lovelace" },
        { id: OTHER, displayName: "Grace Hopper" },
      ],
    });
    installed(api);
    const { result, unmount } = await renderHook(() =>
      useDirectoryNames([...pointer(ID), ...pointer(OTHER)]),
    );
    await settled(result, at(OTHER), "Grace Hopper");
    expect(result.current[at(ID)]).toBe("Ada Lovelace");
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledWith(user, { limit: 200 });
    await leave(unmount);
  });

  test("a value outside the page keeps its word, which is what a page is", async () => {
    const api = fakeApi();
    api.list.mockResolvedValue({ total: 1, items: [{ id: ID, displayName: "Ada Lovelace" }] });
    installed(api);
    const { result, unmount } = await renderHook(() =>
      useDirectoryNames([...pointer(ID), ...pointer(OTHER)]),
    );
    await settled(result, at(ID), "Ada Lovelace");
    expect(result.current[at(OTHER)]).toBe("Assigned");
    await leave(unmount);
  });
});

test("directory portraits share one bounded page and withdraw together on a refreshed refusal", async () => {
  const portrait = "ced4977a-e66c-4968-8fc8-f826017602d9";
  user = {
    ...user,
    fields: [...user.fields, { name: "portraitFile", type: "uuid", present: "avatar" }],
  };
  catalog = {
    ...catalog,
    resources: catalog.resources.map((e) => (e.module === "user" ? user : e)),
  };
  const api = fakeApi();
  api.list.mockResolvedValue({
    total: 2,
    items: [
      { id: ID, displayName: "Ana", portraitFile: portrait },
      { id: OTHER, displayName: "Ben", portraitFile: portrait },
    ],
  });
  installed(api);
  const view = await renderHook(
    ({ ids, visit }: { readonly ids: readonly Pointer[]; readonly visit: number }) =>
      useDirectoryPeople(ids, visit),
    {
      initialProps: { ids: pointer(ID), visit: 0 },
    },
  );
  await flush();
  expect(view.result.current.people[at(ID)]?.portrait).toBe(portrait);
  await view.rerender({ ids: [...pointer(ID), ...pointer(OTHER)], visit: 0 });
  await flush();
  expect(view.result.current.names[at(OTHER)]).toBe("Ben");
  expect(api.list).toHaveBeenCalledTimes(1);
  api.list.mockRejectedValue(new ApiError(403, "Refused"));
  await view.rerender({ ids: [...pointer(ID), ...pointer(OTHER)], visit: 1 });
  await flush();
  expect(view.result.current.people).toEqual({});
  expect(view.result.current.names[at(ID)]).toBe("Assigned");
  expect(api.list).toHaveBeenCalledTimes(2);
  await leave(view.unmount);
});

test("each directory refresh replaces only the target that answered", async () => {
  const api = fakeApi();
  const sites: Entry = { ...user, module: "site", entity: "site", path: "/api/v1/site/sites" };
  catalog = { ...catalog, resources: [...catalog.resources, sites] };
  installed(api);
  const sitePointer: Pointer = { resource: "site/site", id: OTHER };
  const siteAt = nameKey(sitePointer.resource, sitePointer.id);
  api.list.mockImplementation(async (entry) => ({
    total: 1,
    items: [
      entry.module === "user"
        ? { id: ID, displayName: "Leila Kumar" }
        : { id: OTHER, displayName: "Western depot" },
    ],
  }));
  const view = await renderHook(
    (visit: number) => useDirectoryPeople([...pointer(ID), sitePointer], visit),
    { initialProps: 0 },
  );
  await flush();
  expect(view.result.current.names[at(ID)]).toBe("Leila Kumar");
  expect(view.result.current.names[siteAt]).toBe("Western depot");
  api.list.mockImplementation(async (entry) => {
    if (entry.module === "user") throw new ApiError(503, "Unavailable");
    return { total: 0, items: [] };
  });
  await view.rerender(1);
  await flush();
  expect(api.list).toHaveBeenCalledTimes(4);
  expect(view.result.current.names[at(ID)]).toBe("Leila Kumar");
  expect(view.result.current.names[siteAt]).toBe("Linked");
  expect(view.result.current.people[siteAt]).toBeUndefined();
  await leave(view.unmount);
});
