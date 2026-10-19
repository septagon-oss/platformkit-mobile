// The workspaces port: the servers this device has seen a workspace answer on, over the
// table in src/effects/native-store.ts. Which rows are kept, how many are drawn and what
// one holds is decided in src/core/workspace.ts; this file carries the clock and the
// statement. Unlike a person's recent opens these rows name a server and not a person, so
// there is no scope to wait for: a workspace's face is nobody's reading list.
import {
  WORKSPACES_SHOWN,
  rememberedStamp,
  type Remembered,
  type Workspace,
} from "../core/workspace";
import type { Clock } from "../core/presentation";

export interface WorkspaceStore {
  open(): Promise<void>;
  /**
   * save replaces this server's row and prunes what a person's switching no longer needs,
   * in the one transaction: a list that grew past its bound on the way to the statement
   * that trims it would be a leak, and a row is never half-written.
   */
  save(workspace: Remembered): Promise<void>;
  /** listed answers the remembered workspaces, most recently seen first, at most `limit`. */
  listed(limit: number): Promise<readonly Remembered[]>;
}

export interface Workspaces {
  /**
   * remember keeps what one server answered of itself, filed under the origin that face was
   * read from — the typed address on the connect step, the session's once there is one. A
   * workspace with no address or no name writes nothing, so a phone points at a stranger's
   * address only by pointing at it.
   */
  readonly remember: (workspace: Workspace) => Promise<void>;
  readonly list: () => Promise<readonly Remembered[]>;
}

export interface WorkspacesDeps {
  readonly store: WorkspaceStore;
  readonly clock: Clock;
}

/**
 * createWorkspaces keeps this device's list of workspaces.
 *
 * One server holds one row, so a name or a mark that changes is replaced rather than
 * appended to, and the stamp comes from the injected clock in UTC — which workspace this
 * phone last pointed at is a fact about the phone. Nothing here stores a credential: the
 * row's shape cannot carry one, and the secure record stays the only place a key is kept
 * (src/effects/session.ts).
 */
export function createWorkspaces(deps: WorkspacesDeps): Workspaces {
  return {
    async remember(workspace) {
      const entry = rememberedStamp(workspace, deps.clock.now());
      if (entry === undefined) return;
      await deps.store.save(entry);
    },
    async list() {
      return await deps.store.listed(WORKSPACES_SHOWN);
    },
  };
}
