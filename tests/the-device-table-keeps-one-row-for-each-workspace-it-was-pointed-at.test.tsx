// What this phone remembers of the workspaces it was pointed at is a SQLite table, and this
// is where its own statements run: one row per server, replaced in place when that server
// answers again, the mark round-tripping through its column, the list newest-first within the
// window the connect step draws, and the bound pruned in the same transaction that wrote. The
// stand-in below binds positional parameters the way expo-sqlite does on a device, over
// node:sqlite, so a device table is not shipped on the strength of an in-memory double alone.
// It is a .tsx file only so Jest, which can mock expo-sqlite, discovers it; it needs a Node
// that ships node:sqlite.
import { describe, expect, jest, test } from "@jest/globals";
import { WORKSPACES_KEEP, rememberedFrom } from "../src/core/workspace";
import { createNativeStore } from "../src/effects/native-store";

jest.mock("expo-sqlite", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const file = new DatabaseSync(":memory:");
  type MockBind = null | number | string;
  const bound = (sql: string, params: readonly MockBind[] = []) =>
    params.slice(0, sql.split("?").length - 1);
  const db = {
    getFirstAsync: async (sql: string, params?: MockBind[]) =>
      file.prepare(sql).get(...bound(sql, params)) ?? null,
    getAllAsync: async (sql: string, params?: MockBind[]) =>
      file.prepare(sql).all(...bound(sql, params)),
    runAsync: async (sql: string, params?: MockBind[]) => {
      const result = file.prepare(sql).run(...bound(sql, params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    execAsync: async (sql: string) => {
      file.exec(sql);
    },
    withExclusiveTransactionAsync: async (task: (txn: unknown) => Promise<void>) => {
      file.exec("BEGIN EXCLUSIVE");
      try {
        await task(db);
        file.exec("COMMIT");
      } catch (error) {
        file.exec("ROLLBACK");
        throw error;
      }
    },
  };
  // The file itself is reachable so a case can write a row no writer would write — the
  // unreadable row this suite then reads back, which the store's own port cannot produce.
  return { openDatabaseAsync: async () => db, file };
});

const file = (
  jest.requireMock("expo-sqlite") as unknown as { readonly file: { exec: (sql: string) => void } }
).file;

const MARK = "/api/v1/public/file/files/0199mark";
const row = (host: string, name: string, seenAt: string, logoPath?: string) => ({
  host: `https://${host}`,
  name,
  ...(logoPath === undefined ? {} : { logoPath }),
  seenAt,
});

describe("the device's workspace table", () => {
  test("one server holds one row, and what it answers again replaces it mark and all", async () => {
    const { workspaces } = createNativeStore();
    await workspaces.open();
    await workspaces.save(row("first.test", "First Works", "2026-10-19T10:00:00.000Z", MARK));
    await workspaces.save(row("second.test", "Second Works", "2026-10-19T10:30:00.000Z"));
    expect(await workspaces.listed(5)).toEqual([
      { host: "https://second.test", name: "Second Works", seenAt: "2026-10-19T10:30:00.000Z" },
      {
        host: "https://first.test",
        name: "First Works",
        logoPath: MARK,
        seenAt: "2026-10-19T10:00:00.000Z",
      },
    ]);

    // The same server under a new name and with no mark now: the row is the server, so the
    // mark that answer stopped naming goes with it rather than outliving its own answer.
    await workspaces.save(row("first.test", "First Works Ltd", "2026-10-19T11:00:00.000Z"));
    expect(await workspaces.listed(5)).toEqual([
      {
        host: "https://first.test",
        name: "First Works Ltd",
        seenAt: "2026-10-19T11:00:00.000Z",
      },
      { host: "https://second.test", name: "Second Works", seenAt: "2026-10-19T10:30:00.000Z" },
    ]);
  });

  test("the list is newest first within the window asked for, and never outlives its bound", async () => {
    const { workspaces } = createNativeStore();
    await workspaces.open();
    // Ten servers, each seen a minute after the one before it, over whatever the case above
    // left standing: the prune is the table's own, so the older rows leave with the newest.
    for (let i = 0; i < 10; i++) {
      const minute = String(i).padStart(2, "0");
      await workspaces.save(
        row(`batch-${i}.test`, `Batch ${i}`, `2026-10-20T09:${minute}:00.000Z`),
      );
    }
    const window = await workspaces.listed(5);
    expect(window.map((entry) => entry.name)).toEqual([
      "Batch 9",
      "Batch 8",
      "Batch 7",
      "Batch 6",
      "Batch 5",
    ]);
    const held = await workspaces.listed(WORKSPACES_KEEP + 10);
    expect(held).toHaveLength(WORKSPACES_KEEP);
    // The eight newest are this case's eight newest: a write that prunes never keeps an older
    // row beside a newer one it answered about.
    expect(held.map((entry) => entry.name)).toEqual([
      "Batch 9",
      "Batch 8",
      "Batch 7",
      "Batch 6",
      "Batch 5",
      "Batch 4",
      "Batch 3",
      "Batch 2",
    ]);
  });

  test("a row whose text no longer reads is dropped where it stands, and its neighbours are still listed", async () => {
    const { workspaces } = createNativeStore();
    await workspaces.open();
    // A row no writer of this kit would write: no host to go back to and no moment. The
    // remembered list is a convenience, so an unreadable row costs itself and not the list.
    file.exec(
      "INSERT INTO workspace_seen (host, name, logo_path, seen_at) VALUES ('', 'No host', NULL, '')",
    );
    const held = await workspaces.listed(WORKSPACES_KEEP + 10);
    expect(held.map((entry) => entry.host)).not.toContain("");
    expect(held.map((entry) => entry.name)).not.toContain("No host");
    // Every row that did come back is a row the port's own shape reads.
    for (const entry of held) expect(rememberedFrom(entry)).toEqual(entry);
    expect(held.length).toBeGreaterThan(0);
  });
});
