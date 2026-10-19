// The recents port: one person's opens on this device, over the table in
// src/effects/native-store.ts. Which opens are kept, how many are drawn and what one row
// holds is decided in src/core/recents.ts; this file only carries the scope and the clock.
import { RECENT_SHOWN, recentFrom, type Recent, type RecentRef } from "../core/recents";
import type { Scope } from "../core/outbox";
import type { Clock } from "../core/presentation";

export interface RecentsStore {
  open(): Promise<void>;
  /**
   * save replaces this record's row for this person and prunes what their browsing no
   * longer needs, in the one transaction: an open is never half-written, so a phone that
   * died between the two statements did not keep a list that grew past its bound.
   */
  save(scope: Scope, recent: Recent): Promise<void>;
  /**
   * forget withdraws one open of this person's and leaves every other row: the record
   * behind it is gone, and a section that kept pointing at it would draw a door that
   * opens nowhere.
   */
  forget(scope: Scope, ref: RecentRef): Promise<void>;
  /** recent answers this person's opens, newest first, at most `limit` of them. */
  recent(scope: Scope, limit: number): Promise<readonly Recent[]>;
}

export interface Recents {
  readonly opened: (recent: Omit<Recent, "openedAt">) => Promise<void>;
  /** forgot takes one remembered open away; with no scope resolved, nothing is kept to take. */
  readonly forgot: (ref: RecentRef) => Promise<void>;
  readonly list: () => Promise<readonly Recent[]>;
}

export interface RecentsDeps {
  readonly store: RecentsStore;
  readonly clock: Clock;
  readonly scope: () => Scope | undefined;
}

/**
 * createRecents keeps one person's opens for one server.
 *
 * An open replaces the same record's row rather than adding a second one, so reopening is
 * not two rows, and the stamp comes from the injected clock in UTC — the section says what
 * this device opened, which is a fact about the device. A deleted record loses its row: the
 * list is a door onto records, so a door onto nothing is a row the list has no right to
 * draw. A scope that has not resolved (no session yet) stores nothing, answers nothing and
 * withdraws nothing: a row with no owner would be one person's reading list under another
 * person's name.
 */
export function createRecents(deps: RecentsDeps): Recents {
  return {
    async opened(recent) {
      const scope = deps.scope();
      if (!scope) return;
      await deps.store.save(scope, recentFrom({ ...recent, openedAt: deps.clock.now() }));
    },
    async forgot(ref) {
      const scope = deps.scope();
      if (!scope) return;
      await deps.store.forget(scope, ref);
    },
    async list() {
      const scope = deps.scope();
      if (!scope) return [];
      return await deps.store.recent(scope, RECENT_SHOWN);
    },
  };
}
