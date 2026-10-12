// The outbox holds the writes a person made that the server never received, and
// sends them in the order they were made when the server can be reached again.
// Every decision about a held write — what may be kept, whose it is, what state
// it is in and when it may be sent — comes from src/core/outbox.ts; this file
// performs it against a store and an Api. It never invents a send: a request
// that may already have landed is only ever sent again by the person pressing
// Retry, because the kernel does not honour an Idempotency-Key until T-0293
// lands, so a duplicate POST would create the record twice.
import { row } from "../core/responses";
import {
  bodyText,
  canMove,
  heldWrite,
  isScope,
  keyRefusal,
  scopeOf,
  bodyRefusal,
  overtakenBy,
  WRITE_METHOD,
  type PendingWrite,
  type Refusal,
  type NewWrite,
  type Scope,
} from "../core/outbox";
import type { Clock } from "../core/presentation";
import { ApiError, type Api } from "./api";

/** OutboxStore is the table this unit owns; src/effects/native-store.ts answers it with expo-sqlite and tests/fakes/store.ts with an array. Both carry the same columns and the same scope rule. */
export interface OutboxStore {
  /** open creates the schema and repairs the rows a death left in `sending`; it names no scope because it labels a fate and exposes no row. */
  open(): Promise<void>;
  append(scope: Scope, item: PendingWrite): Promise<void>;
  /** list answers this scope's rows in append order — the queue's order, which never comes from the clock. */
  list(scope: Scope): Promise<readonly PendingWrite[]>;
  /** next answers the first row of this scope the drain may pick up by itself. */
  next(scope: Scope): Promise<PendingWrite | undefined>;
  /** claim is one statement: it moves a claimable row of this scope to sending and counts the attempt, or answers nothing when somebody else moved it first. */
  claim(scope: Scope, id: string, at: string): Promise<PendingWrite | undefined>;
  /** release returns a row the network never took to queued, with the attempt the claim counted taken back off. */
  release(scope: Scope, id: string, at: string): Promise<void>;
  /** settle moves a claimed row to the state its answer puts it in. */
  settle(
    scope: Scope,
    id: string,
    state: "queued" | "refused" | "unknown",
    at: string,
    reason?: Refusal,
  ): Promise<void>;
  /** drop deletes one row of this scope and says whether it was there. */
  drop(scope: Scope, id: string): Promise<boolean>;
  clear(scope: Scope): Promise<void>;
}

/** SendOutcome is what one send ended as, named by the effect that made it. */
export type SendOutcome = "sent" | "refused" | "unreachable" | "waiting" | "timeout" | "unreadable";

/**
 * outcomeOf reads the error an Api call rejected with and says which of the
 * four things happened. It is the only place the transport's shapes are read:
 * a deadline is the one refusal api.ts gives status 0, so "it went and no answer
 * came back" is distinguishable from "the network never took it"; 5xx, 408 and
 * 429 are the server being there and unhappy, which is not a refusal; anything
 * else came from the transport itself.
 */
export function outcomeOf(error: unknown): SendOutcome {
  if (error instanceof ApiError) {
    if (error.status === 0) return "timeout";
    if (error.status >= 500 || error.status === 408 || error.status === 429) return "waiting";
    if (error.status >= 400) return "refused";
    // It answered 2xx and the body failed its validator: the write may have
    // landed, which is the definition of unknown, never of success.
    return "unreadable";
  }
  return "unreachable";
}

function refusalOf(error: unknown): Refusal {
  if (error instanceof ApiError)
    return { status: error.status, detail: error.detail, fields: { ...error.fields } };
  return { status: 0, detail: error instanceof Error ? error.message : String(error), fields: {} };
}

export interface OutboxDeps {
  readonly store: OutboxStore;
  readonly api: Api;
  readonly clock: Clock;
  /** mint names the idempotency key of one write; expo-crypto's UUID at composition. */
  readonly mint: () => string;
  /** scope is who this phone is signed in as, or nothing when it is signed in as nobody. */
  readonly scope: () => Scope | undefined;
  /** notice is the shell's write count, so a screen re-reads what a held write landed into. */
  readonly notice?: (resourceKey: string) => void;
  /** reached is a hint from the network, never an authority: it delays a pass, it never replaces one. `undefined` is the device not knowing yet, which is not a reason to hold nothing. */
  readonly reached?: () => boolean | undefined;
  /** may re-checks the local rule a screen applies before a verb is offered — the catalog is the authority, and a command the server stopped mounting must not be re-POSTed. */
  readonly may?: (item: PendingWrite) => string | undefined;
}

export type HeldWriteList = readonly PendingWrite[];

