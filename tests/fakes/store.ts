// The store the outbox and the read cache are tested against: the same columns
// pending_write and cached_read have, the same scope rule every statement
// carries, and the same one-statement claim — no ordering heuristic, no timer
// and no knowledge of the unit's rules. It refuses a call whose scope is not
// well formed, naming the method that was called, so a test that forgets a scope
// fails here rather than quietly passing against a store that never checks.
import { heldFrom, isScope, type PendingWrite, type Scope } from "../../src/core/outbox";
import { cachedFrom, CACHE_VERSION, type CachedAnswer } from "../../src/core/read-cache";
import { RECENT_KEEP, recentFrom, recentKey, type Recent } from "../../src/core/recents";
import type { OutboxStore } from "../../src/effects/outbox";
import type { ReadStore } from "../../src/effects/read-cache";
import type { RecentsStore } from "../../src/effects/recents";

interface Row {
  readonly seq: number;
  readonly server: string;
  readonly userId: string;
  readonly item: PendingWrite;
}

/** guard is the scope rule of §4.2 as a double can enforce it: a statement that names nobody runs nowhere. */
function guard(method: string, scope: Scope | undefined): Scope {
  if (!isScope(scope))
    throw new RangeError(`${method} needs the server and the sign-in its rows belong to.`);
  return scope;
}

/** fakeOutboxStore holds rows in append order. `rows` is every scope's row, for a test that has to show what nobody else can see. */
export function fakeOutboxStore() {
  const rows: Row[] = [];
  const calls: string[] = [];
  let seq = 0;

  function appendRow(server: string, userId: string, item: PendingWrite): void {
    seq += 1;
    rows.push({ seq, server, userId, item });
  }

  function inScope(scope: Scope): Row[] {
    return rows
      .filter((row) => row.server === scope.server && row.userId === scope.userId)
      .sort((a, b) => a.seq - b.seq);
  }

  // The row's JSON text goes through the kit's validator on the way out, so a
  // malformed record is refused by the same code the device runs.
  function read(row: Row): PendingWrite {
    return heldFrom(JSON.parse(JSON.stringify(row.item)));
  }

  // A row is replaced, never mutated, so a claim answers the row as it is now
  // and not the one it read a moment before.
  function replace(row: Row, item: PendingWrite): Row {
    const next = { ...row, item };
    rows[rows.indexOf(row)] = next;
    return next;
  }

  const store: OutboxStore = {
    open: async () => {
      calls.push("open");
      // Startup reconciliation reads the row, not memory: a claim that never
      // finished is queued again only when nothing went on a wire.
      for (const row of [...rows])
        if (row.item.state === "sending")
          replace(row, { ...row.item, state: row.item.attempt > 0 ? "unknown" : "queued" });
    },
    append: async (scope, item) => {
      guard("append", scope);
      calls.push("append");
      appendRow(scope.server, scope.userId, item);
    },
    list: async (scope) => {
      guard("list", scope);
      calls.push("list");
      return inScope(scope).map(read);
    },
    next: async (scope) => {
      guard("next", scope);
      calls.push("next");
      const queued = inScope(scope).filter((row) => row.item.state === "queued");
      return queued.length === 0 ? undefined : read(queued[0]!);
    },
    claim: async (scope, id, at) => {
      guard("claim", scope);
      calls.push("claim");
      const row = inScope(scope).find(
        (r) => r.item.id === id && (r.item.state === "queued" || r.item.state === "refused"),
      );
      if (!row) return undefined;
      return read(
        replace(row, {
          ...row.item,
          state: "sending",
          attempt: row.item.attempt + 1,
          updatedAt: at,
        }),
      );
    },
    release: async (scope, id, at) => {
      guard("release", scope);
      calls.push("release");
      const row = inScope(scope).find((r) => r.item.id === id && r.item.state === "sending");
      if (row)
        replace(row, {
          ...row.item,
          state: "queued",
          attempt: row.item.attempt - 1,
          updatedAt: at,
        });
    },
    settle: async (scope, id, state, at, reason) => {
      guard("settle", scope);
      calls.push("settle");
      const row = inScope(scope).find((r) => r.item.id === id && r.item.state === "sending");
      if (!row) return;
      const settled: PendingWrite = { ...row.item, state, updatedAt: at };
      // refusal is NULL unless state = 'refused' — the column pair the device
      // stores, kept honest by the double so a test cannot invent a third case.
      if (state === "refused" && reason !== undefined)
        Object.assign(settled, { refusal: JSON.parse(JSON.stringify(reason)) });
      replace(row, settled);
    },
    drop: async (scope, id) => {
      guard("drop", scope);
      calls.push("drop");
      const at = rows.findIndex(
        (r) => r.item.id === id && r.server === scope.server && r.userId === scope.userId,
      );
      if (at < 0) return false;
      rows.splice(at, 1);
      return true;
    },
    clear: async (scope) => {
      guard("clear", scope);
      calls.push("clear");
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i]!.server === scope.server && rows[i]!.userId === scope.userId) rows.splice(i, 1);
    },
  };

  return {
    store,
    calls,
    rows,
    /** raw seeds a row the unit never held, for a device that already holds one. */
    raw: (item: PendingWrite, server = "https://acme.test", userId = "ada") =>
      appendRow(server, userId, item),
  };
}

