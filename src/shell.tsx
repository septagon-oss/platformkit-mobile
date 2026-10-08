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
  /** answerFactor spends the code the person typed; a refused one leaves the step open. */
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
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

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

export function Shell({ baseURL: initialURL, renderers, children, tokenName = KEY_NAME }: Props) {
  const [state, dispatch] = useReducer(reduce, initial);
  const [connection, setConnection] = useState(() => ({
    api: createApi(initialURL),
    baseURL: initialURL,
  }));
  const active = useRef(connection);
  const generation = useRef(0);
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

  const load = useCallback(async (a: Api, started: number, url: string) => {
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
        // The server refused this key — revoked, spent, or older than its own
        // lifetime. There is nothing to revoke in answer to a 401 (the revoke
        // is a signed-in request of its own), so the phone forgets the key and
        // says what happened on the way back to the form, with the server
        // still filled in. Signing in again is the only way out, and no screen
        // or renderer is told to work that out for itself.
        setIdentity(undefined);
        dispatch({ type: "no-session", generation: started, error: kitEnglish.sessionExpired });
        void sessions.clear(url).catch(() => undefined);
        return;
      }
      dispatch({ type: "failed", generation: started, error: message(e) });
    }
  }, []);

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
        const a = createApi(url, undefined, undefined, undefined, tokenName);
        try {
          const answer = await a.signIn(email, password);
          if (answer.kind === "factor-required") {
            // Nothing was minted and nothing is kept: the five-minute window
            // the server opened belongs to its clock, and the code step is the
            // screen's, not a phase of the session.
            if (generation.current === started)
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
          dispatch({ type: "no-session", generation: started });
          throw e;
        }
      },
      async answerFactor(email, code) {
        const started = begin();
        const a = createApi(baseURL, undefined, undefined, undefined, tokenName);
        try {
          const key = await a.answerFactor(email, code);
          if (generation.current !== started) {
            void a.logout().catch(() => undefined);
            return;
          }
          setIdentity(undefined);
          await sessions.save({ baseURL, token: key.token, tokenId: key.id });
          if (generation.current !== started) {
            void a.logout().catch(() => undefined);
            return;
          }
          connect(baseURL, a);
          await load(a, started, baseURL);
        } catch (e) {
          // A refused code spends the window it came from and mints nothing.
          // The step stays open on the screen that asked; nothing is stored.
          void a.logout().catch(() => undefined);
          if (generation.current === started) dispatch({ type: "no-session", generation: started });
          throw e;
        }
      },
      async signOut() {
        const started = begin();
        const previous = active.current;
        connect(previous.baseURL, createApi(previous.baseURL));
        setIdentity(undefined);
        dispatch({ type: "signed-out", generation: started });
        // Revoke remotely when reachable; local clearing must not wait for it.
        void previous.api.logout().catch(() => undefined);
        try {
          await sessions.clear(previous.baseURL);
        } catch {
          if (generation.current === started)
            dispatch({
              type: "signed-out",
              generation: started,
              error:
                "The saved sign-in could not be cleared. Please try again before closing the app.",
            });
        }
      },
      refresh: () => {
        const current = active.current.api;
        if (!current.bearer()) return Promise.resolve();
        return load(current, begin(), active.current.baseURL);
      },
    }),
    [api, baseURL, state, renderers, identity, writes, wrote, begin, connect, load, tokenName],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