export interface Outbox {
  readonly open: () => Promise<void>;
  readonly scopeOf: (server: string, userId: string) => Scope;
  /**
   * submit sends now through the caller's own call when the server answers, and
   * keeps the write when the network never took it. It goes behind whatever the
   * queue already holds — those writes were made earlier and may speak about the
   * same record — and answers as soon as the server answers this one call. When
   * the queue's turn comes round and it still holds an older write to this same
   * record, this one is kept and answers `sent: false`, the answer a network that
   * will not take the request gets: the screen keeps its sheet open and says the
   * phone holds the change, and the write goes when the older one it waited for
   * has landed. `live` is the typed call the screen would have made anyway, so a
   * phone that reaches the server writes exactly as it did before the queue
   * existed; it is handed the write's idempotency key, which the call puts on the
   * wire and the held row keeps as its own id, so every attempt of one write says
   * the same thing.
   */
  readonly submit: <T>(
    write: NewWrite,
    live?: (key: string) => Promise<T>,
  ) => Promise<{ sent: true; row: T } | { sent: false; item: PendingWrite }>;
  readonly list: () => Promise<HeldWriteList>;
  readonly retry: (id: string) => Promise<HeldWriteList>;
  readonly discard: (id: string) => Promise<boolean>;
  readonly drain: (over?: { force?: boolean }) => Promise<void>;
  readonly clear: () => Promise<void>;
  readonly subscribe: (listener: (items: HeldWriteList) => void) => () => void;
}

/**
 * createOutbox composes one queue. Everything it does — every store call, every
 * send, and the drain that makes those sends — runs on one lane, in the order it
 * was asked (the rule routebook's store and src/effects/session.ts both keep: a
 * rejected store call must not poison every call after it). One lane is what
 * makes "one at a time" true of the whole queue rather than of one entry point:
 * a Retry pressed while a drain waits for an older write's answer waits behind
 * that answer. Serial sends are not yet ordered ones, so a send also asks
 * `overtakenBy` before it leaves: Retry on a row an older held write of the same
 * record is still ahead of runs the queue from its head and takes that row when
 * its turn comes, and a write made now goes behind the held queue it just joined
 * — and stays in that queue when its turn ends with the older write still owed.
 * A drain asked for from inside an effect (a submission that proved the network
 * is back, a Discard that left more to send) joins the lane behind the effect
 * that asked for it, which is what lets the person typing the next note go on
 * typing.
 */
