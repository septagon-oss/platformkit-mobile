// shell.tsx is the composition root's context: one API, one lifecycle state,
// one renderer pack. It is the only place an effect turns into an event.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { Entry } from "./core/catalog";
import { initial, reduce, type State } from "./core/state";
import { createApi, type Api } from "./effects/api";
import { clearSession, loadSession, saveSession } from "./effects/session";
import type { Renderers } from "./renderers";

export interface ShellValue {
  readonly api: Api;
  readonly baseURL: string;
  readonly state: State;
  readonly renderers: Renderers;
  readonly entry: (module: string, entity: string) => Entry | undefined;
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
  const [api, setApi] = useState<Api>(() => createApi(initialURL));
  const [baseURL, setBaseURL] = useState(initialURL);

  const load = useCallback(
    async (a: Api) => {
      dispatch({ type: "session" });
      try {
        dispatch({ type: "catalog", catalog: await a.catalog() });
      } catch (e) {
        dispatch({ type: "failed", error: message(e) });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    let live = true;
    (async () => {
      let session;
      try {
        session = await loadSession();
      } catch {
        session = undefined; // no secure store here (the web); start anonymous
      }
      if (!live) return;
      if (!session?.cookie) {
        dispatch({ type: "no-session" });
        return;
      }
      const a = createApi(session.baseURL, fetch, session.cookie);
      setApi(a);
      setBaseURL(session.baseURL);
      await load(a);
    })();
    return () => {
      live = false;
    };
  }, [load]);

  const value = useMemo<ShellValue>(
    () => ({
      api,
      baseURL,
      state,
      renderers,
      entry: (module, entity) =>
        state.catalog?.resources.find((r) => r.module === module && r.entity === entity),
      async signIn(url, email, password) {
        const a = createApi(url);
        await a.login(email, password);
        setApi(a);
        setBaseURL(url);
        try {
          const cookie = a.cookie();
          await saveSession(cookie ? { baseURL: url, cookie } : { baseURL: url });
        } catch {
          // the web has no secure store; the session lives for this tab
        }
        await load(a);
      },
      async signOut() {
        try {
          await api.logout();
        } catch {
          // a refused logout still forgets the cookie; see Api.logout
        }
        try {
          await clearSession();
        } catch {
          // no secure store here
        }
        dispatch({ type: "signed-out" });
      },
      refresh: () => load(api),
    }),
    [api, baseURL, state, renderers, load],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
