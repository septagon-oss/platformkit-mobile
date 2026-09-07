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
import { createApi, type Api, type Identity } from "./effects/api";
import { sessions } from "./effects/native-session";
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
  readonly signIn: (baseURL: string, email: string, password: string) => Promise<void>;
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
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function Shell({ baseURL: initialURL, renderers, children }: Props) {
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

  const load = useCallback(async (a: Api, started: number) => {
    if (generation.current !== started) return;
    dispatch({ type: "session", generation: started });
    try {
      // Who the session belongs to is asked for beside the catalog and is not
      // allowed to decide whether there is one: a trail that cannot say "you"
      // is still a trail.
      void a.me().then((who) => {
        if (generation.current === started) setIdentity(who);
      });
      const catalog = await a.catalog();
      if (generation.current === started)
        dispatch({ type: "catalog", generation: started, catalog });
    } catch (e) {
      if (generation.current === started)
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
        const a = createApi(url, fetch, session?.cookie);
        connect(url, a);
        if (session?.cookie) await load(a, started);
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
        dispatch({ type: "sign-in", generation: started });
        const a = createApi(url);
        try {
          await a.login(email, password);
          if (generation.current !== started) {
            void a.logout().catch(() => undefined);
            return;
          }
          const cookie = a.cookie();
          if (!cookie) throw new Error("The server did not return a session.");
          await sessions.save({ baseURL: url, cookie });
          if (generation.current !== started) {
            void a.logout().catch(() => undefined);
            return;
          }
          connect(url, a);
          await load(a, started);
        } catch (e) {
          void a.logout().catch(() => undefined);
          if (generation.current !== started) return;
          dispatch({ type: "no-session", generation: started });
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
        if (!current.cookie()) return Promise.resolve();
        return load(current, begin());
      },
    }),
    [api, baseURL, state, renderers, identity, writes, wrote, begin, connect, load],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
