// The device store keeps one sign-in's held writes out of reach of another on
// the SQLite file itself, not only in the in-memory double: a claim, a release,
// a settle and a drop name the server and the person as well as the id. The
// adapter runs here over node:sqlite through an expo-sqlite stand-in that binds
// positional parameters the way expo-sqlite does on a device — parameter i at
// index i + 1, and a parameter with no placeholder dropped without a word,
// because neither platform checks the bind's return code
// (node_modules/expo-sqlite/ios/SQLiteModule.swift getBindParamIndex and
// bindStatementParam; android/.../SQLiteModule.kt `statement.ref.bindStatementParam`).
// It is a .tsx file only so Jest, which can mock expo-sqlite, discovers it; it
// needs a Node that ships node:sqlite.
import { describe, expect, jest, test } from "@jest/globals";
import { heldWrite, type Scope } from "../src/core/outbox";
import { RECENT_KEEP, recentFrom } from "../src/core/recents";
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
  return { openDatabaseAsync: async () => db };
});

const ADA: Scope = { server: "https://acme.test", userId: "ada" };
const BEA: Scope = { server: "https://acme.test", userId: "bea" };
const AT = "2026-10-06T10:00:00.000Z";

describe("the device store", () => {
  test("another server cannot read, replace or forget this server's recent open", async () => {
    const { recents } = createNativeStore();
    await recents.open();
    const first = { server: "https://tenant-a.example.test", userId: "same-person" };
    const second = { server: "https://tenant-b.example.test", userId: "same-person" };
    const ref = { resourceKey: "note/note", recordId: "shared-id" };
    const opened = recentFrom({ ...ref, title: "First workspace", openedAt: AT });
    await recents.save(first, opened);

    expect(await recents.recent(second, 5)).toEqual([]);
    await recents.forget(second, ref);
    expect(await recents.recent(first, 5)).toEqual([opened]);

    await recents.save(second, { ...opened, title: "Second workspace" });
    expect(await recents.recent(first, 5)).toEqual([opened]);
    expect((await recents.recent(second, 5)).map((row) => row.title)).toEqual(["Second workspace"]);
    await recents.forget(second, ref);
    expect(await recents.recent(second, 5)).toEqual([]);
    expect(await recents.recent(first, 5)).toEqual([opened]);
  });

  test("one sign-in cannot claim or discard another sign-in's held write", async () => {
    const { outbox } = createNativeStore();
    await outbox.open();
    const item = heldWrite(
      {
        kind: "create",
        resourceKey: "note/note",
        path: "/api/v1/note/notes",
        body: { title: "Ada's" },
      },
      "write-ada-1",
      AT,
    );
    await outbox.append(ADA, item);
    expect((await outbox.list(ADA)).map((held) => held.id)).toEqual(["write-ada-1"]);

    expect(await outbox.claim(BEA, item.id, AT)).toBeUndefined();
    expect(await outbox.drop(BEA, item.id)).toBe(false);

    const left = await outbox.list(ADA);
    expect(left.map((held) => [held.id, held.state, held.attempt])).toEqual([
      ["write-ada-1", "queued", 0],
    ]);
  });

  // The section a person reads at the top of Home is theirs alone, and it is the SQL
  // that says so: the same two columns every other statement names, in the primary key
  // that makes one open one row.
  test("one sign-in reads their own opens, and an open is one row", async () => {
    const { recents } = createNativeStore();
    await recents.open();
    const open = (at: string, id: string, title: string) =>
      recentFrom({ resourceKey: "note/note", recordId: id, title, openedAt: at });

    await recents.save(ADA, open("2026-10-06T10:00:00.000Z", "n-1", "Ada's standup"));
    expect(await recents.recent(BEA, 5)).toEqual([]);
    expect((await recents.recent(ADA, 5)).map((row) => row.title)).toEqual(["Ada's standup"]);

    // The record again, under its new name: the primary key is the record.
    await recents.save(ADA, open("2026-10-06T12:00:00.000Z", "n-1", "Standup, renamed"));
    await recents.save(BEA, open("2026-10-06T11:00:00.000Z", "b-1", "Bea's retro"));
    expect((await recents.recent(ADA, 5)).map((row) => [row.recordId, row.title])).toEqual([
      ["n-1", "Standup, renamed"],
    ]);
    expect((await recents.recent(BEA, 5)).map((row) => row.recordId)).toEqual(["b-1"]);

    // Newest first through the window Home asks for, and the table keeps its bound.
    for (let i = 0; i < 30; i++)
      await recents.save(
        ADA,
        open(`2026-10-06T13:${String(i).padStart(2, "0")}:00.000Z`, `x-${i}`, `Note ${i}`),
      );
    const shown = await recents.recent(ADA, 5);
    expect(shown.map((row) => row.recordId)).toEqual(["x-29", "x-28", "x-27", "x-26", "x-25"]);
    expect(await recents.recent(ADA, RECENT_KEEP + 10)).toHaveLength(RECENT_KEEP);
  });

  // A record deleted on this phone loses its door. The withdrawal is one statement on the
  // table's own key and names both scope columns, so it cannot reach across to another
  // sign-in's list or take a second row with it.
  test("a withdrawn open takes its one row and nobody else's", async () => {
    const { recents } = createNativeStore();
    await recents.open();
    // Two sign-ins nobody else's case has written as, so what their lists answer are the
    // rows this case wrote and nothing the file already held.
    const CLEO = { server: "https://acme.test", userId: "cleo" };
    const DAN = { server: "https://acme.test", userId: "dan" };
    const open = (at: string, id: string, title: string) =>
      recentFrom({ resourceKey: "note/note", recordId: id, title, openedAt: at });

    await recents.save(CLEO, open("2026-10-06T10:00:00.000Z", "n-1", "Cleo's standup"));
    await recents.save(CLEO, open("2026-10-06T11:00:00.000Z", "n-2", "Cleo's retro"));
    await recents.save(DAN, open("2026-10-06T10:30:00.000Z", "n-1", "Dan's standup"));

    await recents.forget(CLEO, { resourceKey: "note/note", recordId: "n-1" });
    expect((await recents.recent(CLEO, 5)).map((row) => row.recordId)).toEqual(["n-2"]);
    // Same resource, same record id, another sign-in: the row is theirs and stays.
    expect((await recents.recent(DAN, 5)).map((row) => row.title)).toEqual(["Dan's standup"]);
    // Withdrawing an open the list never held changes no row.
    await recents.forget(CLEO, { resourceKey: "note/note", recordId: "gone" });
    expect(await recents.recent(CLEO, 5)).toHaveLength(1);
  });
});