export function createOutbox(deps: OutboxDeps): Outbox {
  const { store, api, clock } = deps;
  let lane: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(items: HeldWriteList) => void>();

  function ordered<T>(effect: () => Promise<T>): Promise<T> {
    const next = lane.then(effect);
    lane = next.catch(() => undefined);
    return next;
  }

  function now(): string {
    return clock.now();
  }

  function current(): Scope | undefined {
    const scope = deps.scope();
    return scope === undefined || isScope(scope) ? scope : undefined;
  }

  /**
   * replayed is a stored row as the request it re-makes. Its body is decoded once
   * from the text the row keeps, so what goes back on a wire is the document the
   * form produced — an endpoint that expects an object gets an object, never the
   * text of one. `unreadableBody` is asked first, so the only text decoded here is
   * text this phone itself wrote.
   */
  function replayed(item: PendingWrite): NewWrite {
    return {
      kind: item.kind,
      resourceKey: item.resourceKey,
      path: item.path,
      ...(item.body === undefined ? {} : { body: JSON.parse(item.body) as unknown }),
    };
  }

  /**
   * unreadableBody names why a row cannot be turned back into a request, or nothing
   * when it can. A body that is not JSON is not this phone's own writing — a disk
   * that went bad, or a row this version was not built to read. It must be named and
   * left for the person to discard, not treated as a network that never took the
   * request, which would take the attempt back off and keep the row queued, quietly
   * unsendable, for the rest of this sign-in.
   */
  function unreadableBody(item: PendingWrite): string | undefined {
    if (item.body === undefined) return undefined;
    try {
      JSON.parse(item.body);
      return undefined;
    } catch {
      return "What this phone kept for that write is not something it can read. Discard it and make the write again.";
    }
  }

  async function send(write: NewWrite, key?: string): Promise<unknown> {
    const text = bodyText(write.body);
    // The body is sent as the JSON the form produced, read back off the stored
    // text: a money field survives byte for byte because nothing interprets it.
    const body = write.body === undefined ? undefined : JSON.parse(text as string);
    // A delete's answer is the row's absence, which an empty body carries; every
    // other write answers with the row it left behind, validated as always.
    const validate = write.kind === "delete" ? (value: unknown) => value : row.parse;
    return api.request(
      WRITE_METHOD[write.kind],
      write.path,
      validate,
      body,
      key === undefined ? undefined : { idempotencyKey: key },
    );
  }

  async function publish(scope: Scope | undefined): Promise<void> {
    if (listeners.size === 0) return;
    const items = scope === undefined ? [] : await store.list(scope);
    for (const listener of [...listeners]) listener(items);
  }

  /** apply is what an answer does to a claimed row — the one place the transition table is consulted. */
  async function apply(scope: Scope, item: PendingWrite, outcome: SendOutcome, error?: unknown) {
    const at = now();
    if (outcome === "sent") {
      await store.drop(scope, item.id);
      deps.notice?.(item.resourceKey);
      return;
    }
    const to: "queued" | "refused" | "unknown" =
      outcome === "refused"
        ? "refused"
        : outcome === "unreachable" || outcome === "waiting"
          ? "queued"
          : "unknown";
    if (!canMove(item.state, to))
      throw new Error(`A held write cannot move from ${item.state} to ${to}.`);
    if (outcome === "unreachable") {
      // The network never took the request, so it never went on a wire: the
      // attempt the claim counted comes back off, and the row is queued again.
      await store.release(scope, item.id, at);
    } else {
      await store.settle(
        scope,
        item.id,
        to,
        at,
        outcome === "refused" ? refusalOf(error) : undefined,
      );
    }
  }

  /**
   * pass drains this scope from the head until the queue has nothing it may pick
   * up by itself. It runs on the lane, so nothing else is sending while it is,
   * and it never runs twice at once: a reachability event during a pass joins the
   * lane behind it and finds the queue already emptied or the network still dead.
   */
  async function pass(force: boolean): Promise<void> {
    const scope = current();
    // Nobody signed in, or the device says it is not reaching anything and
    // nobody pressed a button: nothing leaves, and nothing is lost.
    if (!scope) return;
    if (deps.reached?.() === false && !force) return;
    for (;;) {
      const scopeNow = current();
      // A sign-out mid-pass: this pass claims nothing further.
      if (!scopeNow || scopeNow.userId !== scope.userId || scopeNow.server !== scope.server) return;
      const next = await store.next(scopeNow);
      if (!next) return;
      const claimed = await store.claim(scopeNow, next.id, now());
      if (!claimed) return;
      const stopped = [deps.may?.(claimed), unreadableBody(claimed)].find(
        (reason) => reason !== undefined,
      );
      if (stopped) {
        await store.settle(scopeNow, claimed.id, "refused", now(), {
          status: 0,
          detail: stopped,
          fields: {},
        });
        await publish(scopeNow);
        continue;
      }
      let error: unknown;
      let outcome: SendOutcome = "sent";
      try {
        await send(replayed(claimed), claimed.id);
      } catch (e) {
        error = e;
        outcome = outcomeOf(e);
      }
      await apply(scopeNow, claimed, outcome, error);
      await publish(scopeNow);
      // A transport that will not take a request, and a server that is
      // there and unhappy, both end this pass: carrying on would spend the
      // deadline on every remaining item over the same dead network.
      if (outcome !== "sent" && outcome !== "refused") return;
    }
  }

  /** askDrain gives the queue its turn after the effect that asks has finished, without making that effect wait for what the queue holds. */
  function askDrain(force: boolean): void {
    void ordered(() => pass(force));
  }

  async function hold(write: NewWrite, key: string): Promise<PendingWrite> {
    const scope = current();
    if (!scope) throw new Error("Nothing is held without a sign-in to hold it for.");
    const item = heldWrite(write, key, now());
    await store.append(scope, item);
    await publish(scope);
    return item;
  }

  /**
   * owedAhead answers the held write a write made now would cut past: an older row
   * of this scope for the same record that could still go out later. It is asked
   * after the pre-submit pass, so a queue that pass emptied answers nothing and the
   * write goes on the wire as it did before the queue existed.
   */
  async function owedAhead(write: NewWrite): Promise<PendingWrite | undefined> {
    const scope = current();
    return scope === undefined ? undefined : overtakenBy(write, await store.list(scope));
  }

  return {
    open: () => ordered(() => store.open()),

    scopeOf: scopeOf,

    submit: <T>(write: NewWrite, live?: (key: string) => Promise<T>) =>
      ordered(async () => {
        const text = bodyText(write.body);
        const tooLarge = bodyRefusal(text);
        if (tooLarge) throw new RangeError(tooLarge);
        // The key is minted before the first attempt, not when the write is held.
        // An attempt the transport refused may still have reached the server, and
        // a server honouring the key can only match a replay to it if the attempt
        // that may have landed carried the same one. The row keeps it as its id.
        const key = deps.mint();
        const badKey = keyRefusal(key);
        if (badKey) throw new TypeError(badKey);
        const attempt = live ?? (() => send(write, key) as Promise<T>);
        if (deps.reached?.() === false)
          return { sent: false as const, item: await hold(write, key) };
        // Everything the queue holds was said before this write was, so it goes
        // first: a held PATCH the phone still owes about this same row is the
        // older statement of the two, and one that lands on top of the answer
        // below takes the person's newest edit off the record. The pass stops at
        // the first write the network will not take, so a dead network costs this
        // call one attempt rather than a queue's worth of waiting.
        await pass(true);
        // A pass that stopped left what it could not send on the device, and the
        // person's next edit may not go past it: the older row is the earlier
        // statement about this record, and once it is retried it lands on top of
        // whatever this call wrote, which is the newer edit taken off the record
        // with nothing left on the phone to put it back. So the write joins the
        // queue behind that row and waits for its turn with the rest of them.
        if (await owedAhead(write)) return { sent: false as const, item: await hold(write, key) };
        try {
          const landed = { sent: true as const, row: await attempt(key) };
          // A write the server just answered is the best proof there is that the
          // network is back: whatever the device's own hint says, the held ones
          // go now. It is the queue that runs them, not this call: the drain asks
          // for its own turn rather than being waited for here, so the answer the
          // person is waiting for is never delayed by what the queue sends after
          // it.
          askDrain(true);
          return landed;
        } catch (error) {
          // Only a network that never took the request puts it in the queue.
          // A 4xx is the server's answer to this write and belongs on the form
          // that made it; anything already sent is never queued for resend.
          if (outcomeOf(error) !== "unreachable" || !current()) throw error;
          return { sent: false as const, item: await hold(write, key) };
        }
      }),

    list: () =>
      ordered(async () => {
        const scope = current();
        return scope === undefined ? [] : await store.list(scope);
      }),

    // Whose the pressed row is gets settled at the press, from this scope's own
    // rows, before the lane is asked for. It cannot wait: the drain this Retry
    // queues behind may well send that row on its own way — the queue sends from
    // the head in append order, and the older write goes first — and by the time
    // this Retry is allowed to speak the row is gone from a queue that kept its
    // promise. A row this scope never listed is another sign-in's and is refused;
    // one that was listed and has gone went. The read names no change, so it is
    // the one thing this unit asks its store off the lane.
    retry: async (id) => {
      const scope = current();
      if (!scope) throw new Error("Nothing can be sent without a sign-in to send it for.");
      if (!(await store.list(scope)).some((r) => r.id === id))
        throw new Error("That write belongs to another sign-in.");
      return ordered(async () => {
        const mine = current();
        if (!mine) throw new Error("Nothing can be sent without a sign-in to send it for.");
        // The press says "get this write to the server", not "send this row
        // next": an older held write of the same record goes first, so the queue
        // runs from its head and takes the pressed row when its turn comes.
        const ahead = await store.list(mine);
        const pressed = ahead.find((row) => row.id === id);
        if (pressed && overtakenBy(pressed, ahead, id)) {
          await pass(true);
          return await store.list(mine);
        }
        const claimed = await store.claim(mine, id, now());
        if (!claimed) {
          // Nothing moved: the row is on a wire a pass claimed, or the pass that
          // ran ahead of this Retry sent it and the queue dropped its row. Either
          // way the rows read above are the answer — nothing moved since — and a
          // second send is exactly what must not happen.
          return ahead;
        }
        const stopped = [deps.may?.(claimed), unreadableBody(claimed)].find(
          (reason) => reason !== undefined,
        );
        let outcome: SendOutcome;
        let error: unknown;
        if (stopped) {
          outcome = "refused";
          error = new ApiError(0, stopped);
        } else {
          try {
            await send(replayed(claimed), claimed.id);
            outcome = "sent";
          } catch (e) {
            outcome = outcomeOf(e);
            error = e;
          }
        }
        await apply(mine, claimed, outcome, error);
        const after = await store.list(mine);
        await publish(mine);
        // The server's reason on a refused write is the answer, not a failure
        // of the queue: the row shows it and the person decides.
        if (outcome === "refused" || outcome === "unreadable") return after;
        if (outcome !== "sent") throw error;
        askDrain(true);
        return after;
      });
    },

    discard: (id) =>
      ordered(async () => {
        const scope = current();
        if (!scope) return false;
        // A write on its way cannot be taken back: the request is already on a
        // wire and its answer will move the row whichever way the person feels
        // about it now, so discarding it here would leave a row that answers to
        // nothing. The row says so while it is busy.
        const row = (await store.list(scope)).find((r) => r.id === id);
        if (row?.state === "sending") return false;
        const gone = await store.drop(scope, id);
        await publish(scope);
        if (gone) askDrain(true);
        return gone;
      }),

    drain: ({ force = false } = {}) =>
      ordered(async () => {
        await pass(force);
      }),

    clear: () =>
      ordered(async () => {
        const scope = current();
        if (!scope) return;
        await store.clear(scope);
        await publish(scope);
      }),

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
