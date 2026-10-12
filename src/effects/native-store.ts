// native-store.ts is the one file in the kit that names expo-sqlite. It owns
// the database file, its schema version and the SQL behind the two table ports
// in src/effects/outbox.ts and src/effects/read-cache.ts — every decision about
// what a held write means lives above this file, in src/core/outbox.ts.
//
// The file is platformkit.db in the app's private directory. No cookie, token
// or Set-Cookie value is ever written here: a held write is sent with the
// current session's cookie at send time, so an extracted file carries the form
// text a person typed and nothing that signs in as them.
import { openDatabaseAsync, type SQLiteDatabase, type SQLiteBindValue } from "expo-sqlite";
import { heldFrom, WRITE_METHOD, type PendingWrite, type Scope } from "../core/outbox";
import { cachedFrom, CACHE_KEEP, type CachedAnswer } from "../core/read-cache";
import type { OutboxStore } from "./outbox";
import type { ReadStore } from "./read-cache";

export const DATABASE = "platformkit.db";

/** SCHEMA_VERSION is the file's shape, kept in PRAGMA user_version the way expo-sqlite's own storage does. A file that reports a newer version refuses to open; the future never guesses about the present. */
export const SCHEMA_VERSION = 1;

const PENDING = `CREATE TABLE IF NOT EXISTS pending_write (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  server TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  body TEXT,
  state TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  refusal TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL)`;

const BY_SCOPE = `CREATE INDEX IF NOT EXISTS pending_scope ON pending_write (server, user_id, state, seq)`;

const CACHED = `CREATE TABLE IF NOT EXISTS cached_read (
  server TEXT NOT NULL,
  user_id TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  version INTEGER NOT NULL,
  PRIMARY KEY (server, user_id, path))`;

