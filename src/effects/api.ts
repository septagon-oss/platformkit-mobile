// api.ts is every request the shell makes. The kernel's routes are the same
// ones the web shell's screens call — list and read at the entry's own path,
// and every write at the address the entry names for writes (writePath in
// src/core/derive.ts, which is the entry's own path unless the server printed
// another) — so there is no second API to keep honest.
//
// The session is the auth module's cookie. A native client is not a browser:
// it keeps the Set-Cookie value it was given and sends it back as Cookie, and
// the kernel's CSRF rule accepts a request that carries neither Sec-Fetch-Site
// nor Origin, because a caller that is not a browser presents what it presents
// deliberately (kit/httpx.SameSite).
import {
  type Catalog,
  type Entry,
  type HintNotice,
  parseCatalog,
  CatalogError,
} from "../core/catalog";
import { row, page, identity, trail, issuePath } from "../core/responses";
import { commandPath, writePath } from "../core/derive";
import { keyRefusal } from "../core/outbox";

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

/** Identity is who a session belongs to, as the auth module answers. */
export type Identity = Readonly<Pick<WireIdentity, "userId" | "email">>;

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

/** Served is one row and the language the response that carried it was written in. */
export interface Served {
  readonly row: Record<string, unknown>;
  /** language is the tag `Content-Language` carried, or "" when the answer carried none. */
  readonly language: string;
}

/**
 * preparedForm says a body is already the document a transport sends rather than an object
 * to be turned into one: a standard form, or React Native's, which names its parts to the
 * stream instead of carrying Blobs. The generated serializer builds a form out of an
 * object's entries; run over a form that already exists it turns the form's own internals
 * into a text field, and the server is handed a field named `_parts` and no file.
 */
export function preparedForm(body: unknown): body is FormData {
  if (body instanceof FormData) return true;
  // A form built by another copy of the platform class is still a form: it says what it
  // carries the way the transport reads it, which is the only thing that identifies it.
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { getParts?: unknown }).getParts === "function"
  );
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
  /**
   * idempotencyKey is the header the kernel honours once T-0293 lands; until
   * then the phone sends it and the server ignores it. The outbox mints it
   * before a write's first attempt leaves the phone and keeps it as the row's
   * id, so the attempt that may have landed and the replay that follows name
   * the same write. A request no queue could ever replay carries none.
   */
  readonly idempotencyKey?: string;
  /**
   * lang names the language a write's body is written in. A translatable record is one the
   * server holds in more than a language, and the same PATCH answers two different questions:
   * without the parameter it writes the record, with it the body writes that language's
   * translation and the record is untouched. A sheet therefore says which of the two it is
   * doing rather than leaving the server to guess from the words in its body.
   */
  readonly lang?: string;
}

/**
 * keyed is the options argument a typed write takes besides its own: the
 * idempotency key the queue minted for it, or nothing at all where no queue
 * exists to replay it. A call made without an argument is not the same call as
 * one made with an empty one — the write a phone cannot hold is left exactly the
 * call it was before the queue existed.
 */
export function keyed(
  idempotencyKey: string | undefined,
  lang = "",
): readonly [] | readonly [RequestOptions] {
  if (idempotencyKey === undefined && lang === "") return [];
  return [
    {
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      ...(lang === "" ? {} : { lang }),
    },
  ];
}

/**
 * langQuery is the language member of an address, or nothing at all for a write of the
 * record's own copy. The tag goes on as the server printed it, percent-encoded: a language
 * tag is the server's own string, not one this phone may spell.
 */
export function langQuery(options?: RequestOptions): string {
  return options?.lang === undefined || options.lang === ""
    ? ""
    : `?lang=${encodeURIComponent(options.lang)}`;
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
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  catalog(notice?: HintNotice): Promise<Catalog>;
  /** list is a window of rows, in an order, through equality filters spelled field:value. */
  list(e: Entry, q?: Window): Promise<Page>;
  get(e: Entry, id: string): Promise<Record<string, unknown>>;
  /**
   * served is a row together with the language the answer says it arrived in. A record with
   * a translatable field is read through a door that names a language, and `Content-Language`
   * is the tag the words on screen are written in: whoever later sends words back from that
   * reading has to name the same tag, because a write that names no language writes the
   * record rather than the language it was read in. A read that named none — a monolingual
   * record, a response that said nothing — answers "", which is the record's own copy.
   */
  served(e: Entry, id: string): Promise<Served>;
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
  /**
   * upload stores one file: a multipart POST at the entry's write address, answered with the
   * row the server made for the bytes. No JSON call can carry it — the document gives a file's
   * bytes one door, and it is a streamed form rather than a body — so the generated operation
   * is walked directly and its answer is read as any other row.
   */
  upload(e: Entry, form: FormData, query?: string): Promise<Record<string, unknown>>;
  /** cookie is the session the shell should persist, or undefined when signed out. */
  readonly cookie: () => string | undefined;
}

