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
import type { Entry } from "./core/catalog";
import { initial, reduce, type State } from "./core/state";
import { kitEnglish } from "./core/kitCopy";
import { expiredCredential } from "./core/signInOutcome";
import {
  createApi,
  KEY_NAME,
  type Api,
  type Bearer,
  type Identity,
  type SignInStep,
} from "./effects/api";
import { sessions } from "./effects/native-session";
import type { Session } from "./effects/session";
import type { DeclaredPermission } from "./core/scopes";
import type { Renderers } from "./renderers";

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

interface Props {
  readonly baseURL: string;
  readonly renderers: Renderers;
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

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * challenge is the address that accepted a password and answered that it needs a
 * second factor. The window that refusal opened lives on that server's clock and
 * in no table this phone can read, so the code goes back to that address and to
 * no other: the address field is where the *next* sign-in goes, not where this one
 * is answered. Only the address survives the refusal — the connection that was
 * refused is not kept, because every answer makes its own connection and is the
 * only holder of the key that answer mints. An answer that lost the race then has
 * nothing to give back but its own, and a key a newer answer earned is out of the
 * reach of anything the older one does. The address is held for one sign-in —
 * until a key is minted, a password is refused, this phone signs out, or a newer
 * attempt opens a window of its own.
 */

/**
 * held is the key a saved record carries, or nothing when it names a server
 * alone. Half a key never reaches here: the record that carries one is refused
 * before the shell sees it (src/effects/session.ts).
 */
function held(session: Session | undefined): Bearer | undefined {
  return session?.token && session?.tokenId
    ? { token: session.token, id: session.tokenId }
    : undefined;
}

export function Shell({
  baseURL: initialURL,
  renderers,
  children,
  tokenName = KEY_NAME,
  declaredGrants,
}: Props) {
  const [state, dispatch] = useReducer(reduce, initial);
  const [connection, setConnection] = useState(() => ({
    api: createApi(initialURL),
    baseURL: initialURL,
  }));
  const active = useRef(connection);
  const generation = useRef(0);
  const challenge = useRef<string | undefined>(undefined);
  const [identity, setIdentity] = useState<Identity | undefined>();
  const [writes, setWrites] = useState<Readonly<Record<string, number>>>({});
  const wrote = useCallback(
    (key: string) => setWrites((w) => ({ ...w, [key]: (w[key] ?? 0) + 1 })),
    [],
  );
  const { api, baseURL } = connection;
  const begin = useCallback(() => ++generation.current, []);

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
        const identity = a.me().then((who) => {
          if (generation.current === started) setIdentity(who);
        });
        const [, catalog] = await Promise.all([identity, a.catalog()]);
        if (generation.current === started) {
          dispatch({ type: "catalog", generation: started, catalog });
        }
      } catch (e) {
        if (generation.current !== started) return;
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
        dispatch({ type: "failed", generation: started, error: message(e) });
      }
    },
    [connect],
  );

  useEffect(() => {
    const started = begin();
    (async () => {
      try {
        const session = await sessions.load();
        if (generation.current !== started) return;
        const url = session?.baseURL ?? active.current.baseURL;
        // The default transport; only the restored key is this call's business.
        const a = createApi(url, undefined, held(session));
        connect(url, a);
        if (held(session)) await load(a, started, url);
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
  }, [begin, connect, load]);

  const value = useMemo<ShellValue>(
    () => ({
      api,
      baseURL,
      state,
      renderers,
      identity,
      writes,
      wrote,
      entry: (module, entity) =>
        state.catalog?.resources.find((r) => r.module === module && r.entity === entity),
      async signIn(url, email, password) {
        const started = begin();
        // Identity belongs to the previous session until this sign-in starts.
        // The new catalog may be ready before its own identity request settles.
        setIdentity(undefined);
        dispatch({ type: "sign-in", generation: started });
        const a = createApi(url, undefined, undefined, undefined, tokenName, declaredGrants);
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
        // A window this phone walked away from is not one it comes back to.
        challenge.current = undefined;
        connect(previous.baseURL, createApi(previous.baseURL));
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
        // A server this phone could not ask keeps its exception, and the honest
        // answer to "is my key still live" from a refusal to answer is that it
        // may be: the notice is owed, not swallowed.
        const { live } = await stopped.catch(() => ({ live: true }));
        // One notice slot: a phone that could not clear its own storage has that
        // to say first, and it is about the phone. A connection that held no key,
        // and a key the server refused as a caller it does not know, leave no key
        // standing, and no sentence about one is sent the person to their account.
        if (live && cleared && generation.current === started)
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
      api,
      baseURL,
      state,
      renderers,
      identity,
      writes,
      wrote,
      begin,
      connect,
      load,
      tokenName,
      declaredGrants,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
