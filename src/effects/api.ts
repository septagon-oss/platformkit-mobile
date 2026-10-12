// api.ts is every request the shell makes. The kernel's routes are the same
// ones the web shell's screens call — list and read at the entry's own path,
// and every write at the address the entry names for writes (writePath in
// src/core/derive.ts, which is the entry's own path unless the server printed
// another) — so there is no second API to keep honest.
//
// The credential a signed-in phone works with is a bearer key of the auth
// module's api_tokens, never the session cookie. A native client is not a
// browser: it presents `Authorization: Bearer` on its requests and reads no
// Set-Cookie, because a request that carries both a cookie and a bearer is
// answered as anonymous (kit/httpx/authenticate.go's ambiguousCredential), and
// the kernel's CSRF rule accepts a caller that sends neither Sec-Fetch-Site nor
// Origin (kit/httpx.SameSite).
//
// The session a sign-in opens is held, in memory only, for as long as the key it
// minted is held — never stored, never sent to work. It is what the four doors
// that answer to the holder themselves take: the mint, who-this-is, the key's own
// revoke, and the sign-out that closes it. A scoped key is refused at every
// `httpx.SignedIn()` operation (kit/httpx/authorize.go: "this credential carries
// its own scope, and this operation answers only to its holder"), so a phone that
// kept only the key could neither ask who it is nor stop its own key. A key
// restored from storage comes back with no session, which is why signing out says
// whether the server stopped the key or only this phone forgot it.
import {
  type Catalog,
  type Entry,
  type HintNotice,
  parseCatalog,
  CatalogError,
} from "../core/catalog";
import { row, page, identity, trail, issuedToken, issuePath } from "../core/responses";
import { commandPath, writePath } from "../core/derive";
import { keyRefusal } from "../core/outbox";
import { factorRequired, unrecognisedCaller } from "../core/signInOutcome";
import { type DeclaredPermission, delegableScopes } from "../core/scopes";
import { declaredGrants as kitGrants } from "../generated/grants.gen";
import { kitEnglish } from "../core/kitCopy";

import { createClient, type Client } from "../generated/client";
import { getValidRequestBody } from "../generated/core/utils.gen";
import { bindOperations, type Operations } from "../generated/operations.gen";
import { documentedRoute } from "../generated/routes.gen";
import { ZodError } from "zod";
import type {
  Identity as WireIdentity,
  Event as WireEvent,
  PageTaskBody,
} from "../generated/types.gen";

export const PER_PAGE = 20;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly fields: Readonly<Record<string, string>> = {},
    /** type is the problem document's `type`, which says whether the status
     * code says everything there is to say (kit/problem). It is what
     * src/core/signInOutcome.ts reads before it reads any sentence. */
    readonly type?: string,
  ) {
    super(detail || `HTTP ${status}`);
    this.name = "ApiError";
  }

  /**
   * excluded says the server refused this because of what the tenant is
   * paying for rather than what the caller may do. It is a different sentence
   * on screen — "your plan does not include this", not "you may not" — and a
   * different way out, so the two are told apart here and not at each screen.
   */
  get excluded(): boolean {
    return this.status === 402;
  }
}

/**
 * ResponseError is a refusal whose body this build could not read — a malformed
 * document or a catalogue newer than it understands. The status it carries is
 * still the server's answer; the class says the *body* is what failed, which is
 * the difference between "the server is down" and "update the app".
 */
export class ResponseError extends ApiError {}

/**
 * Identity is who a sign-in belongs to, as the auth module answers.
 * permissions is the set the server computed for this person, wildcard included
 * when their role grants it; src/core/scopes.ts turns that into the scopes the
 * mint is allowed to accept, and the kit itself names no permission of its own.
 */
export type Identity = Readonly<Pick<WireIdentity, "userId" | "email" | "permissions">>;

/**
 * Bearer is the key this phone signs with: the secret to present and the id
 * the server revokes it by. The token is never stored beside anything else and
 * the id is read by nothing but the revoke at sign-out.
 */
export interface Bearer {
  readonly token: string;
  readonly id: string;
}

/**
 * SignInAnswer is what the password leg returns. A second factor is an
 * outcome rather than a fault (modules/auth/contracts/factors.go), so it comes
 * back as a case the screen branches on, not an exception every caller would
 * have to recognise in its own words.
 */
export type SignInAnswer =
  | { readonly kind: "signed-in"; readonly bearer: Bearer }
  | { readonly kind: "factor-required"; readonly email: string };

