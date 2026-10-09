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
import type { Remembered, Who } from "./core/reentry";
import { samePerson, who as whoOf } from "./core/reentry";
import { TIMEOUT, createApi, type Api, type Identity } from "./effects/api";
import { sessions } from "./effects/native-session";
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
  /** where the person standing in front of the app is; every route file says so as it draws. */
  readonly saw: (href: string) => void;
  /** what the person has typed into the sheet at this address, while the server refuses the
   * session that would have saved it. undefined for any other address — two sheets are two records. */
  readonly typed: (href: string) => Readonly<Record<string, string>> | undefined;
  /** what a sheet holds right now; an empty record means this sheet is finished with. */
  readonly keep: (href: string, values: Readonly<Record<string, string>>) => void;
  /** where a re-authentication returns to and what to prefill: set when the server refuses a
   * session this app was using, cleared when the app learns that whoever signs in now is not
   * that person, or when a sign-in starts that is not a re-authentication at all. */
  readonly returning: Remembered | undefined;
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

export function Shell({ baseURL: initialURL, renderers, children }: Props) {
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
  // The person a remembered route and a held sheet belong to, waiting to be
  // compared with whoever the next completed sign-in turns out to be.
  const expected = useRef<Who | undefined>(undefined);
  const remembered = useRef<Remembered | undefined>(undefined);
  const generation = useRef(0);
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
    remember(undefined);
  }, [remember]);
  const saw = useCallback((href: string) => {
    where.current = href;
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
  /** transport is a server's transport, with the one thing this shell asks of it: a refusal
   * comes back here. Every call site that holds a session builds it through this. */
  const transport = useCallback(
    (url: string, cookie?: string) => {
      const a: Api = createApi(url, undefined, cookie, TIMEOUT, () => refusedBy(a));
      return a;
    },
    [refusedBy],
  );
  // What the app is connected to before it has read anything: the configured
  // server and a transport holding no cookie, so it can ask nothing and has no
  // session to lose. Boot replaces it — through `transport` — before any request.
  const [connection, setConnection] = useState(() => ({
    api: createApi(initialURL),
    baseURL: initialURL,
  }));
  const active = useRef(connection);
  const { api, baseURL } = connection;

  const connect = useCallback((url: string, next: Api) => {
    const value = { api: next, baseURL: url };
    active.current = value;
    setConnection(value);
  }, []);

  const load = useCallback(
    async (a: Api, started: number) => {
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
        if (generation.current === started) {
          // A session this app could not open is not a live one: a refusal it
          // answers afterwards describes nothing, and the sentence the person is
          // offered stays the one about the saved sign-in. What the last person
          // was doing stays held — a load that failed on a bad network answer
          // neither identifies whoever it was nor ends their attempt.
          live.current = undefined;
          dispatch({ type: "failed", generation: started, error: catalogFailure(e) || message(e) });
        }
      }
    },
    [forget],
  );

  useEffect(() => {
    const started = begin();
    (async () => {
      try {
        const session = await sessions.load();
        if (generation.current !== started) return;
        const url = session?.baseURL ?? active.current.baseURL;
        // The default transport; only the restored cookie is this call's business.
        const a = transport(url, session?.cookie);
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
      returning,
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
        live.current = undefined;
        // Signing out is the person ending the session themselves, so nobody is
        // coming back to the address a refusal left behind: it goes now, rather
        // than waiting to be handed to whoever signs in next.
        forget();
        connect(previous.baseURL, transport(previous.baseURL));
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
    [
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
      returning,
      begin,
      connect,
      load,
      forget,
      transport,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