/** fakeReadStore holds one answer per (server, sign-in, path), which is the cache's whole shape. */
export function fakeReadStore() {
  const rows: { server: string; userId: string; answer: CachedAnswer }[] = [];
  const calls: string[] = [];

  const store: ReadStore = {
    open: async () => {
      calls.push("open");
    },
    save: async (scope, answer) => {
      guard("save", scope);
      calls.push("save");
      const at = rows.findIndex(
        (r) =>
          r.server === scope.server && r.userId === scope.userId && r.answer.path === answer.path,
      );
      const row = { server: scope.server, userId: scope.userId, answer };
      if (at < 0) rows.push(row);
      else rows[at] = row;
    },
    find: async (scope, path) => {
      guard("find", scope);
      calls.push("find");
      const row = rows.find(
        (r) => r.server === scope.server && r.userId === scope.userId && r.answer.path === path,
      );
      // An answer this version cannot read is dropped: a cache may be lost,
      // which is the opposite of what an unreadable held write does.
      if (!row || row.answer.version !== CACHE_VERSION) return undefined;
      return cachedFrom(JSON.parse(JSON.stringify(row.answer)));
    },
    clear: async (scope) => {
      guard("clear", scope);
      calls.push("clear");
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i]!.server === scope.server && rows[i]!.userId === scope.userId) rows.splice(i, 1);
    },
  };

  return {
    store,
    calls,
    rows,
    /** unreadable makes one stored answer un-readable, the way a newer record version would. */
    unreadable: (path: string) => {
      const row = rows.find((r) => r.answer.path === path);
      if (row) Object.assign(row.answer, { version: 99 });
    },
  };
}

export const clock = (at = "2026-10-06T10:00:00.000Z") => ({
  now: () => at,
  set(next: string) {
    at = next;
  },
});

/** mint answers one id per call, so a test can say which key belongs to which write. */
export function mint(): () => string {
  let n = 0;
  return () => `00000000-0000-4000-8000-0000000000${String(++n).padStart(2, "0")}`;
}

/** heldRow is a held write as the device would answer it, after a test moved it on. */
export function heldRow(item: PendingWrite, over: Partial<PendingWrite> = {}): PendingWrite {
  return heldFrom({ ...item, ...over });
}

interface Remembered {
  readonly server: string;
  readonly userId: string;
  readonly item: Recent;
}

/**
 * fakeRecentsStore holds one row per (server, sign-in, resource, record) — the table's own
 * key — and enforces the same scope rule as the device: a call whose scope names nobody
 * stores nothing and reads nothing. `rows` is every scope's row, so a test can show what
 * one sign-in cannot see.
 */
export function fakeRecentsStore() {
  const rows: Remembered[] = [];
  const calls: string[] = [];

  function inScope(scope: Scope): Remembered[] {
    return rows.filter((row) => row.server === scope.server && row.userId === scope.userId);
  }

  // Newest first, and the later open first among rows that carry the same instant: what
  // the device's `ORDER BY opened_at DESC, rowid DESC` answers, read off insertion order.
  function byNewest(rowsIn: readonly Remembered[]): Remembered[] {
    return rowsIn
      .map((row, at) => ({ row, at }))
      .sort((a, b) =>
        a.row.item.openedAt === b.row.item.openedAt
          ? b.at - a.at
          : a.row.item.openedAt < b.row.item.openedAt
            ? 1
            : -1,
      )
      .map((entry) => entry.row);
  }

  const store: RecentsStore = {
    open: async () => {
      calls.push("open");
    },
    save: async (scope, recent) => {
      guard("save", scope);
      calls.push("save");
      // The row goes through the device's own validator, so a test cannot seed a row the
      // table would never hold.
      const item = recentFrom(recent);
      const held = inScope(scope).find((row) => recentKey(row.item) === recentKey(item));
      if (held) rows.splice(rows.indexOf(held), 1);
      rows.push({ server: scope.server, userId: scope.userId, item });
      // The same bound the insert transaction prunes to.
      while (inScope(scope).length > RECENT_KEEP) {
        const oldest = byNewest(inScope(scope)).at(-1);
        if (!oldest) break;
        rows.splice(rows.indexOf(oldest), 1);
      }
    },
    recent: async (scope, limit) => {
      guard("recent", scope);
      calls.push("recent");
      return byNewest(inScope(scope))
        .slice(0, limit)
        .map((row) => row.item);
    },
  };

  return {
    store,
    calls,
    rows,
    /** remembered answers what this scope's section would be drawn from, cap and all. */
    shown: (scope: Scope) => byNewest(inScope(scope)).map((row) => row.item),
  };
}
