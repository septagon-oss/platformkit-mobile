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
});