/**
 * TIMEOUT is how long a request may take before this gives up. A phone leaves
 * networks, changes them and keeps a saved server it can no longer reach, and
 * fetch waits for none of that: without a deadline the app sits on a spinner
 * with nothing to say.
 */
export const TIMEOUT = 15_000;

/** TAG is a language tag a header can carry: characters a header allows, and nothing that could end the line. */
const TAG = /^[A-Za-z0-9-]{1,35}$/;

/**
 * acceptLanguage is the phone saying which language its person reads in, in the order it
 * will read it: the device's own tag, that language on its own behind it, and the kit's
 * fallback last. Content negotiation is the transport's because every answer this phone
 * reads — a row, a catalogue, a refusal — arrives in words, and a server can only honour a
 * preference it is told. The device is asked per request, since a language can change
 * while the app runs and a saved server must not go on answering in the words of a person
 * who no longer reads them. A platform that names no tag, or names one no header could
 * carry, says nothing: an invented preference would ask for words nobody chose.
 */
export function acceptLanguage(): string | undefined {
  const device = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
  const language = device.split("-")[0]!.toLowerCase();
  const wanted: string[] = [];
  if (TAG.test(device)) wanted.push(device);
  if (TAG.test(language) && language !== device.toLowerCase()) wanted.push(language);
  if (wanted.length === 0) return undefined;
  const list = wanted.map((tag, at) => (at === 0 ? tag : `${tag};q=0.9`));
  if (!wanted.some((tag) => tag.toLowerCase().startsWith("en"))) list.push("en;q=0.5");
  return list.join(", ");
}

/**
 * contentLanguage is the tag a response said its body was written in, or "" for an answer
 * that named none. Only the first tag of a list is read, and a tag this phone could not put
 * back in an address counts as nothing said: such a row is the record's own copy and is
 * written the way it always was — without a language.
 */
export function contentLanguage(headers: Headers): string {
  const tag = (headers.get("Content-Language") ?? "").split(",")[0]!.trim();
  return TAG.test(tag) ? tag : "";
}

