// shell.tsx is the composition root's context: one API, one lifecycle state,
// one renderer pack. It is the only place an effect turns into an event.
import type { LayoutRectangle } from "react-native";
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
  ApiError,
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
import { createRecents, type Recents, type RecentsStore } from "./effects/recents";
import { createWorkspaces, type Workspaces, type WorkspaceStore } from "./effects/workspaces";
import { unknownWorkspace, workspaceOf, type Workspace } from "./core/workspace";
import { hostLabel } from "./core/derive";
import { sessions } from "./effects/native-session";
import type { Reach } from "./effects/native-reach";
import { PUSH_PLATFORM, type PushBridge } from "./screens/push";
import { systemClock } from "./screens/clock";
import type { MediaRenderers, Renderers } from "./renderers";
import { catalogFailure } from "./screens/failure";

export interface ShellValue {
  readonly api: Api;
  readonly baseURL: string;
  readonly state: State;
  readonly renderers: Renderers;
  /**
   * media is the native media this product supplied at composition — the pinch surface a
   * picture opens into and the motion a cover collapses with. Absent means the still record.
   */
  readonly media?: MediaRenderers | undefined;
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
  /**
   * recents is what this device remembers this person opened, or nothing where this build
   * ships no table for them. It is read by the screen that shows a person their own recent opens.
   */
  readonly recents: Recents | undefined;
  /**
   * workspaces is what this device remembers of the places it has seen a workspace answer
   * on, or nothing where this build ships no table for them. Name, host and mark only: a
   * remembered workspace fills an address and never signs anybody in.
   */
  readonly workspaces: Workspaces | undefined;
  /**
   * workspace is the face the address this shell is using answered for itself — its name,
   * colour and mark — or the one the connect step looked up. Never absent: with nothing
   * answered it is the host and nothing else, which is what keeps every screen drawing one
   * thing rather than handling "no workspace".
   */
  readonly workspace: Workspace;
  /**
   * lookUp reads what the workspace at an address says of itself, before anybody has a
   * session there, and wears it. It answers undefined for a server that answers nothing —
   * no workspace, no network, a body outside the document — and never throws at a form;
   * the address stays typed and the password still gets asked there.
   */
  readonly lookUp: (baseURL: string) => Promise<Workspace | undefined>;
  /** where the person standing in front of the app is; every route file says so as it draws. */
  readonly saw: (href: string) => void;
  /** what the person has typed into the sheet at this address, while the server refuses the
   * session that would have saved it. undefined for any other address — two sheets are two records. */
  readonly typed: (href: string) => Readonly<Record<string, string>> | undefined;
  /** what a sheet holds right now; an empty record means this sheet is finished with. */
  readonly keep: (href: string, values: Readonly<Record<string, string>>) => void;
  /** say files the sentence a write said for the address the person lands on: the sheet
   * that wrote is leaving, so it cannot draw the sentence itself. A sentence whose session
   * ended while the write was out files nothing — nobody coming back is owed nothing. */
  readonly say: (href: string, sentence: string) => void;
  /** heard reads that sentence once, and it is gone: a record says what its write did
   * once, not on every visit afterwards. */
  readonly heard: (href: string) => string;
  /**
   * report files what a write just did for the person standing where they are: the receipt of an
   * act that opened nothing, and so left no sheet to say it. A filing before the bar is spent
   * replaces the sentence — the newest act is what they need to read, and a queue would deliver a
   * receipt for something that already left the screen. A receipt whose own session ended before
   * the answer arrived files nothing: the person standing here did not do that act and does not
   * read words earned in somebody else's workspace.
   */
  readonly report: (sentence: string) => void;
  /** reporting reads the sentence still owed and the token that spends it. It reads, it does not clear. */
  readonly reporting: () => { readonly sentence: string; readonly token: number } | undefined;
  /** spent closes that filing and only that one: a timer kept by a replaced bar closes nothing. */
  readonly spent: (token: number) => void;
  /**
   * celebrate files that a write this phone made reached the record at this address, so that
   * record's own screen — the one holding the row to compare — can decide whether its state
   * actually crossed into one the entry calls finished. A filing says only that this phone wrote;
   * it files no row and no value, so it can carry nothing the person was not shown. Filing twice
   * for one address is filing once, and an address that has played its moment files nothing more.
   * A filing whose session ended before the write answered files nothing, for the same reason the
   * receipt does: the moment would play over a record this person never changed.
   */
  readonly celebrate: (href: string) => void;
  /** celebrating says whether this address is the one due its moment. It reads, it does not clear. */
  readonly celebrating: (href: string) => boolean;
  /** celebrated says the record looked: the filing is spent, whether or not anything crossed. */
  readonly celebrated: (href: string) => void;
  /**
   * surprised says the moment played over the record at this address, which is the only thing that
   * spends the record's one surprise per session. A filing whose read crossed nothing — a command
   * that left the state where it was, an edit to a field the entry does not read as finished —
   * leaves the record eligible for the write that does finish it.
   */
  readonly surprised: (href: string) => void;
  /**
   * travelTo files the frame of the thumbnail a person pressed, for the record address it opens
   * into, so the record can begin where the finger was. Only the frame travels, never a row.
   */
  readonly travelTo: (href: string, frame: LayoutRectangle) => void;
  /** travelled reads that frame once and it is gone: a record flies in from where the person came
   * once, not on every visit afterwards, and a press this phone never measured flies in nowhere. */
  readonly travelled: (href: string) => LayoutRectangle | undefined;
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
  /**
   * push is this phone's notification address as the person standing in front of it can act
   * on it: whether a server holds a row for it, whether the invite may be drawn, and the two
   * answers the invite gives them. A build that ships no push bridge reads `off` and draws
   * nothing; no screen decides any of that, and the token behind it appears on no screen.
   */
  readonly push: PushState;
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
  /** media is the pinch and motion surface this product ships with, named once here. */
  readonly media?: MediaRenderers | undefined;
  /**
   * store is the device's tables, supplied by the composition root; the kit
   * opens no database of its own, so a host without one (a test, a web build)
   * simply has no queue, no cache and no remembered opens, and every write behaves
   * as it did.
   */
  readonly store?: {
    readonly outbox: OutboxStore;
    readonly reads: ReadStore;
    /**
     * recents is the table of opens this device remembers — the one member a host may leave
     * out while shipping the other two. A remembered open is a convenience no write waits
     * on, so a host that ships no table for them loses the section that lists them and keeps
     * its queue and its cache, exactly as a host with no store at all does.
     */
    readonly recents?: RecentsStore;
    /**
     * workspaces is the table of places this device has seen a workspace answer on. Like
     * `recents` it is a convenience no write waits on, so a host that ships no table for it
     * loses the list on the connect step and keeps its queue, its cache and its opens.
     */
    readonly workspaces?: WorkspaceStore;
  };
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
  /**
   * push is the platform's notification surface, supplied by the composition root like the
   * store and the network listener. A host that ships none has no notifications at all: the
   * status stays `off`, no invite is drawn and no request leaves for a device.
   */
  readonly push?: PushBridge;
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

/**
 * PushStatus is where the notification address got to. `unreachable` says no address exists
 * to hold — the platform has no push service, or the server could not be reached this time —
 * which is why a session may try again at the next sign-in; `refused` says somebody, person or
 * server, said no, which is why it may not.
 */
export type PushStatus = "off" | "unasked" | "registered" | "refused" | "unreachable";

/** PushState is the one push block on screen sees: what to say, and the two answers it offers. */
export interface PushState {
  readonly status: PushStatus;
  /** offer says the invite may be drawn: nothing else decides it, and no screen decides alone. */
  readonly offer: boolean;
  /** decline is "Not now": the offer goes for the rest of this session, and nothing is asked. */
  readonly decline: () => void;
  /** turnOn is the only door that opens the platform's prompt, and the only one a person presses. */
  readonly turnOn: () => Promise<void>;
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
  media,
  store,
  clock,
  mint,
  reach,
  push,
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
  // The one record due its moment, and the records whose moment this session already played. One
  // slot, as with the sentence, because one person looks at one record: a filing for a second
  // replaces the pending first rather than queueing it, since a burst nobody ever saw is better than
  // a burst drawn over the wrong record. The address joins the set when its moment is played, not
  // when a write files it, because most writes to a record finish nothing.
  const due = useRef<string | undefined>(undefined);
  const played = useRef<Set<string>>(new Set());
  // Where the person came from, filed by the row they pressed under the address it opens. One
  // slot, because one navigation is under way at a time.
  const journey = useRef<{ href: string; frame: LayoutRectangle } | undefined>(undefined);
  // The one receipt a write owes the person where they are standing, and this shell's own count of
  // them. One slot, as with the sentence, because one receipt is read at a time; the token is what
  // lets the bar's own timer close the bar it was started for and no other. This one is state and
  // not a ref, because the bar draws it: a filing has to arrive as a render, not be discovered the
  // next time something else re-renders the screen.
  const [receipt, setReceipt] = useState<{ sentence: string; token: number } | undefined>(
    undefined,
  );
  const receipts = useRef(0);
  // The person a remembered route and a held sheet belong to, waiting to be
  // compared with whoever the next completed sign-in turns out to be.
  const expected = useRef<Who | undefined>(undefined);
  const remembered = useRef<Remembered | undefined>(undefined);
  const generation = useRef(0);
  // How many sessions this shell has ended, which is what `forget` moves. Three filings below
  // carry the number they were earned under: a write answers when it answers, and the words it
  // answers with belong to the person who did the write and to the origin they did it at. A
  // filing whose number is not this one describes a session that is gone, so it files nothing —
  // the alternative is a sentence earned in one workspace arriving over the screen of whoever
  // signs in next. The write count needs no such binding: `load` clears what this app counted
  // the moment a completed sign-in turns out to name a different person.
  const ended = useRef(0);

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
  // What the address this app is using said about itself, worn by the theme and the header.
  const [workspace, setWorkspace] = useState<Workspace>(() => unknownWorkspace(initialURL));
  /**
   * looked counts the lookups this shell has asked for. A lookup is not a session attempt,
   * so it spends no generation of its own: spending one would retire a load already under
   * way. The lookup that answered last is the only answer the phone wears, and a session
   * that arrives afterwards answers the same value it read for itself.
   */
  const looked = useRef(0);
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
  // what a person was in the middle of doing. Moving `ended` is the other half of
  // the same act: the sessions before this number are gone, and an answer that is
  // still in the air from one of them has no screen left to arrive on.
  const forget = useCallback(() => {
    ended.current += 1;
    expected.current = undefined;
    sheet.current = undefined;
    sentence.current = undefined;
    setReceipt(undefined);
    due.current = undefined;
    played.current = new Set();
    journey.current = undefined;
    remember(undefined);
  }, [remember]);
  const saw = useCallback((href: string) => {
    where.current = href;
  }, []);
  // Read once per render: the three filings below are built under this number, so a callback a
  // write holds says which session it was earned in without being told it now.
  const earned = ended.current;
  const say = useCallback(
    (href: string, text: string) => {
      if (ended.current !== earned) return;
      sentence.current = { href, text };
    },
    [earned],
  );
  const heard = useCallback((href: string) => {
    if (sentence.current?.href !== href) return "";
    const said = sentence.current.text;
    sentence.current = undefined;
    return said;
  }, []);
  const report = useCallback(
    (sentence: string) => {
      if (ended.current !== earned) return;
      receipts.current += 1;
      setReceipt({ sentence, token: receipts.current });
    },
    [earned],
  );
  const reporting = useCallback(() => receipt, [receipt]);
  const spent = useCallback((token: number) => {
    setReceipt((now) => (now?.token === token ? undefined : now));
  }, []);
  const celebrate = useCallback(
    (href: string) => {
      if (ended.current !== earned) return;
      if (played.current.has(href)) return;
      due.current = href;
    },
    [earned],
  );
  const celebrating = useCallback((href: string) => due.current === href, []);
  const celebrated = useCallback((href: string) => {
    if (due.current === href) due.current = undefined;
  }, []);
  const surprised = useCallback((href: string) => {
    played.current.add(href);
  }, []);
  const travelTo = useCallback((href: string, frame: LayoutRectangle) => {
    journey.current = { href, frame };
  }, []);
  const travelled = useCallback((href: string) => {
    if (journey.current?.href !== href) return undefined;
    const frame = journey.current.frame;
    journey.current = undefined;
    return frame;
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

  const recentTable = store?.recents;
  const recents = useMemo(
    () =>
      recentTable && userId
        ? createRecents({
            store: recentTable,
            clock: clock ?? systemClock,
            // The same owner of a scope the queue and the cache ask, so one rule says whose
            // opens these are — and a person who signs in at a phone another person used
            // reads a section of their own.
            scope: () => heldScope(baseURL, userId),
          })
        : undefined,
    [recentTable, baseURL, userId, clock],
  );

  const workspaceTable = store?.workspaces;
  const workspaces = useMemo(
    () =>
      // A workspace's row names a server, not a person, so this table waits for no sign-in:
      // the connect step remembers a place the moment it answers, before anybody has a
      // session there. The clock is the injected one, so the stamp is UTC like every other
      // moment this kit writes.
      workspaceTable && createWorkspaces({ store: workspaceTable, clock: clock ?? systemClock }),
    [workspaceTable, clock],
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

  // Notifications. The session is what owns an address: it is registered for the person who
  // just signed in and taken back from the one who just signed out, and nothing in between
  // decides either. The token itself is memory-only, like the key that reaches it, and so is the
  // row it became — held beside the connection that wrote it, because a row outliving the session
  // that registered it is an address the next person on this phone would inherit. An old
  // sign-out and a new sign-in are live at the same moment when the row answer is slow, so each
  // of these is keyed by the connection that owns it: what one session writes never stands in
  // the place a newer session's own row would be read from.
  const heldDevice = useRef(new Map<Api, { readonly token: string; readonly id: string }>());
  // A registration this phone has on the wire, per sending connection: its answer is a row only
  // that connection's key reaches, so a sign-out waits for it rather than spending the key first.
  const rowOnWire = useRef(new Map<Api, Promise<void>>());
  // Whether this person has already said "not now": the platform's own prompt is spent once
  // it is answered, so the offer this app owns is spent the same way — once per sign-in, and
  // kept in memory rather than in a table, because a dismissed offer decides no command.
  const declined = useRef(false);
  const passing = useRef(new Map<Api, Promise<void>>());
  // A server that answered no to this phone's address is not asked again in the same session:
  // a deployment carrying no adapter for the platform, and a credential the door does not
  // accept, are both answered by the deployment and not by waiting. A new sign-in asks again.
  const pushRefused = useRef(false);
  const [pushView, setPushView] = useState<{ status: PushStatus; offer: boolean }>({
    status: "off",
    offer: false,
  });

  /**
   * wearPush is the only writer of the push status, and it writes nothing for a session that
   * has ended: a token that arrives after the person signed out describes a phone nobody is
   * holding, and the screen it would arrive on belongs to whoever comes next.
   */
  const wearPush = useCallback(
    (still: () => boolean, next: { status: PushStatus; offer: boolean }) => {
      if (still()) setPushView(next);
    },
    [],
  );

  /**
   * handAddress gives this phone's address to the server `a` signed the person in at and holds
   * the row that answer wrote against the connection that wrote it. It answers the new row's id,
   * or nothing where the server wrote no row, and it throws whatever the door answered — the
   * caller turns that into a status, never into a failed session.
   *
   * The ask is remembered while it is on the wire, because the row it writes belongs to this
   * session from the moment the server has it: a sign-out pressed during it waits for this answer
   * before it spends the only key that can reach that row.
   */
  const handAddress = useCallback(async (a: Api, token: string): Promise<string | undefined> => {
    const answer = a.operations.notificationDeviceRegister({
      body: { platform: PUSH_PLATFORM, token },
    });
    // The address the person has now is held before any old one is touched: a re-registration
    // that fails must not have taken away the address that still works.
    const written = answer.then((row) => {
      const id = row.data?.id;
      if (id !== undefined) heldDevice.current.set(a, { token, id });
      return id;
    });
    const onWire: Promise<void> = written.then(
      () => undefined,
      () => undefined,
    );
    rowOnWire.current.set(a, onWire);
    try {
      return await written;
    } finally {
      if (rowOnWire.current.get(a) === onWire) rowOnWire.current.delete(a);
    }
  }, []);

  /**
   * handBack asks the session `a` for this phone's row back, and says whether it did. No row, no
   * request: a phone that never registered has nothing to remove, and a registration still on the
   * wire is waited for first, because the row it is writing is this session's own. A row another
   * connection wrote is not this one's to ask about and is left held: that connection's key still
   * reaches it, and the session that wrote it will give it back. The address this connection wrote
   * is let go either way, because the session that could reach it is ending, and a row remembered
   * past that point is one nobody is ever going to ask for back.
   */
  const handBack = useCallback(async (a: Api): Promise<boolean> => {
    const onWire = rowOnWire.current.get(a);
    if (onWire !== undefined) await onWire;
    const held = heldDevice.current.get(a);
    if (held === undefined) return true;
    heldDevice.current.delete(a);
    try {
      await a.operations.notificationDeviceRemove({ path: { id: held.id } });
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * carryPush is one completed sign-in's whole notification pass: name the channel the
   * platform needs before it can show anything, read what the platform already recorded, and
   * hand this phone's address to the server that just signed the person in.
   *
   * It never opens the system prompt: a person the platform has never been asked about is
   * offered the sentence and its two answers, and `turnOn` is the only door to the prompt.
   * It never fails the session either — every answer it cannot act on lands on a status and a
   * sentence, with nothing else written. The server is the authority on the row and keys a
   * device on platform and token, which is what lets a re-sign-in, a refresh and a token
   * refresh all be sent without a queue or an idempotency key of this phone's own.
   */
  const carryPush = useCallback(
    async (a: Api) => {
      const bridge = push;
      if (bridge === undefined || pushRefused.current) return;
      const started = generation.current;
      const still = () => generation.current === started;
      try {
        await bridge.channel(kitEnglish.pushChannel);
        if (!still()) return;
        if (!(await bridge.permission())) {
          wearPush(still, {
            status: declined.current ? "off" : "unasked",
            offer: !declined.current,
          });
          return;
        }
        const token = await bridge.token();
        if (!still()) return;
        if (token === undefined) {
          wearPush(still, { status: "unreachable", offer: false });
          return;
        }
        // One phone, one address, many holders of it. The same token at the same server is one
        // row, so there is nothing new to hand over; the same token at another server is that
        // server's row to write, and a row left against a connection that has ended is held by
        // nobody, so it stops nothing the next session has to do.
        const previous = heldDevice.current.get(a);
        if (previous !== undefined && previous.token === token) {
          wearPush(still, { status: "registered", offer: false });
          return;
        }
        const id = await handAddress(a, token);
        if (id === undefined) {
          wearPush(still, { status: "unreachable", offer: false });
          return;
        }
        // A token the platform replaced leaves its old row standing at this server, and this is
        // the one connection whose key reaches it: the new address is written first, so a
        // re-registration that fails has not taken away the address that still works.
        if (previous !== undefined) {
          try {
            await a.operations.notificationDeviceRemove({ path: { id: previous.id } });
          } catch {
            // Expo ends a token it says is gone, and the row stays the person's own to read
            // and remove; nothing here retries against a session that is not over.
          }
        }
        wearPush(still, { status: "registered", offer: false });
      } catch (e) {
        // A server that could not answer is worth asking again at the next sign-in; one that
        // answered no — a deployment carrying no adapter for this platform, a credential the
        // door does not accept — is not worth asking twice inside this one.
        const again = !(e instanceof ApiError) || e.status >= 500;
        if (!again) pushRefused.current = true;
        wearPush(still, { status: again ? "unreachable" : "refused", offer: false });
      }
    },
    [handAddress, push, wearPush],
  );

  /**
   * passPush keeps one notification pass in flight for a connection: a sign-in and a token
   * refresh arriving together share the first one's answer rather than racing two registrations
   * of one token. The in-flight pass belongs to the connection that sent it — a row is a row only
   * that connection's key reaches — so a sign-in made while an older session's answer is still
   * away starts its own pass instead of borrowing one that will hand its row to a session that
   * has ended.
   */
  const passPush = useCallback(
    (a: Api): Promise<void> => {
      const inFlight = passing.current.get(a);
      if (inFlight !== undefined) return inFlight;
      const run = carryPush(a).finally(() => {
        if (passing.current.get(a) === run) passing.current.delete(a);
      });
      passing.current.set(a, run);
      return run;
    },
    [carryPush],
  );

  /**
   * resetPush is what one session ending does to the other's offer: whoever said "not now"
   * here is a person the next sign-in has not asked yet, and nothing carries over but the
   * row, which is the server's to keep or move.
   */
  const resetPush = useCallback(() => {
    declined.current = false;
    pushRefused.current = false;
    setPushView({ status: "off", offer: false });
  }, []);

  /**
   * lookUp asks the workspace at an address what it calls itself, what colour it wears and
   * what mark it hands out, and wears that answer while the person stands at the form. It is
   * the kernel's public door (`x-platformkit-auth.kind: public`), asked with a transport that
   * holds no key, so nothing here can end a session or read a person.
   *
   * Failure is the same shape as silence: an unanswered address, a refusal, a timeout and a
   * body outside the pinned schema all answer undefined, leave the address typed, and write
   * no remembered row. The answer that arrives last is the one worn, and a lookup superseded
   * while it was away answers nothing.
   */
  const lookUp = useCallback(
    async (url: string) => {
      const asked = ++looked.current;
      try {
        const answer = await transport(url).operations.appConnection({});
        if (looked.current !== asked) return undefined;
        const face = workspaceOf(answer.data, url);
        setWorkspace(face);
        void workspaces?.remember(face);
        return face;
      } catch {
        // Nothing was answered, so nothing is known about the place: the address the person
        // typed is the only thing the screen can say, and their password gets asked there.
        if (looked.current === asked) setWorkspace(unknownWorkspace(url));
        return undefined;
      }
    },
    [transport, workspaces],
  );

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
        // Observe the connection read as it arrives: a body outside its schema, a 404 and a
        // host that never answers all become "nothing said" here, so no rejection is ever
        // left unobserved and none of them fails the session it rode in on.
        const face = a.operations
          .appConnection({})
          .then((answer) => answer.data)
          .catch(() => undefined);
        const [answered, catalog, answer] = await Promise.all([me, a.catalog(), face]);
        if (generation.current === started) {
          const server = active.current.baseURL;
          const next = whoOf(server, answered?.userId);
          // The workspace's own face rides along with the two reads that decide the
          // session: it says nothing about a person, decides no command and holds nothing
          // the queue consults, so a phone that cannot get it wears the kit's look and the
          // host for a name rather than failing a sign-in. A read that refused leaves the
          // last answer standing — one failed request does not unmake what that server said
          // about itself a minute ago — and signing out is what clears it.
          if (answer !== undefined) {
            const face = workspaceOf(answer, server);
            setWorkspace(face);
            void workspaces?.remember(face);
          }
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
          // The session is live, so this phone is now worth an address: the pass runs after
          // the catalogue rather than before it because a person reads the offer on a screen,
          // and it never holds the load up — nothing the pass answers decides the session.
          void passPush(a);
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
          // The key is gone, so the face it wore with it is gone: the next thing this phone
          // wears a workspace's colour is the next document it reads.
          setWorkspace(unknownWorkspace(url));
          void sessions.clear(url).catch(() => undefined);
          // A dead key reaches its device row no more than it reaches its own revoke: the row
          // stays the server's, and this phone keeps no address beside a connection it will
          // never ask anything of again. The next sign-in holds its own connection.
          heldDevice.current.delete(a);
          return;
        }
        dispatch({ type: "failed", generation: started, error: catalogFailure(e) || message(e) });
      }
    },
    [connect, forget, passPush, workspaces],
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
      media,
      identity,
      writes,
      wrote,
      saw,
      typed,
      keep,
      say,
      heard,
      report,
      reporting,
      spent,
      celebrate,
      celebrating,
      celebrated,
      surprised,
      travelTo,
      travelled,
      returning,
      outbox: outboxValue,
      reads,
      recents,
      workspaces,
      workspace,
      lookUp,
      entry: (module, entity) =>
        state.catalog?.resources.find((r) => r.module === module && r.entity === entity),
      async signIn(url, email, password) {
        const started = begin();
        resetPush();
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
        resetPush();
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
        // The key this connection signs with is the key the saved record has to be carrying for
        // the record to be this session's to forget. It is read before anything spends it.
        const leaving = previous.api.bearer();
        live.current = undefined;
        // Signing out is the person ending the session themselves, so nobody is
        // coming back to the address a refusal left behind: it goes now, rather
        // than waiting to be handed to whoever signs in next.
        forget();
        // A window this phone walked away from is not one it comes back to.
        challenge.current = undefined;
        resetPush();
        connect(previous.baseURL, transport(previous.baseURL));
        setIdentity(undefined);
        // A person who signs out leaves the workspace's colours behind with the key: what is
        // on screen now is the form, which wears them again only when a lookup answers.
        setWorkspace(unknownWorkspace(previous.baseURL));
        dispatch({ type: "signed-out", generation: started });
        // Signing out means two things, and the phone does the first on its own: it forgets the
        // key here, and it asks the server to stop it. Forgetting is not waiting for the asking —
        // that is the half that works offline, and on a phone somebody is about to pick up: a
        // person who signs out and closes the app while an answer is away must not leave their
        // session open for the next hand. It reaches only the record this session wrote — a newer
        // sign-in that completed since saved its own key, and an ending session that cleared the
        // slot then would take that key away. The asking is not swallowed either: a key the server
        // still answers to after this phone forgot it is a live credential, and a signed-out
        // screen that said nothing about it would let the person believe it dead. The revoke is
        // one of the few doors that can honestly answer no: it stands at httpx.SignedIn(), which
        // refuses a credential carrying its own scopes (kit/httpx/authorize.go), so a key restored
        // from storage — which has no sign-in session behind it — cannot spend itself.
        // The result is read at the end rather than dropped: a phone whose own storage refused to
        // clear has that to say, and it is a fact about the phone, not about the server.
        const forgotten = sessions
          .forget({ baseURL: previous.baseURL, token: leaving?.token })
          .then(
            () => true,
            () => false,
          );
        // The phone's own row is the person's, and only their key reaches it: it is asked back
        // while that key still spends, which is why the asking stands between the forgetting above
        // and the stopping below. A sign-out that cannot take the row back still forgets the key.
        const removed = await handBack(previous.api);
        const stopped = previous.api.logout();
        // A person who chose to keep their held writes never reaches this line:
        // every door that leaves asks first (src/screens/useSignOut.ts).
        outbox?.clear();
        const cleared = await forgotten;
        if (!cleared && generation.current === started)
          dispatch({
            type: "signed-out",
            generation: started,
            error:
              "The saved sign-in could not be cleared. Please try again before closing the app.",
          });
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
        // One notice slot, and the bigger fact first: a key that may still answer for its
        // holder is the one worth reading. A row this phone could not take back is said only
        // when the key really did stop, and it is said at all: a phone that goes on signing
        // out into a device that still receives notifications is owed the difference.
        else if (!removed && cleared && generation.current === started)
          dispatch({
            type: "signed-out",
            generation: started,
            error: kitEnglish.pushNotRemoved,
          });
      },
      push: {
        status: pushView.status,
        offer: pushView.offer,
        decline: () => {
          declined.current = true;
          setPushView({ status: "off", offer: false });
        },
        turnOn: async () => {
          const bridge = push;
          if (bridge === undefined) return;
          const started = generation.current;
          const answer = await bridge.ask().catch(() => false);
          if (generation.current !== started) return;
          if (!answer) {
            // The platform keeps this answer and will not offer the prompt again, so neither
            // does this app: the sentence is said once and the door stays where it was.
            setPushView({ status: "refused", offer: false });
            return;
          }
          await passPush(active.current.api);
        },
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
      media,
      identity,
      writes,
      wrote,
      saw,
      typed,
      keep,
      say,
      heard,
      report,
      reporting,
      spent,
      celebrate,
      celebrating,
      celebrated,
      surprised,
      travelTo,
      travelled,
      returning,
      outboxValue,
      reads,
      recents,
      workspaces,
      workspace,
      lookUp,
      push,
      pushView,
      passPush,
      resetPush,
      handBack,
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
