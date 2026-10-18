// shell.tsx is the composition root's context: one API, one lifecycle state,
// one renderer pack. It is the only place an effect turns into an event.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { clearNativeImageMemory } from "./screens/NativeImage";
import type { Entry } from "./core/catalog";
import { initial, reduce, type State } from "./core/state";
import type { Remembered, Who } from "./core/reentry";
import { samePerson, who as whoOf } from "./core/reentry";
import type { PendingWrite } from "./core/outbox";
import { heldScope } from "./core/outbox";
import type { Clock } from "./core/presentation";
import { kitEnglish } from "./core/kitCopy";
import { expiredCredential } from "./core/signInOutcome";
import type { DeclaredPermission } from "./core/scopes";
import {
  KEY_NAME,
  TIMEOUT,
  createApi,
  type Api,
  type Bearer,
  type Identity,
  type SignInStep,
} from "./effects/api";
import type { Session as Saved } from "./effects/session";
import { createOutbox, type Outbox, type OutboxStore } from "./effects/outbox";
import { createReadCache, type ReadCache, type ReadStore } from "./effects/read-cache";
import { sessions } from "./effects/native-session";
import type { Reach } from "./effects/native-reach";
import { systemClock } from "./screens/clock";
import type { Renderers } from "./renderers";
import { catalogFailure } from "./screens/failure";