/**
 * SignInStep is SignInAnswer with the key taken out: what the shell may hand a
 * screen. Only the shell holds a credential; a screen is told which step to
 * draw and about which address.
 */
export type SignInStep =
  { readonly kind: "signed-in" } | { readonly kind: "factor-required"; readonly email: string };

/**
 * SignOut is what a sign-out leaves: this phone has forgotten its key either way.
 * Two questions remain, and one sentence answers only one of them.
 *
 * `revoked` is what the server did: it stopped the key this connection held.
 * `live` is what the person still has to do: this phone forgot a key the server
 * may still spend. They differ for a key this phone restored from storage — it
 * holds the secret but not the session its mint used, and the revoke answers only
 * to the holder — so that key waits in the account's device list until the person
 * stops it there, and a screen that said only "signed out" would hand them a live
 * credential they believe dead. Both are false where there is no key to speak of:
 * a connection that held none, and a key the server refuses as a caller it does
 * not know (src/core/signInOutcome.ts's unrecognisedCaller), leave nothing to
 * remove, and a screen that sent the person off to remove it would be sending them
 * to a device that is not there or already stopped.
 *
 * The key is all this record speaks of. The sign-in session that minted it closes
 * with it, and a session the server would not close says nothing about the key — the
 * ask about the key went out with a different credential — and nothing the person
 * could reach: that cookie is in no store, is presented by no later request, and
 * leaves this phone's memory with the call, so there is no second ask to make and no
 * device list that lists it. A notice spent on it would report a stopped key as
 * live, which is the one thing a sign-out may not say.
 */
export interface SignOut {
  readonly revoked: boolean;
  readonly live: boolean;
}

/** Screen projection; wire events are validated in full before reaching it. */
export type AuditEvent = Readonly<Pick<WireEvent, "id" | "name" | "occurredAt" | "actor">> & {
  readonly payload?: unknown;
};

export type Page = Readonly<Pick<PageTaskBody, "total">> & {
  readonly items: readonly Record<string, unknown>[];
};

/** Trail is a page of the audit trail, with how many rows the filter matched. */
export interface Trail {
  readonly items: readonly AuditEvent[];
  readonly total: number;
}

/**
 * Since is which part of a record's trail to read. The server filters by the
 * record, so a page here is a page of that record's own history rather than a
 * window of everything that had to be sifted.
 */
export interface Since {
  readonly record?: string;
  readonly offset?: number;
  readonly limit?: number;
}

/** Window is which rows to read: where to start, how many, in what order, narrowed how. */
export interface Window {
  readonly offset?: number;
  readonly limit?: number;
  readonly sort?: string;
  readonly filters?: readonly string[];
}

/**
 * listQuery is a window spelled the way `list` sends it. The read cache keys a
 * page by the same address, so the page that lands replaces the one a person is
 * looking at instead of sitting beside it under another name.
 */
export function listQuery({
  offset = 0,
  limit = PER_PAGE,
  sort = "",
  filters = [],
}: Window): string {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (sort) q.set("sort", sort);
  for (const f of filters) q.append("filter", f);
  return q.toString();
}

/** rowAddress is where one row of an entry lives, which is what a cache row is named for. */
export function rowAddress(e: Entry, id: string): string {
  return `${e.path}/${encodeURIComponent(id)}`;
}

export type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  readonly signal?: AbortSignal | undefined;
  /**
   * idempotencyKey is the header the kernel honours once T-0293 lands; until
   * then the phone sends it and the server ignores it. The outbox mints it
   * before a write's first attempt leaves the phone and keeps it as the row's
   * id, so the attempt that may have landed and the replay that follows name
   * the same write. A request no queue could ever replay carries none.
   */
  readonly idempotencyKey?: string | undefined;
}

/**
 * keyed is the options argument a typed write takes besides its own: the
 * idempotency key the queue minted for it, or nothing at all where no queue
 * exists to replay it. A call made without an argument is not the same call as
 * one made with an empty one — the write a phone cannot hold is left exactly the
 * call it was before the queue existed.
 */
export function keyed(idempotencyKey: string | undefined): readonly [] | readonly [RequestOptions] {
  return idempotencyKey === undefined ? [] : [{ idempotencyKey }];
}