export function createApi(
  baseURL: string,
  fetchImpl: typeof fetch = fetch,
  initialCookie?: string,
  timeout: number = TIMEOUT,
  /** refused is called with nothing but the fact that this server answered 401 for this
   * transport. Every request — generated operation, `me`, the catalogue, the event trail,
   * a write — is answered at one line, so this is the one place a session's refusal can
   * be heard: the transport reports it, and the shell is what decides what it means. */
  refused?: () => void,
): Api {
  let cookie = initialCookie;
  let generation = 0;
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
      generation: number;
    },
    idempotencyKey?: string,
  ): Promise<{ text: string; status: number; headers: Headers; bytes?: ArrayBuffer }> {
    apiPath(path);
    if (method === "GET" && body !== undefined)
      throw new TypeError("A GET request cannot have a body.");
    if (signal?.aborted) throw cancelled();
    const started = prepared?.generation ?? generation;
    const headers: Record<string, string> = prepared
      ? Object.fromEntries(prepared.headers.entries())
      : {};
    headers.Accept = "application/json";
    // Whose words to answer in. A translatable record the server holds in another
    // language is served in the tenant's own and says so (`_i18n`); with no preference
    // printed there is nothing for the server to have honoured.
    const language = acceptLanguage();
    if (language !== undefined) headers["Accept-Language"] = language;
    delete headers.cookie;
    delete headers.origin;
    delete headers["sec-fetch-site"];
    if (body !== undefined) headers["Content-Type"] = "application/json";
    // A header is one token or nothing: a value with a CR or an LF in it would
    // be a second request, not a key, and no caller's choice may open that door.
    if (idempotencyKey !== undefined) {
      const refused = keyRefusal(idempotencyKey);
      if (refused) throw new TypeError(refused);
      headers["Idempotency-Key"] = idempotencyKey;
    }
    const sendingCookie = prepared ? prepared.cookie : cookie;
    if (sendingCookie) headers.Cookie = sendingCookie;
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
      // The cookie comes off the response this call was answered with, before
      // anything else, because it is what the next call presents.
      const set = res.headers.get("Set-Cookie");
      if (set && started === generation) cookie = set.split(";")[0];
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
    const fields: [string, string][] = [];
    try {
      const p: unknown = JSON.parse(text);
      if (!p || typeof p !== "object" || Array.isArray(p)) return new ApiError(status, "");
      const body = p as Record<string, unknown>;
      if (typeof body.detail === "string") detail = body.detail.replace(/^crud: invalid: /, "");
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
    return new ApiError(status, detail, Object.fromEntries(fields));
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
    const { value, status } = await read(method, path, body, signal, idempotencyKey);
    try {
      return validate(value);
    } catch {
      // A validator's exception can contain private response values. Report
      // the endpoint and status without copying its message into the UI.
      throw new ResponseError(status, `Invalid response at ${path}: response validation failed.`);
    }
  }

  function documented<T>(
    operation: (client: Client) => Promise<T>,
    idempotencyKey?: string,
  ): Promise<T> {
    const sessionCookie = cookie;
    const sessionGeneration = generation;
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
      if (preparedForm(body)) request.headers.delete("Content-Type");
      const result = await call(
        method,
        path,
        undefined,
        request.signal,
        {
          body,
          headers: request.headers,
          cookie: sessionCookie,
          generation: sessionGeneration,
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
      // A multipart form the caller built itself is sent as it was built: the operation's
      // serializer knows how to make a form from an object and nothing else, and the bytes
      // of a picture a phone took are already in the form this transport will stream.
      bodies.set(
        request,
        preparedForm(options.body)
          ? options.body
          : ((getValidRequestBody(options) as BodyInit | undefined) ?? null),
      );
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
    signal?: AbortSignal,
    idempotencyKey?: string,
  ): Promise<{ value: unknown; status: number; headers: Headers }> {
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
      const result = await documented(
        (client) => route.run(client, path, wireBody, signal),
        idempotencyKey,
      );
      return {
        status: result.response.status,
        value: result.data,
        headers: result.response.headers,
      };
    }
    const { text, status, headers } = await call(
      method,
      path,
      body,
      signal,
      undefined,
      idempotencyKey,
    );
    try {
      return { status, value: text === "" ? undefined : JSON.parse(text), headers };
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
  ): Promise<T> {
    const { value, status } = await read(
      method,
      path,
      body,
      options.signal,
      options.idempotencyKey,
    );
    try {
      return validate(value);
    } catch (error) {
      throw new ResponseError(
        status,
        `Invalid response at ${path}: ${error instanceof CatalogError ? error.at : issuePath(error)} failed validation.`,
      );
    }
  }

  async function served(e: Entry, id: string): Promise<Served> {
    const path = rowAddress(e, id);
    const { value, status, headers } = await read("GET", path);
    try {
      return { row: row.parse(value), language: contentLanguage(headers) };
    } catch (error) {
      throw new ResponseError(
        status,
        `Invalid response at ${path}: ${error instanceof CatalogError ? error.at : issuePath(error)} failed validation.`,
      );
    }
  }

  return {
    request,
    operations: bindOperations(documented),
    cookie: () => cookie,
    async login(email, password) {
      await json("POST", "/api/v1/auth/login", identity.parse, { email, password });
    },
    async logout() {
      const request = json("POST", "/api/v1/auth/logout", () => undefined);
      generation++;
      cookie = undefined;
      await request;
    },
    async me() {
      try {
        return await json("GET", "/api/v1/auth/me", identity.parse);
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
      return (await served(e, id)).row;
    },
    served,
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
      // The language belongs to the address, not the body: the kernel reads it as a parameter
      // of the route, and a held write replays by the address it was filed under.
      return json(
        "PATCH",
        `${writePath(e)}/${encodeURIComponent(id)}${langQuery(options)}`,
        row.parse,
        values,
        options,
      );
    },
    async remove(e, id, options) {
      const path = `${writePath(e)}/${encodeURIComponent(id)}`;
      apiPath(path);
      const route = documentedRoute("DELETE", path);
      if (route)
        await documented(
          (client) => route.run(client, path, undefined, options?.signal),
          options?.idempotencyKey,
        );
      else
        await call("DELETE", path, undefined, options?.signal, undefined, options?.idempotencyKey);
    },
    async command(e, id, verb, values, options) {
      return json("POST", commandPath(e, verb, id), row.parse, values, options);
    },
    async upload(e, form, query = "") {
      const path = `${writePath(e)}${query}`;
      apiPath(path);
      const route = documentedRoute("POST", path);
      if (route?.multipart !== true)
        throw new TypeError(`No documented multipart upload at ${writePath(e)}.`);
      const result = await documented((client) => route.run(client, path, form));
      try {
        return row.parse(result.data);
      } catch (error) {
        throw new ResponseError(
          result.response.status,
          `Invalid response at ${path}: ${error instanceof CatalogError ? error.at : issuePath(error)} failed validation.`,
        );
      }
    },
  };
}