export interface ShellValue {
  readonly api: Api;
  readonly baseURL: string;
  readonly state: State;
  readonly renderers: Renderers;
  /** who this session belongs to, once the server has said. */
  readonly identity: Identity | undefined;
  readonly entry: (module: string, entity: string) => Entry | undefined;
  /** writes counts what this app wrote to each resource ("module/entity"), so a screen knows whether what it shows is stale. */
  readonly writes: Readonly<Record<string, number>>;
  readonly wrote: (key: string) => void;
  /** outbox is what this phone still owes the server, or nothing where no store was supplied. */
  readonly outbox: OutboxValue | undefined;
  /** reads answers an unreachable read from the last response this phone got. */
  readonly reads: ReadCache | undefined;
  /** where the person standing in front of the app is; every route file says so as it draws. */
  readonly saw: (href: string) => void;
  /** what the person has typed into the sheet at this address, while the server refuses the
   * session that would have saved it. undefined for any other address — two sheets are two records. */
  readonly typed: (href: string) => Readonly<Record<string, string>> | undefined;
  /** what a sheet holds right now; an empty record means this sheet is finished with. */
  readonly keep: (href: string, values: Readonly<Record<string, string>>) => void;
  /** say files the sentence a write said for the address the person lands on: the sheet
   * that wrote is leaving, so it cannot draw the sentence itself. */
  readonly say: (href: string, sentence: string) => void;
  /** heard reads that sentence once, and it is gone: a record says what its write did
   * once, not on every visit afterwards. */
  readonly heard: (href: string) => string;
  /** where a re-authentication returns to and what to prefill: set when the server refuses a
   * session this app was using, cleared when the app learns that whoever signs in now is not
   * that person, or when a sign-in starts that is not a re-authentication at all. */
  readonly returning: Remembered | undefined;
  /**
   * signIn offers the password and says which step is next: the key arrived, or
   * the server wants a code about the address it was given. Nothing is returned
   * when a later attempt owns the session by the time this one was answered.
   */
  readonly signIn: (
    baseURL: string,
    email: string,
    password: string,
  ) => Promise<SignInStep | undefined>;
  /**
   * answerFactor spends the code the person typed at the server that refused to
   * finish signing in, which is the only one holding the window it spends. A
   * refused one leaves the step open; a code with no challenge open on this phone
   * is refused here, before any request leaves.
   */
  readonly answerFactor: (email: string, code: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly refresh: () => Promise<void>;
}

const Context = createContext<ShellValue | undefined>(undefined);

export function useShell(): ShellValue {
  const v = useContext(Context);
  if (!v) throw new Error("useShell: no <Shell> above this component");
  return v;
}

/**
 * OutboxValue is the queue as a screen sees it: the writes this phone is holding
 * and the acts a person may take on one. A screen never reads the store.
 */
export interface OutboxValue {
  readonly items: readonly PendingWrite[];
  readonly submit: Outbox["submit"];
  readonly retry: (id: string) => Promise<void>;
  readonly discard: (id: string) => Promise<void>;
  readonly drain: Outbox["drain"];
}

interface Props {
  readonly baseURL: string;
  readonly renderers: Renderers;
  /**
   * store is the device's two tables, supplied by the composition root; the kit
   * opens no database of its own, so a host without one (a test, a web build)
   * simply has no queue and no cache, and every write behaves as it did.
   */
  readonly store?: { readonly outbox: OutboxStore; readonly reads: ReadStore };
  /** clock is what stamps a held write; the queue's order never comes from it. */
  readonly clock?: Clock;
  /** mint names an idempotency key: expo-crypto's randomUUID on a device. */
  readonly mint?: () => string;
  /**
   * reach is the device's own network listener. It is a trigger and a hint and
   * never an authority: it delays a pass and says when a pass is worth starting,
   * and the queue's authority stays whether a request reached the server.
   */
  readonly reach?: Reach;
  readonly children: React.ReactNode;
  /**
   * tokenName is what this app calls its own key on the server's list of keys.
   * The mint reads it and nothing else does; the kit's own word is "This phone".
   */
  readonly tokenName?: string;
  /**
   * declaredGrants is the permission catalogue this app's key is minted out of: an
   * app whose modules name permissions the pinned document does not print passes
   * their catalogue, and a wildcard holder is narrowed to it rather than to the
   * kit's own surface. Like tokenName the mint reads it and nothing else does — a
   * key read back out of storage mints nothing — and left out it is the catalogue
   * the document prints, which is this kit's surface and no other.
   */
  readonly declaredGrants?: readonly DeclaredPermission[];
}

/** Session is the one this app is using, as the transport knows it: which address
 * its cookie belongs to, who that server said it is, and the email it was made for.
 * Nothing renders it — it exists so a refusal can be attributed to a person, and so
 * a refusal from any other transport can be recognised as describing no session. */
interface Session {
  readonly api: Api;
  readonly baseURL: string;
  readonly who: Who | undefined;
  readonly email: string;
}

/** Sheet is what a person has typed into one address and not yet saved. */
interface Sheet {
  readonly href: string;
  readonly values: Readonly<Record<string, string>>;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * refuseMint is the absence of a key maker, said at the first held write rather
 * than as a key that could repeat: a duplicate Idempotency-Key is worse than no
 * key at all, so the composition root names one (expo-crypto's randomUUID).
 */
function refuseMint(): string {
  throw new Error("A device store needs Shell's mint prop: the maker of an idempotency key.");
}

/**
 * heldKey is the key a saved record carries, or nothing when it names a server
 * alone. Half a key never reaches here: the record that carries one is refused
 * before the shell sees it (src/effects/session.ts).
 */
function heldKey(session: Saved | undefined): Bearer | undefined {
  return session?.token && session?.tokenId
    ? { token: session.token, id: session.tokenId }
    : undefined;
}

export function Shell({
  baseURL: initialURL,
  renderers,
  store,
  clock,
  mint,
  reach,
  children,
  tokenName = KEY_NAME,
  declaredGrants,
}: Props) {
  const [state, dispatch] = useReducer(reduce, initial);
  // What this app was doing when the server refused it, in holders with one writer
  // each: where the person is (`saw`, reported by every route), which session is live
  // (`live`, set when a load reaches ready and cleared the moment it stops being one),
  // what the person last typed (`keep`/`typed`, one sheet, keyed by its own address),
  // who that was (`expected`), and what is remembered for them (`remembered`, drawn
  // from `returning`). The rule that compares them is in `src/core/reentry.ts`; this
  // file is only where the rule meets an effect.
  const where = useRef<string | undefined>(undefined);
  const live = useRef<Session | undefined>(undefined);
  const sheet = useRef<Sheet | undefined>(undefined);
  // The one sentence a write said, filed by the address it was said for. One slot,
  // because one write lands on one record, and the writer names where the person goes.
  const sentence = useRef<{ href: string; text: string } | undefined>(undefined);
  // The person a remembered route and a held sheet belong to, waiting to be
  // compared with whoever the next completed sign-in turns out to be.
  const expected = useRef<Who | undefined>(undefined);
  const remembered = useRef<Remembered | undefined>(undefined);
  const generation = useRef(0);

  /**
   * challenge is the address that accepted a password and answered that it needs a
   * second factor. The window that refusal opened lives on that server's clock and in
   * no table this phone can read, so the code goes back to that address and to no
   * other: the address field is where the *next* sign-in goes, not where this one is
   * answered. Only the address survives the refusal — the connection that was refused
   * is not kept, because every answer makes its own connection and is the only holder
   * of the key that answer mints, which leaves an answer that lost the race nothing
   * to give back but its own. The address is held for one sign-in: until a key is
   * minted, a password is refused, this phone signs out, or a newer attempt opens a
   * window of its own.
   */
  const challenge = useRef<string | undefined>(undefined);
  const [identity, setIdentity] = useState<Identity | undefined>();
  const [returning, setReturning] = useState<Remembered | undefined>();
  const [writes, setWrites] = useState<Readonly<Record<string, number>>>({});
  const wrote = useCallback(
    (key: string) => setWrites((w) => ({ ...w, [key]: (w[key] ?? 0) + 1 })),
    [],
  );
  const begin = useCallback(() => ++generation.current, []);
  // One setter for both holders of what was remembered: the ref is what a
  // callback reads without waiting for a render, the state is what the sign-in
  // screen draws.
  const remember = useCallback((next: Remembered | undefined) => {
    remembered.current = next;
    setReturning(next);
  }, []);
  // forget is the one way what a refused session left behind goes away: who it
  // belonged to, the sheet that was never saved, and the address to go back to.
  // Three things call it — a refusal of a session the server never identified, a
  // sign-in that turns out to be somebody else, and a sign-out, which is the
  // person saying nobody is coming back to that address. Nothing else may drop
  // what a person was in the middle of doing.
  const forget = useCallback(() => {
    expected.current = undefined;
    sheet.current = undefined;
    sentence.current = undefined;
    remember(undefined);
  }, [remember]);
  const saw = useCallback((href: string) => {
    where.current = href;
  }, []);
  const say = useCallback((href: string, text: string) => {
    sentence.current = { href, text };
  }, []);
  const heard = useCallback((href: string) => {
    if (sentence.current?.href !== href) return "";
    const said = sentence.current.text;
    sentence.current = undefined;
    return said;
  }, []);
  const typed = useCallback(
    (href: string) => (sheet.current?.href === href ? sheet.current.values : undefined),
    [],
  );
  const keep = useCallback((href: string, values: Readonly<Record<string, string>>) => {
    // One sheet at a time, and it belongs to the address it was typed at.
    // An empty record says this sheet is finished with — saved, cancelled or
    // discarded — and a sheet elsewhere keeps what it holds.
    if (Object.keys(values).length === 0) {
      if (sheet.current?.href === href) sheet.current = undefined;
      return;
    }
    sheet.current = { href, values };
  }, []);

  /**
   * refusedBy is the shell's one answer to a 401, and the whole decision of
   * whether it ends a session. The order inside it is the rule: look at whose
   * session this was, forget that session, move the generation, then say so.
   * Clearing first is what makes the ask once — a second 401 from the same dead
   * session, and every 401 of a session this app stopped using, arrive to
   * nothing and are refused without writing, bumping or moving anybody.
   */
  const refusedBy = useCallback(
    (a: Api) => {
      const dead = live.current;
      if (dead === undefined || dead.api !== a) return;
      live.current = undefined;
      const at = where.current;
      if (dead.who === undefined || at === undefined) {
        // A session the server never identified — and a shell that never learned
        // where the person was — may not hand its text or its landing page to
        // whoever signs in next.
        forget();
      } else {
        expected.current = dead.who;
        remember({ href: at, who: dead.who, email: dead.email });
      }
      const started = begin();
      setIdentity(undefined);
      dispatch({ type: "expired", generation: started });
      // The cookie is dead: leaving it saved would have the next launch try it
      // again and call what it answers a sign-in that could not be opened.
      void sessions.clear(dead.baseURL).catch(() => undefined);
    },
    [begin, forget, remember],
  );
  /** transport is a server's transport, with the two things this shell asks of it: a
   * refusal comes back here, and the key it presents is the one this call names — the
   * held one, or none at all for a sign-in, which is a public door. Every call site that
   * reaches a server builds it through this, so one app speaks with one key name and one
   * grant catalogue. */
  const transport = useCallback(
    (url: string, key?: Bearer) => {
      const a: Api = createApi(url, undefined, key, TIMEOUT, tokenName, declaredGrants, () =>
        refusedBy(a),
      );
      return a;
    },
    [refusedBy, tokenName, declaredGrants],
  );
  // What the app is connected to before it has read anything: the configured
  // server and a transport holding no key, so it can ask nothing and has no
  // session to lose. Boot replaces it — through `transport` — before any request.
  const [connection, setConnection] = useState(() => ({
    api: createApi(initialURL),
    baseURL: initialURL,
  }));
  const active = useRef(connection);
  const { api, baseURL } = connection;
  useEffect(
    () => () => {
      void clearNativeImageMemory();
    },
    [api, state.generation, state.catalog],
  );

  // The queue belongs to the person the server named and the origin the Api
  // talks to: an unsigned phone holds nothing for whoever signs in next.
  const [held, setHeld] = useState<readonly PendingWrite[]>([]);
  // The catalog is read through a ref: what the server mounts decides whether a
  // held command may go back on a wire, but a catalog refresh is no reason to
  // build a second queue with a single-flight flag of its own, which is what a
  // dependency on it would do.
  const mountedCatalog = useRef(state.catalog);
  useEffect(() => {
    mountedCatalog.current = state.catalog;
  }, [state.catalog]);
  // Who the queue and the cache belong to: the sign-in's own id, not the object
  // that names it, which a refresh replaces while the queue is mid-pass.
  const userId = identity?.userId;
  const outbox = useMemo(
    () =>
      store && userId
        ? createOutbox({
            store: store.outbox,
            api,
            clock: clock ?? systemClock,
            mint: mint ?? refuseMint,
            // One owner for what a scope is: a server saved with a trailing
            // slash is the same server, and heldScope says so the way createApi
            // normalises it. An address or a sign-in it cannot name holds
            // nothing, which is the honest answer rather than a silent no.
            scope: () => heldScope(baseURL, userId),
            notice: wrote,
            // may is this composition's own rule, read again before a held verb
            // goes back on a wire: the catalog is the authority on what the
            // server mounts, and a resource that left it has no address to send to.
            may: (item) =>
              mountedCatalog.current === undefined ||
              mountedCatalog.current.resources.some(
                (r) => `${r.module}/${r.entity}` === item.resourceKey,
              )
                ? undefined
                : "This resource is no longer offered by the server.",
            ...(reach ? { reached: () => reach.up() } : {}),
          })
        : undefined,
    // A refresh asks who this is again, and the answer is a new object naming the
    // same person. The queue belongs to that person, so it is keyed by the id that
    // names them: rebuilding it on every identity would start a second queue with a
    // single-flight flag of its own, and the next held write would go before the
    // first had been answered.
    [store, api, baseURL, userId, clock, mint, reach, wrote],
  );
  const reads = useMemo(
    () =>
      store && userId
        ? createReadCache({
            store: store.reads,
            clock: clock ?? systemClock,
            // The same rule the queue asks, so one owner decides what a scope is:
            // a server saved or typed with a trailing slash is the same server, and
            // answers kept for it are found by the page that asks again tomorrow.
            scope: () => heldScope(baseURL, userId),
          })
        : undefined,
    [store, baseURL, userId, clock],
  );

  useEffect(() => {
    if (!outbox) return;
    // `mounted` is this effect's own, and says what `live` above — the session the
    // transport may still answer for — never means: whether the screen that asked
    // for the queue is still here to be told what it holds.
    let mounted = true;
    void (async () => {
      await outbox.open();
      if (!mounted) return;
      setHeld(await outbox.list());
      // A phone that starts with work owed sends it as soon as it can say who it
      // is: the queue was waiting for the sign-in, not for a button.
      void outbox.drain();
    })();
    const stop = outbox.subscribe((next) => {
      if (mounted) setHeld(next);
    });
    return () => {
      mounted = false;
      stop();
    };
  }, [outbox]);

  useEffect(() => {
    // The device says the network came back: that is the moment the queue was
    // written for, and nobody has to find the row and press Retry for it.
    if (!outbox || !reach) return;
    return reach.subscribe((up) => {
      if (up) void outbox.drain();
    });
  }, [outbox, reach]);

  const outboxValue = useMemo<OutboxValue | undefined>(
    () =>
      outbox && {
        // A phone with no queue holds nothing, whoever's rows a previous render
        // was shown: what is on screen belongs to the person the queue is scoped to.
        items: outbox ? held : [],
        submit: outbox.submit,
        drain: outbox.drain,
        retry: async (id) => {
          await outbox.retry(id);
        },
        discard: async (id) => {
          await outbox.discard(id);
        },
      },
    [outbox, held],
  );

  const connect = useCallback((url: string, next: Api) => {
    const value = { api: next, baseURL: url };
    active.current = value;
    setConnection(value);
  }, []);

  const load = useCallback(
    async (a: Api, started: number, url: string) => {
      if (generation.current !== started) return;
      dispatch({ type: "session", generation: started });
      try {
        // Observe both responses together. A malformed identity fails this load
        // in either arrival order, and neither request may reject unobserved.
        const me = a.me().then((who) => {
          if (generation.current === started) setIdentity(who);
          return who;
        });
        const [answered, catalog] = await Promise.all([me, a.catalog()]);
        if (generation.current === started) {
          const server = active.current.baseURL;
          const next = whoOf(server, answered?.userId);
          // Between the identity arriving and this catalogue becoming ready sits the
          // one comparison: what the last person left behind — where they stood, what
          // they typed, what this app counted — survives only a sign-in that is
          // provably the same person. Before the dispatch, so no render of the new
          // session ever shows the old one's counts, landing page or draft.
          const waiting = expected.current;
          if (waiting !== undefined && !samePerson(waiting, next)) {
            forget();
            setWrites({});
          } else {
            expected.current = undefined;
          }
          live.current = { api: a, baseURL: server, who: next, email: answered?.email ?? "" };
          dispatch({ type: "catalog", generation: started, catalog });
        }
      } catch (e) {
        if (generation.current !== started) return;
        // A session this app could not open is not a live one: a refusal it
        // answers afterwards describes nothing, and the sentence the person is
        // offered stays the one about the saved sign-in. What the last person
        // was doing stays held — a load that failed on a bad network answer
        // neither identifies whoever it was nor ends their attempt.
        live.current = undefined;
        if (expiredCredential(e)) {
          // The server does not know this key — revoked from the account's devices,
          // spent, or older than the lifetime its mint gave it. A key the kernel
          // will not name has nothing to revoke in answer to it and nothing left to
          // remove, so the phone drops the connection that carries it, forgets it
          // here, and says what happened on the way back to the form with the
          // server still filled in. Signing in again is the only way out, and no
          // screen or renderer is told to work that out for itself.
          setIdentity(undefined);
          connect(url, createApi(url));
          dispatch({ type: "no-session", generation: started, error: kitEnglish.sessionExpired });
          void sessions.clear(url).catch(() => undefined);
          return;
        }
        dispatch({ type: "failed", generation: started, error: catalogFailure(e) || message(e) });
      }
    },
    [connect, forget],
  );

  useEffect(() => {
    const started = begin();
    (async () => {
      try {
        const session = await sessions.load();
        if (generation.current !== started) return;
        const url = session?.baseURL ?? active.current.baseURL;
        // The default transport; only the restored key is this call's business.
        const a = transport(url, heldKey(session));
        connect(url, a);
        if (heldKey(session)) await load(a, started, url);
        else dispatch({ type: "no-session", generation: started });
      } catch {
        if (generation.current === started)
          dispatch({
            type: "no-session",
            generation: started,
            error: "The saved sign-in could not be read. Clear it or sign in again.",
          });
      }
    })();
    return () => {
      begin();
    };
  }, [begin, connect, load, transport]);

  const value = useMemo<ShellValue>(
    () => ({
      api,
      baseURL,
      state,
      renderers,
      identity,
      writes,
      wrote,
      saw,
      typed,
      keep,
      say,
      heard,
      returning,
      outbox: outboxValue,
      reads,
      entry: (module, entity) =>
        state.catalog?.resources.find((r) => r.module === module && r.entity === entity),
      async signIn(url, email, password) {
        const started = begin();
        // Identity belongs to the previous session until this sign-in starts.
        // The new catalog may be ready before its own identity request settles.
        setIdentity(undefined);
        // A sign-in is a new session: whoever held one before this is not live.
        live.current = undefined;
        // A sign-in the shell holds nothing for has no route to return to and
        // starts fresh. What it holds — and therefore whether this is a
        // re-authentication — is answered by the holder, not by the phase: an
        // attempt the server refused ends as plain `anonymous` with no `reason`,
        // and a person who mistypes a password is still in the middle of coming
        // back in, not at the start of it. The comparison in `load` is what
        // decides whether whoever completes this sign-in is the person the held
        // sheet belongs to; until then it is kept, and it is kept for nobody
        // else, because `expected` is set only by a refusal of a named session.
        if (expected.current === undefined) forget();
        dispatch({ type: "sign-in", generation: started });
        const a = transport(url);
        try {
          const answer = await a.signIn(email, password);
          if (answer.kind === "factor-required") {
            // Nothing was minted and nothing is kept: the window the server
            // opened belongs to its clock, and the code step is the screen's,
            // not a phase of the session. What this phone does hold is the
            // refusal itself — the answer to a code spends a window only the
            // server that refused can open. An attempt that lost the race opens
            // no window here and hands back nothing: a code step drawn over the
            // winner's session could only be refused.
            if (generation.current !== started) return undefined;
            challenge.current = url;
            dispatch({ type: "no-session", generation: started });
            return answer;
          }
          if (generation.current !== started) {
            // A key this attempt learned after it lost the race is one nobody
            // holds and no screen can name: take it back rather than leave a
            // live credential behind.
            void a.logout().catch(() => undefined);
            return undefined;
          }
          // This password was the whole answer, so no window is open anywhere.
          challenge.current = undefined;
          await sessions.save({
            baseURL: url,
            token: answer.bearer.token,
            tokenId: answer.bearer.id,
          });
          if (generation.current !== started) {
            void a.logout().catch(() => undefined);
            return undefined;
          }
          connect(url, a);
          await load(a, started, url);
          return { kind: "signed-in" };
        } catch (e) {
          void a.logout().catch(() => undefined);
          if (generation.current !== started) return undefined;
          // The last thing this phone did was not open a window, so the code step
          // has nothing left to answer and the person is back at the password.
          challenge.current = undefined;
          dispatch({ type: "no-session", generation: started });
          throw e;
        }
      },
      async answerFactor(email, code) {
        // Refused here, before a request: a code sent to a server that never
        // refused this person's password is a wrong code on somebody else's
        // tenant, and the person would read the refusal as their own mistake.
        const open = challenge.current;
        if (!open) throw new Error(kitEnglish.noChallenge);
        const started = begin();
        // The answer makes its own connection to the server that refused, with
        // this app's own name and grant catalogue, and is the only holder of what
        // it mints. Two answers to one refusal are then two attempts that share
        // nothing but the address: whichever arrives first owns its key, and the
        // clean-up of the other reaches only its own.
        const a = createApi(open, undefined, undefined, undefined, tokenName, declaredGrants);
        try {
          const key = await a.answerFactor(email, code);
          if (generation.current !== started) {
            void a.logout().catch(() => undefined);
            return;
          }
          // The key is the answer to the refusal; the refusal is spent with it.
          challenge.current = undefined;
          setIdentity(undefined);
          await sessions.save({ baseURL: open, token: key.token, tokenId: key.id });
          if (generation.current !== started) {
            void a.logout().catch(() => undefined);
            return;
          }
          connect(open, a);
          await load(a, started, open);
        } catch (e) {
          // A refused code mints nothing, and it does not close the window
          // either: the server spends the proof of the first factor with a
          // DELETE inside the sign-in's own transaction, so an answer it refuses
          // rolls that spend back and a mistyped digit costs only the mistyped
          // digit (modules/auth/internal/factors.go's RequireFirstFactorProof,
          // at the commit this build's document came from). The challenge stays
          // open on the address that earned it, and the step stays open too. Only
          // this answer's own connection is given back: a refusal that lands after
          // a newer answer was accepted is late by an ordinary amount of time, and
          // the key standing on the session by then belongs to that newer answer.
          void a.logout().catch(() => undefined);
          if (generation.current === started) dispatch({ type: "no-session", generation: started });
          throw e;
        }
      },
      async signOut() {
        const started = begin();
        const previous = active.current;
        live.current = undefined;
        // Signing out is the person ending the session themselves, so nobody is
        // coming back to the address a refusal left behind: it goes now, rather
        // than waiting to be handed to whoever signs in next.
        forget();
        // A window this phone walked away from is not one it comes back to.
        challenge.current = undefined;
        connect(previous.baseURL, transport(previous.baseURL));
        setIdentity(undefined);
        dispatch({ type: "signed-out", generation: started });
        // Signing out means two things, and the phone does the first on its own:
        // it forgets the key here, and it asks the server to stop it. Forgetting is
        // not waiting for the asking — that is the half that works offline, and on a
        // phone somebody is about to pick up. The asking is not swallowed either:
        // a key the server still answers to after this phone forgot it is a live
        // credential, and a signed-out screen that said nothing about it would let
        // the person believe it dead. The revoke is one of the few doors that can
        // honestly answer no: it stands at httpx.SignedIn(), which refuses a
        // credential carrying its own scopes (kit/httpx/authorize.go), so a key
        // restored from storage — which has no sign-in session behind it — cannot
        // spend itself.
        const stopped = previous.api.logout();
        // A person who chose to keep their held writes never reaches this line:
        // every door that leaves asks first (src/screens/useSignOut.ts).
        outbox?.clear();
        let cleared = true;
        try {
          await sessions.clear(previous.baseURL);
        } catch {
          cleared = false;
          if (generation.current === started)
            dispatch({
              type: "signed-out",
              generation: started,
              error:
                "The saved sign-in could not be cleared. Please try again before closing the app.",
            });
        }
        // A server that would not answer the ask about the key keeps its exception,
        // and the honest answer to "is my key still live" from a refusal to answer is
        // that it may be: the notice is owed, not swallowed. Nothing that failed after
        // the key was answered arrives here — logout has reported the key by then and
        // closes the session it minted that key with on its own terms (SignOut).
        const { live: keyMayLive } = await stopped.catch(() => ({ live: true }));
        // One notice slot: a phone that could not clear its own storage has that
        // to say first, and it is about the phone. A connection that held no key,
        // and a key the server refused as a caller it does not know, leave no key
        // standing, and no sentence about one is sent the person to their account.
        if (keyMayLive && cleared && generation.current === started)
          dispatch({
            type: "signed-out",
            generation: started,
            error: kitEnglish.keyNotStopped,
          });
      },
      refresh: () => {
        const current = active.current.api;
        if (!current.bearer()) return Promise.resolve();
        return load(current, begin(), active.current.baseURL);
      },
    }),
    [
      outbox,
      api,
      baseURL,
      state,
      renderers,
      identity,
      writes,
      wrote,
      saw,
      typed,
      keep,
      say,
      heard,
      returning,
      outboxValue,
      reads,
      begin,
      connect,
      load,
      forget,
      transport,
      tokenName,
      declaredGrants,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
