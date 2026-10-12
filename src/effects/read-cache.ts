// The read cache answers a screen from what this phone last received when the
// server cannot be reached, so a list shows its last page instead of an error.
// Which response earns a row, and which address a stored one answers for, come
// from src/core/read-cache.ts. A 4xx is never answered from here: the server
// answered, and what it said is the truth.
import { worthKeeping, readAddress, type CachedAnswer, type ReadKind } from "../core/read-cache";
import type { Clock } from "../core/presentation";
import { isScope, type Scope } from "../core/outbox";
import { outcomeOf } from "./outbox";

export interface ReadStore {
  open(): Promise<void>;
  /** save replaces this address's answer and prunes what this person's browsing no longer needs. */
  save(scope: Scope, answer: CachedAnswer): Promise<void>;
  find(scope: Scope, path: string): Promise<CachedAnswer | undefined>;
  clear(scope: Scope): Promise<void>;
}

export interface ReadAddress {
  readonly path: string;
  readonly kind: ReadKind;
  readonly resourceKey: string;
  readonly offset?: number;
}

export interface Cached<T> {
  readonly value: T;
  /** source says where what is on screen came from, so a screen can say so too. */
  readonly source: "server" | "device";
  /** savedAt is the instant the stored answer arrived, in UTC; only a device answer has one. */
  readonly savedAt?: string;
}

export interface ReadCache {
  readonly open: () => Promise<void>;
  readonly answer: <T>(address: ReadAddress, read: () => Promise<T>) => Promise<Cached<T>>;
  readonly find: (path: string) => Promise<CachedAnswer | undefined>;
  readonly clear: () => Promise<void>;
}

export interface ReadCacheDeps {
  readonly store: ReadStore;
  readonly clock: Clock;
  readonly scope: () => Scope | undefined;
}

/**
 * answered reads one address through this shell's cache, or straight to the
 * server where the shell has no device store. A screen asks once either way, so
 * the page a person sees offline is the same shape as the one they saw online —
 * there is no second read path to keep honest.
 */
export async function answered<T>(
  reads: ReadCache | undefined,
  address: ReadAddress,
  query: string,
  read: () => Promise<T>,
): Promise<Cached<T>> {
  if (!reads) return { value: await read(), source: "server" };
  return reads.answer({ ...address, path: readAddress(address.path, query) }, read);
}

export function createReadCache(deps: ReadCacheDeps): ReadCache {
  const { store, clock } = deps;
  let ready: Promise<void> | undefined;

  function current(): Scope | undefined {
    const scope = deps.scope();
    return scope === undefined || isScope(scope) ? scope : undefined;
  }

  async function opened(): Promise<void> {
    ready ??= store.open();
    await ready;
  }

  return {
    open: opened,

    async answer<T>(address: ReadAddress, read: () => Promise<T>): Promise<Cached<T>> {
      await opened();
      // The scope is taken when the read is asked for. A response that arrives
      // after the person or the server changed is that person's own data, so it
      // is kept for the scope that asked for it and never for the one that
      // happens to be signed in now.
      const asked = current();
      try {
        const value = await read();
        if (asked && worthKeeping(address.offset ?? 0))
          await store.save(asked, {
            version: 1,
            kind: address.kind,
            resourceKey: address.resourceKey,
            path: address.path,
            payload: JSON.stringify(value),
            savedAt: clock.now(),
          });
        return { value, source: "server" };
      } catch (error) {
        // A read that came back with nothing is answered for whoever is asking
        // now, from that scope's own rows: a person never sees the last page of
        // the person who was here before.
        const asking = current();
        const silence = outcomeOf(error);
        if (!asking || (silence !== "unreachable" && silence !== "timeout")) throw error;
        const hit = await store.find(asking, address.path);
        if (!hit) throw error;
        return {
          value: JSON.parse(hit.payload) as T,
          source: "device",
          savedAt: hit.savedAt,
        };
      }
    },

    async find(path: string) {
      await opened();
      const scope = current();
      return scope === undefined ? undefined : await store.find(scope, path);
    },

    async clear() {
      await opened();
      const scope = current();
      if (scope) await store.clear(scope);
    },
  };
}