interface PendingRow {
  readonly id: string;
  readonly kind: PendingWrite["kind"];
  readonly resource_key: string;
  readonly method: PendingWrite["method"];
  readonly path: string;
  readonly body: string | null;
  readonly state: PendingWrite["state"];
  readonly attempt: number;
  readonly refusal: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

interface CachedRow {
  readonly path: string;
  readonly kind: CachedAnswer["kind"];
  readonly resource_key: string;
  readonly payload: string;
  readonly saved_at: string;
  readonly version: number;
}

function held(row: PendingRow): PendingWrite {
  // Parse-on-read, kept from the store this kit generalises: the row's JSON
  // text becomes a PendingWrite through the one validator, and a row that fails
  // it refuses the read rather than being guessed at.
  return heldFrom({
    version: row.version,
    id: row.id,
    kind: row.kind,
    resourceKey: row.resource_key,
    method: row.method,
    path: row.path,
    ...(row.body === null ? {} : { body: row.body }),
    state: row.state,
    attempt: row.attempt,
    ...(row.refusal === null ? {} : { refusal: JSON.parse(row.refusal) }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function answer(row: CachedRow): CachedAnswer | undefined {
  // A cached answer may be lost: a row this version cannot read is dropped
  // where an unreadable held write refuses its table, because a half-read write
  // would corrupt the queue's order and its claims and a half-read page cannot.
  try {
    return cachedFrom({
      version: row.version,
      kind: row.kind,
      resourceKey: row.resource_key,
      path: row.path,
      payload: row.payload,
      savedAt: row.saved_at,
    });
  } catch {
    return undefined;
  }
}

/** createNativeStore opens the file once and answers both table ports from the one connection. */
export function createNativeStore(): { outbox: OutboxStore; reads: ReadStore } {
  let opening: Promise<SQLiteDatabase> | undefined;

  function database(): Promise<SQLiteDatabase> {
    opening ??= (async () => {
      const db = await openDatabaseAsync(DATABASE);
      const pragma = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      const version = pragma?.user_version ?? 0;
      if (version > SCHEMA_VERSION)
        throw new Error(
          "This phone's data was written by a newer version of this app; update the app before reading it.",
        );
      // The tables and their version commit together, and a row left `sending`
      // by a death mid-send is answered from the row before anything reads it:
      // attempt 0 means the claim happened and nothing went on a wire, so the
      // write is queued again; anything above 0 means its fate is not knowable.
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.execAsync(PENDING);
        await txn.execAsync(BY_SCOPE);
        await txn.execAsync(CACHED);
        if (version < SCHEMA_VERSION)
          await txn.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        await txn.execAsync(
          "UPDATE pending_write SET state = 'queued' WHERE state = 'sending' AND attempt = 0",
        );
        await txn.execAsync(
          "UPDATE pending_write SET state = 'unknown' WHERE state = 'sending' AND attempt > 0",
        );
      });
      return db;
    })();
    return opening;
  }

  /**
   * write runs one statement that ends in `AND server = ? AND user_id = ?`: the
   * scope's two values are the last two binds, in that order, because
   * expo-sqlite binds positionally and drops a parameter with no placeholder
   * without a word (ios/SQLiteModule.swift getBindParamIndex and
   * bindStatementParam, android/.../SQLiteModule.kt statement.ref.bindStatementParam
   * — neither checks the bind's return code). So a statement that does not name
   * the scope columns is not scoped at all, and one sign-in would move another's
   * held write. Every statement that reaches a row names them.
   */
  async function write(scope: Scope, sql: string, ...params: SQLiteBindValue[]): Promise<number> {
    const db = await database();
    const result = await db.runAsync(sql, [...params, scope.server, scope.userId]);
    return result.changes;
  }

  async function list(scope: Scope): Promise<readonly PendingWrite[]> {
    const db = await database();
    const rows = await db.getAllAsync<PendingRow>(
      "SELECT * FROM pending_write WHERE server = ? AND user_id = ? ORDER BY seq",
      [scope.server, scope.userId],
    );
    return rows.map(held);
  }

  async function claim(scope: Scope, id: string, at: string): Promise<PendingWrite | undefined> {
    const changes = await write(
      scope,
      `UPDATE pending_write SET state = 'sending', attempt = attempt + 1, updated_at = ?
       WHERE id = ? AND state IN ('queued', 'refused') AND server = ? AND user_id = ?`,
      at,
      id,
    );
    return changes === 0 ? undefined : (await list(scope)).find((item) => item.id === id);
  }

  // One connection answers both ports; the two views are what the two units
  // import, so neither reaches into the other's table.
  const outboxStore: OutboxStore = {
    open: () => database().then(() => undefined),

    append: (scope, item) =>
      database().then(async (db) => {
        await db.runAsync(
          `INSERT INTO pending_write (id, server, user_id, kind, resource_key, method, path, body, state, attempt, refusal, created_at, updated_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            scope.server,
            scope.userId,
            item.kind,
            item.resourceKey,
            WRITE_METHOD[item.kind],
            item.path,
            item.body ?? null,
            item.state,
            item.attempt,
            item.refusal === undefined ? null : JSON.stringify(item.refusal),
            item.createdAt,
            item.updatedAt,
            item.version,
          ],
        );
      }),

    list,

    async next(scope) {
      const db = await database();
      const row = await db.getFirstAsync<PendingRow>(
        "SELECT * FROM pending_write WHERE server = ? AND user_id = ? AND state = 'queued' ORDER BY seq LIMIT 1",
        [scope.server, scope.userId],
      );
      return row === null ? undefined : held(row);
    },

    claim,

    release: (scope, id, at) =>
      write(
        scope,
        `UPDATE pending_write SET state = 'queued', attempt = attempt - 1, updated_at = ?
         WHERE id = ? AND state = 'sending' AND server = ? AND user_id = ?`,
        at,
        id,
      ).then(() => undefined),

    async settle(scope, id, state, at, reason) {
      await write(
        scope,
        `UPDATE pending_write SET state = ?, refusal = ?, updated_at = ?
         WHERE id = ? AND state = 'sending' AND server = ? AND user_id = ?`,
        state,
        reason === undefined ? null : JSON.stringify(reason),
        at,
        id,
      );
    },

    async drop(scope, id) {
      const changes = await write(
        scope,
        "DELETE FROM pending_write WHERE id = ? AND server = ? AND user_id = ?",
        id,
      );
      return changes > 0;
    },

    async clear(scope) {
      const db = await database();
      await db.runAsync("DELETE FROM pending_write WHERE server = ? AND user_id = ?", [
        scope.server,
        scope.userId,
      ]);
    },
  };

  const readStore: ReadStore = {
    open: () => database().then(() => undefined),

    save: async (scope, cached) => {
      const db = await database();
      // The replace and the prune are one write: a cache that outlives its own
      // ceiling on the way to the statement that trims it would be a leak.
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `INSERT INTO cached_read (server, user_id, path, kind, resource_key, payload, saved_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (server, user_id, path) DO UPDATE SET
             kind = excluded.kind, resource_key = excluded.resource_key,
             payload = excluded.payload, saved_at = excluded.saved_at, version = excluded.version`,
          [
            scope.server,
            scope.userId,
            cached.path,
            cached.kind,
            cached.resourceKey,
            cached.payload,
            cached.savedAt,
            cached.version,
          ],
        );
        await txn.runAsync(
          `DELETE FROM cached_read WHERE server = ? AND user_id = ? AND path NOT IN (
             SELECT path FROM cached_read WHERE server = ? AND user_id = ?
             ORDER BY saved_at DESC LIMIT ?)`,
          [scope.server, scope.userId, scope.server, scope.userId, CACHE_KEEP],
        );
      });
    },

    async find(scope, path) {
      const db = await database();
      const row = await db.getFirstAsync<CachedRow>(
        "SELECT * FROM cached_read WHERE server = ? AND user_id = ? AND path = ?",
        [scope.server, scope.userId, path],
      );
      if (row === null) return undefined;
      const cached = answer(row);
      if (cached === undefined)
        // Dropping it is the repair: the next successful read replaces it.
        await db.runAsync("DELETE FROM cached_read WHERE server = ? AND user_id = ? AND path = ?", [
          scope.server,
          scope.userId,
          path,
        ]);
      return cached;
    },

    async clear(scope) {
      const db = await database();
      await db.runAsync("DELETE FROM cached_read WHERE server = ? AND user_id = ?", [
        scope.server,
        scope.userId,
      ]);
    },
  };

  return { outbox: outboxStore, reads: readStore };
}

/** deviceStore is the one database file, seen as the two table ports the kit owns. */
export const deviceStore = createNativeStore();