export interface Api {
  /** Generated operations bound to this connection, each with response validation. */
  readonly operations: Operations;
  /** Module-owned JSON; every successful response passes the caller's validator. */
  request<T>(
    method: RequestMethod,
    path: string,
    validate: (value: unknown) => T,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T>;
  /** me is who this session belongs to, or nothing when it belongs to nobody. */
  me(): Promise<Identity | undefined>;
  /**
   * events is a page of the audit trail, newest first, optionally about one
   * record. A caller who may not read the trail gets an empty one rather than
   * an error: a record whose history is none of your business still shows.
   */
  events(q?: Since): Promise<Trail>;
  /**
   * signIn offers the password. It returns either the key this phone will
   * sign with, or the address the server wants a code about.
   */
  signIn(email: string, password: string): Promise<SignInAnswer>;
  /** answerFactor spends the code — from an app or a recovery card — and returns a key. */
  answerFactor(email: string, code: string): Promise<Bearer>;
  /**
   * logout forgets this connection's key here and, when it holds the session that
   * minted the key, stops it on the server and closes that session too. The answer
   * says whether the server stopped it (SignOut); forgetting does not wait for one.
   * Only the key's own failure to answer is thrown, and only after the session has
   * been asked: a session the server would not close is the server's to end, and
   * changes nothing in what was learned about the key.
   */
  logout(): Promise<SignOut>;
  catalog(notice?: HintNotice): Promise<Catalog>;
  /** list is a window of rows, in an order, through equality filters spelled field:value. */
  list(e: Entry, q?: Window): Promise<Page>;
  get(e: Entry, id: string): Promise<Record<string, unknown>>;
  /**
   * one is the row of a singleton, which lives at the entry's own path: a
   * tenant has one and it has no id to ask for. replace is how it is written,
   * because a singleton's write is a PUT of the whole of it.
   */
  one(e: Entry): Promise<Record<string, unknown>>;
  replace(
    e: Entry,
    values: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<Record<string, unknown>>;
  create(
    e: Entry,
    values: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<Record<string, unknown>>;
  update(
    e: Entry,
    id: string,
    values: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<Record<string, unknown>>;
  remove(e: Entry, id: string, options?: RequestOptions): Promise<void>;
  /**
   * command runs one of the entry's lifecycle routes and answers the row it
   * left behind. id is the row it is about, or nothing for a command about the
   * collection; values is its argument, or nothing for a command that takes
   * none — which is sent as no body at all, because "{}" is not something a
   * caller should have to say to say nothing.
   */
  command(
    e: Entry,
    id: string | undefined,
    verb: string,
    values?: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<Record<string, unknown>>;
  /** bearer is the key this connection signs with, or undefined when signed out. */
  readonly bearer: () => Bearer | undefined;
}

/**
 * TIMEOUT is how long a request may take before this gives up. A phone leaves
 * networks, changes them and keeps a saved server it can no longer reach, and
 * fetch waits for none of that: without a deadline the app sits on a spinner
 * with nothing to say.
 */
export const TIMEOUT = 15_000;

/** TOKENS is where this phone mints its key and where it spends it. */
const TOKENS = "/api/v1/auth/tokens";
const CHALLENGE_VERIFY = "/api/v1/auth/challenge/verify";
const LOGOUT = "/api/v1/auth/logout";
/** NO_SCOPES is the phone's own refusal, and the kit owns its words. */
const NO_SCOPES = kitEnglish.noScopes;

/**
 * KEY_NAME is what this phone calls its own key on someone else's list of
 * keys ("What this key is, in the words whoever reads the list would use",
 * modules/auth/internal/token_routes.go). It names the class of device, no
 * product and no tenant; a composing app supplies its own word.
 */
export const KEY_NAME = "This phone";

/**
 * SessionFrame is the session one sign-in leg opened, as the frame that mints
 * with it. No exported member returns a frame or its cookie: the only credential
 * that survives the leg by itself is the key it mints.
 */
interface SessionFrame {
  cookie?: string | undefined;
}

/**
 * createApi is one connection to one server, carrying one key: every request the
 * shell makes, over the transport it is given. The defaults are this kit's own
 * words for itself, and each is the argument a composing app replaces when its
 * surface differs from the pinned document — `timeout` is how long a request may
 * take before it is given up on, `tokenName` is what this app calls its own key on
 * the server's list of keys, and `declaredGrants` is the permission catalogue the
 * mint may narrow a key to, by default the one the pinned document prints for this
 * kit's own operations (src/generated/grants.gen.ts). A path that is not an
 * encoded API path is refused before anything leaves, and every refusal comes back
 * as an ApiError carrying the status, detail and problem type the server named.
 */
export function createApi(
  baseURL: string,
  fetchImpl: typeof fetch = fetch,
  initialBearer?: Bearer,
  timeout: number = TIMEOUT,
  tokenName: string = KEY_NAME,
  declaredGrants: readonly DeclaredPermission[] = kitGrants,
  /** refused is called with nothing but the fact that this server answered 401 for this
   * transport. Every request — generated operation, `me`, the catalogue, the event trail,
   * a write — is answered at one line, so this is the one place a session's refusal can
   * be heard: the transport reports it, and the shell is what decides what it means. */
  refused?: () => void,
): Api {
  let bearer: Bearer | undefined = initialBearer;
  /**
   * session is the cookie the sign-in that minted this connection's key answered
   * with, held only while that key is held and only in memory. A key read back out
   * of storage arrives here with none: nothing stores a session, and the doors
   * above are the only ones it stands at.
   */
  let session: string | undefined;
  /**
   * warnOnce is where a malformed presentation hint goes: a fallback the person
   * never sees and never reads, and an author's one line. "Once" means once per
   * distinct (document path, reason) for this connection — the parse runs once per
   * served body, so a workspace that declares the same typo in ten hints says it
   * ten ways once each, and a refresh repeats nothing. The core keeps no console
   * (AGENTS.md) and no state; this transport is the reader that owns both.
   */
  const noticed = new Set<string>();
  const warnOnce: HintNotice = (at, why) => {
    const key = `${at}\u0000${why}`;
    if (noticed.has(key)) return;
    noticed.add(key);
    console.warn(`catalog hint: ${at} ${why}`);
  };
  const base = baseURL.replace(/\/+$/, "");

  function apiPath(path: string): void {
    if (
      !path.startsWith("/api/v1/") ||
      path.includes("#") ||
      path.includes("\\") ||
      new URL(path, "https://api.invalid").pathname !== path.split("?")[0]
    ) {
      throw new TypeError("Expected an encoded API path under /api/v1/.");
    }
  }

  /**
   * call is one request, and it answers the body rather than the response
   * because the deadline has to cover reading it. A server that sends headers
   * and then stalls is the same spinner as one that never answers at all, and
   * clearing the timer when fetch resolves left exactly that hole open: fetch
   * resolves on the headers.
   */
  async function call(
    method: RequestMethod | "HEAD",
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    prepared?: {
      body: BodyInit | null;
      headers: Headers;
      cookie: string | undefined;
      /** frame is the sign-in whose session this request carries; the answer's
       * Set-Cookie belongs to it and to nothing else. */
      frame?: SessionFrame | undefined;
      /** key is the bearer this request presents in place of the held one —
       * the one request a sign-out makes to spend a key it is about to forget. */
      key?: Bearer | undefined;
    },
    idempotencyKey?: string,
  ): Promise<{ text: string; status: number; headers: Headers; bytes?: ArrayBuffer }> {
    apiPath(path);
    if (method === "GET" && body !== undefined)
      throw new TypeError("A GET request cannot have a body.");
    if (signal?.aborted) throw cancelled();
    const headers: Record<string, string> = prepared
      ? Object.fromEntries(prepared.headers.entries())
      : {};
    headers.Accept = "application/json";
    delete headers.cookie;
    delete headers.origin;
    delete headers["sec-fetch-site"];
    if (body !== undefined) headers["Content-Type"] = "application/json";
    // A header is one token or nothing: a value with a CR or an LF in it would
    // be a second request, not a key, and no caller's choice may open that door.
    if (idempotencyKey !== undefined) {
      const refusal = keyRefusal(idempotencyKey);
      if (refusal) throw new TypeError(refusal);
      headers["Idempotency-Key"] = idempotencyKey;
    }
    // One credential per request, never both: the session belongs to the frame
    // that is minting its key, and every other request carries the key alone.
    const sendingCookie = prepared?.cookie;
    if (sendingCookie) headers.Cookie = sendingCookie;
    else {
      const presenting = prepared?.key ?? bearer;
      if (presenting) headers.Authorization = `Bearer ${presenting.token}`;
    }
    const stop = new AbortController();
    const cancel = () => stop.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    let expired = false;
    const bell = setTimeout(() => {
      expired = true;
      stop.abort();
    }, timeout);
    const init: RequestInit = { method, headers, credentials: "omit", signal: stop.signal };
    let status = 0;
    let text = "";
    let responseHeaders = new Headers();
    let bytes: ArrayBuffer | undefined;
    // answered says the server took the request and said something: from that
    // moment on, a failure belongs to reading its answer, not to a network that
    // never carried the request. The two are not the same write: one may have
    // landed, and the kernel does not honour an Idempotency-Key until T-0293.
    let answered = false;
    try {
      if (prepared?.body != null) init.body = prepared.body;
      if (body !== undefined) {
        init.body = JSON.stringify(body);
        if (init.body === undefined) throw new TypeError("The request body is not JSON.");
      }
      const res = await fetchImpl(base + path, init);
      answered = true;
      // A session is kept only for the sign-in frame that was answered with it,
      // and only long enough to mint with it. No response sets a credential any
      // later request presents.
      const sent = res.headers.get("Set-Cookie")?.split(";")[0];
      if (sent && prepared?.frame) prepared.frame.cookie = sent;
      status = res.status;
      responseHeaders = res.headers;
      if (
        prepared &&
        res.headers.get("Content-Type") &&
        !res.headers.get("Content-Type")?.includes("json") &&
        res.status < 400
      )
        bytes = await res.arrayBuffer();
      else text = await res.text();
      if (signal?.aborted) throw cancelled();
    } catch (e) {
      // A request that was cut off by the deadline says so; anything else is
      // the network's own message.
      if (expired)
        throw new ApiError(
          0,
          `${base} did not answer within ${Math.round(timeout / 1000)} seconds.`,
        );
      if (signal?.aborted) throw cancelled();
      // The server had already answered when this failure happened, so the
      // write may be in the database: it is an unreadable answer, which is what
      // a held write is never resent for, and never the network's own failure.
      if (answered)
        throw new ResponseError(status, `Invalid response at ${path}: its body never arrived.`);
      throw e;
    } finally {
      clearTimeout(bell);
      signal?.removeEventListener("abort", cancel);
    }
    if (status >= 400) {
      // 401 is a fact about the session rather than about this request, and the
      // request's caller is not the unit that owns a session. The notice goes out
      // before the throw, so the shell hears it whoever was waiting on this call.
      if (status === 401) refused?.();
      throw problem(status, text);
    }
    return { text, status, headers: responseHeaders, ...(bytes === undefined ? {} : { bytes }) };
  }

  function problem(status: number, text: string): ApiError {
    let detail = "";
    let type: string | undefined;
    const fields: [string, string][] = [];
    try {
      const p: unknown = JSON.parse(text);
      if (!p || typeof p !== "object" || Array.isArray(p)) return new ApiError(status, "");
      const body = p as Record<string, unknown>;
      if (typeof body.detail === "string") detail = body.detail.replace(/^crud: invalid: /, "");
      if (typeof body.type === "string") type = body.type;
      for (const entry of Array.isArray(body.errors) ? body.errors : []) {
        let name = "";
        let message = "";
        if (typeof entry === "string") {
          const i = entry.indexOf(": ");
          if (i > 0) {
            name = entry.slice(0, i);
            message = entry.slice(i + 2);
          }
        } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          if (typeof entry.location === "string" && typeof entry.message === "string") {
            name = entry.location;
            message = entry.message;
          }
        }
        // PlatformKit prefixes body locations in its string errors. Huma's
        // object form uses the same paths; preserve nested and non-body paths.
        name = name.replace(/^body\./, "");
        if (name && message) fields.push([name, message]);
      }
    } catch {
      // not a problem document; the status is what there is to say
    }
    return new ApiError(status, detail, Object.fromEntries(fields), type);
  }

  /**
   * serverRefused says the server answered this request with a verdict of its own
   * (a 4xx) rather than failing to answer it, or answering with something this
   * contract cannot read. Only a verdict may be turned into a returned answer. It
   * is not the transport's `refused` notice, which says one status and nothing
   * else: a verdict belongs to the request that was answered, the notice to the
   * session the answer describes.
   */
  function serverRefused(error: unknown): boolean {
    return error instanceof ApiError && error.status >= 400 && error.status < 500;
  }

  function cancelled(): Error {
    const error = new Error("The request was cancelled.");
    error.name = "AbortError";
    return error;
  }

  async function request<T>(
    method: RequestMethod,
    path: string,
    validate: (value: unknown) => T,
    body?: unknown,
    { signal, idempotencyKey }: RequestOptions = {},
  ): Promise<T> {
    if (typeof validate !== "function") throw new TypeError("A response validator is required.");
    const { value, status } = await read(method, path, body, { signal, idempotencyKey });
    try {
      return validate(value);
    } catch {
      // A validator's exception can contain private response values. Report
      // the endpoint and status without copying its message into the UI.
      throw new ResponseError(status, `Invalid response at ${path}: response validation failed.`);
    }
  }

  /**
   * carried is what one request presents besides its own body: the sign-in frame
   * whose session it mints with, a key to present in place of the held one, and the
   * idempotency key the queue minted for the write. Each is named by a caller inside
   * this file — a sign-in leg, a sign-out, the queue — and a request carried by none
   * presents the key this connection holds and nothing else.
   */
  interface Carried {
    readonly session?: SessionFrame | undefined;
    readonly key?: Bearer | undefined;
    readonly idempotencyKey?: string | undefined;
  }

  async function documented<T>(
    operation: (client: Client) => Promise<T>,
    carried: Carried = {},
  ): Promise<T> {
    const { session: frame, key, idempotencyKey } = carried;
    const sendingCookie = frame?.cookie;
    const bodies = new WeakMap<Request, BodyInit | null>();
    const nativeFetch: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.hash) throw new TypeError("Expected an API path without a fragment.");
      if (url.origin !== new URL(base).origin)
        throw new TypeError("Expected the selected API server.");
      const path = url.pathname + url.search;
      const route = documentedRoute(request.method, path);
      if (!route)
        throw new TypeError(`No documented operation at ${path}; use request with a validator.`);
      const method = request.method as RequestMethod | "HEAD";
      // React Native's Request has no .body stream. Keep the SDK's serialized
      // body through its request hook, including a native FormData upload.
      if (!bodies.has(request)) throw new TypeError("Expected a generated request.");
      const body = bodies.get(request) ?? null;
      if (body instanceof FormData) request.headers.delete("Content-Type");
      const result = await call(
        method,
        path,
        undefined,
        request.signal,
        {
          body,
          headers: request.headers,
          cookie: sendingCookie,
          ...(frame ? { frame } : {}),
          ...(key ? { key } : {}),
        },
        idempotencyKey,
      );
      const status = result.status;
      if (!route.statuses.includes(status))
        throw new ResponseError(
          status,
          `Invalid response at ${path}: $ unexpected response status.`,
        );
      if (route.json && result.text === "" && (!result.bytes || result.bytes.byteLength === 0))
        throw new ResponseError(status, `Invalid response at ${path}: $ empty JSON body.`);
      // The body is already buffered under our deadline. Its actual bytes,
      // not a server's Content-Length hint, decide whether to validate it.
      const headers = new Headers(result.headers);
      headers.delete("Content-Length");
      return new Response(
        method === "HEAD" || status === 204 ? null : (result.bytes ?? result.text),
        { status, headers },
      );
    };
    const client = createClient({
      baseUrl: base,
      fetch: nativeFetch,
      credentials: "omit",
      throwOnError: true,
    });
    client.interceptors.request.use((request, options) => {
      bodies.set(request, (getValidRequestBody(options) as BodyInit | undefined) ?? null);
      const route = documentedRoute(request.method, new URL(request.url).pathname);
      if (route?.json) options.parseAs = "json";
      return request;
    });
    client.interceptors.error.use((error, response, request) => {
      if (
        response &&
        request &&
        (error instanceof ZodError || error instanceof SyntaxError || error instanceof CatalogError)
      ) {
        const url = new URL(request.url);
        return new ResponseError(
          response.status,
          `Invalid response at ${url.pathname + url.search}: ${error instanceof CatalogError ? error.at : issuePath(error)} failed validation.`,
        );
      }
      return error;
    });
    return operation(client);
  }

  async function read(
    method: RequestMethod,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
    carried: Carried = {},
  ): Promise<{ value: unknown; status: number }> {
    const { signal, idempotencyKey } = options;
    const { session: frame, key } = carried;
    apiPath(path);
    if (method === "GET" && body !== undefined)
      throw new TypeError("A GET request cannot have a body.");
    const route = documentedRoute(method, path);
    if (route) {
      if (route.multipart)
        throw new TypeError("This operation requires a generated multipart request.");
      let wireBody: unknown;
      if (body !== undefined) {
        const serialized = JSON.stringify(body);
        if (serialized === undefined) throw new TypeError("The request body is not JSON.");
        wireBody = JSON.parse(serialized);
      }
      const result = await documented((client) => route.run(client, path, wireBody, signal), {
        session: frame,
        key,
        idempotencyKey,
      });
      return { status: result.response.status, value: result.data };
    }
    // A route outside the document carries its credential the same way: whatever
    // this request was told to present goes on the wire in place of the held key.
    const prepared =
      frame === undefined && key === undefined
        ? undefined
        : { body: null, headers: new Headers(), cookie: frame?.cookie, key, frame };
    const { text, status } = await call(method, path, body, signal, prepared, idempotencyKey);
    try {
      return { status, value: text === "" ? undefined : JSON.parse(text) };
    } catch {
      throw new ResponseError(status, `Invalid response at ${path}: $ invalid JSON.`);
    }
  }

  async function json<T>(
    method: RequestMethod,
    path: string,
    validate: (value: unknown) => T,
    body?: unknown,
    options: RequestOptions = {},
    carried: Carried = {},
  ): Promise<T> {
    const { value, status } = await read(method, path, body, options, carried);
    try {
      return validate(value);
    } catch (error) {
      throw new ResponseError(
        status,
        `Invalid response at ${path}: ${error instanceof CatalogError ? error.at : issuePath(error)} failed validation.`,
      );
    }
  }

  /**
   * mint exchanges the session one sign-in leg opened for the key this phone
   * will work with. It runs inside that leg's frame, and the frame dies with the
   * call: what survives is the key, plus the session itself for as long as that
   * key is held, because the revoke and who-this-is answer to the holder and not
   * to the key (kit/httpx/authorize.go).
   */
  async function mint(who: Identity, frame: SessionFrame): Promise<Bearer> {
    // The scopes are not the identity's list: the mint refuses the wildcard the
    // built-in administrator role grants by, and asks for every scope to be a
    // permission the catalogue this connection was built with declares — this
    // kit's own document by default, whatever a composing app's modules declare
    // (src/core/scopes.ts says what the phone asks for instead, and why). An empty
    // answer is refused here rather than sent: a person granted nothing signs in to
    // nothing, and keeping the session instead would be a half credential whose
    // every read is a 401 on a key this phone never minted.
    const scopes = delegableScopes(who.permissions ?? [], declaredGrants);
    if (scopes.length === 0) throw new ApiError(403, NO_SCOPES);
    // expiresAt is left out: the server applies its own default lifetime and
    // the phone cannot judge its own clock against it.
    const key = await json(
      "POST",
      TOKENS,
      issuedToken.parse,
      { name: tokenName, scopes },
      {},
      { session: frame },
    );
    session = frame.cookie;
    return key;
  }

  return {
    request,
    operations: bindOperations(documented),
    bearer: () => bearer,
    async signIn(email, password) {
      const session: SessionFrame = {};
      let who: Identity;
      try {
        who = await json(
          "POST",
          "/api/v1/auth/login",
          identity.parse,
          { email, password },
          {},
          { session },
        );
      } catch (e) {
        // The kernel answers a missing second factor with a 401 shaped exactly
        // like a wrong password, and the sentence is the discriminator it has
        // not named yet (src/core/signInOutcome.ts). Nothing was minted and
        // nothing is kept: the person is one step further along the same form.
        if (e instanceof ApiError && factorRequired(e)) return { kind: "factor-required", email };
        throw e;
      }
      const key = await mint(who, session);
      bearer = key;
      return { kind: "signed-in", bearer: key };
    },
    async answerFactor(email, code) {
      const session: SessionFrame = {};
      // The door is public (httpx.Public): this leg needs no session to answer
      // with. The code goes as it came, trimmed of what a paste added, because
      // a recovery code is not six digits and the phone invents no grammar.
      const who = await json(
        "POST",
        CHALLENGE_VERIFY,
        identity.parse,
        { email, code: code.trim() },
        {},
        { session },
      );
      const key = await mint(who, session);
      bearer = key;
      return key;
    },
    async logout() {
      const key = bearer;
      const sign = session;
      bearer = undefined;
      session = undefined;
      // No key, no question: a connection that holds nothing sends no revoke and
      // has no key for anyone to go and remove.
      if (!key) return { revoked: false, live: false };
      // The key is revoked at its own address, addressed by its id and never by
      // its secret, and local forgetting does not wait for the answer. What the
      // request presents is the question this ordering decides: auth-token-revoke
      // is httpx.SignedIn(), which refuses a credential carrying its own scopes,
      // so the session that minted the key presents it where this phone still has
      // one, and a restored key presents itself and is refused. The refusal is not
      // swallowed here: it is the live: true a screen then has to say out loud.
      let revoked = true;
      // unrecognised says the server refused this key as a caller it does not
      // know, which is the end of the key wherever it is. That answer only speaks
      // of the key when the key itself was presented: a revoke that went with the
      // sign-in's session says the session is gone, and a dead session says
      // nothing about the key outliving it.
      let unrecognised = false;
      /**
       * unanswered is the revoke's own failure to answer at all. It is held while the
       * session below is still asked and thrown once that is done: the key's verdict
       * is then "unknown", and only the failure of the ask about the key may say so —
       * nothing that happens afterwards may take its place.
       */
      let unanswered: unknown;
      try {
        await json(
          "POST",
          `${TOKENS}/${encodeURIComponent(key.id)}/revoke`,
          () => undefined,
          undefined,
          {},
          sign === undefined ? { key } : { session: { cookie: sign } },
        );
      } catch (error) {
        // A refusal is the server's own no about this key, and the caller has to
        // be able to say it: reported rather than thrown, because this phone's
        // half of the sign-out is already done and a throw would be swallowed as
        // if the two halves were one. A server that refused to answer at all — a
        // 503, or an answer in a shape this contract refuses — is held below rather
        // than thrown here, so the session it is signed out of is still closed.
        if (!serverRefused(error)) unanswered = error;
        else {
          revoked = false;
          unrecognised = sign === undefined && unrecognisedCaller(error);
        }
      }
      // The session that signed in closes with the key it minted: a sign-out that
      // left it standing would leave the person signed in somewhere. It is asked
      // whatever the revoke answered — a key the server would not stop is still a
      // session this phone no longer holds — and its own answer, refusal or
      // failure, is not the key's: see SignOut.
      if (sign !== undefined) {
        try {
          await json("POST", LOGOUT, () => undefined, undefined, {}, { session: { cookie: sign } });
        } catch {
          // A session this phone could not close is the server's to end at its own
          // lifetime: the verdict about the key above stands, and no sentence about
          // a key that could not be stopped is sent the person from here.
        }
      }
      if (unanswered !== undefined) throw unanswered;
      return { revoked, live: !revoked && !unrecognised };
    },
    async me() {
      // auth-me answers to the holder, so while this connection holds the session
      // that signed in it asks with that. A restored key asks with its own secret,
      // is refused, and the phone reads that as what it is: a key whose person it
      // cannot ask.
      try {
        return await json(
          "GET",
          "/api/v1/auth/me",
          identity.parse,
          undefined,
          {},
          {
            session: session === undefined ? undefined : { cookie: session },
          },
        );
      } catch (error) {
        if (error instanceof ResponseError) throw error;
        // A session that cannot say who it is still lists what it may read.
        return undefined;
      }
    },
    async events({ record = "", offset = 0, limit = PER_PAGE } = {}) {
      const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (record) q.set("record", record);
      try {
        const body = await json("GET", `/api/v1/audit/events?${q}`, trail.parse);
        return { items: body.items ?? [], total: body.total ?? 0 };
      } catch (e) {
        // A caller who may not read the trail simply has none to show.
        if (e instanceof ApiError && (e.status === 403 || e.status === 404))
          return { items: [], total: 0 };
        throw e;
      }
    },
    async catalog(notice: HintNotice = warnOnce) {
      // Legacy compatibility belongs to the normalized core view. The public
      // generated operation must keep its stricter wire response validator.
      const result = await documented((client) =>
        client.get<unknown, unknown, true>({
          url: "/api/v1/app/resources",
          throwOnError: true,
          responseValidator: async (value) => {
            parseCatalog(value, notice);
          },
        }),
      );
      return parseCatalog(result.data, notice);
    },
    async list(e, window = {}) {
      const body = await json("GET", `${e.path}?${listQuery(window)}`, page.parse);
      return { items: body.items ?? [], total: body.total ?? 0 };
    },
    async get(e, id) {
      return json("GET", rowAddress(e, id), row.parse);
    },
    async one(e) {
      return json("GET", e.path, row.parse);
    },
    async replace(e, values, options) {
      // A singleton prints no operation set and no write path of its own, but
      // kit/rest mounts its PUT where it mounts any other write: follow the
      // entry, do not assume the read address.
      return json("PUT", writePath(e), row.parse, values, options);
    },
    async create(e, values, options) {
      return json("POST", writePath(e), row.parse, values, options);
    },
    async update(e, id, values, options) {
      return json("PATCH", `${writePath(e)}/${encodeURIComponent(id)}`, row.parse, values, options);
    },
    async remove(e, id, options) {
      const path = `${writePath(e)}/${encodeURIComponent(id)}`;
      apiPath(path);
      const route = documentedRoute("DELETE", path);
      if (route)
        await documented((client) => route.run(client, path, undefined, options?.signal), {
          idempotencyKey: options?.idempotencyKey,
        });
      else
        await call("DELETE", path, undefined, options?.signal, undefined, options?.idempotencyKey);
    },
    async command(e, id, verb, values, options) {
      return json("POST", commandPath(e, verb, id), row.parse, values, options);
    },
  };
}
