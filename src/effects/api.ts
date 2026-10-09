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
import { type Catalog, type Entry, parseCatalog, CatalogError } from "../core/catalog";
import { row, page, identity, trail, issuePath } from "../core/responses";
import { commandPath, writePath } from "../core/derive";

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

export type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  readonly signal?: AbortSignal;
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
  catalog(): Promise<Catalog>;
  /** list is a window of rows, in an order, through equality filters spelled field:value. */
  list(e: Entry, q?: Window): Promise<Page>;
  get(e: Entry, id: string): Promise<Record<string, unknown>>;
  /**
   * one is the row of a singleton, which lives at the entry's own path: a
   * tenant has one and it has no id to ask for. replace is how it is written,
   * because a singleton's write is a PUT of the whole of it.
   */
  one(e: Entry): Promise<Record<string, unknown>>;
  replace(e: Entry, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  create(e: Entry, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(e: Entry, id: string, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  remove(e: Entry, id: string): Promise<void>;
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
  ): Promise<Record<string, unknown>>;
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
    delete headers.cookie;
    delete headers.origin;
    delete headers["sec-fetch-site"];
    if (body !== undefined) headers["Content-Type"] = "application/json";
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
    try {
      if (prepared?.body != null) init.body = prepared.body;
      if (body !== undefined) {
        init.body = JSON.stringify(body);
        if (init.body === undefined) throw new TypeError("The request body is not JSON.");
      }
      const res = await fetchImpl(base + path, init);
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
    { signal }: RequestOptions = {},
  ): Promise<T> {
    if (typeof validate !== "function") throw new TypeError("A response validator is required.");
    const { value, status } = await read(method, path, body, signal);
    try {
      return validate(value);
    } catch {
      // A validator's exception can contain private response values. Report
      // the endpoint and status without copying its message into the UI.
      throw new ResponseError(status, `Invalid response at ${path}: response validation failed.`);
    }
  }

  async function documented<T>(operation: (client: Client) => Promise<T>): Promise<T> {
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
      if (body instanceof FormData) request.headers.delete("Content-Type");
      const result = await call(method, path, undefined, request.signal, {
        body,
        headers: request.headers,
        cookie: sessionCookie,
        generation: sessionGeneration,
      });
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
    signal?: AbortSignal,
  ): Promise<{ value: unknown; status: number }> {
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
      const result = await documented((client) => route.run(client, path, wireBody, signal));
      return { status: result.response.status, value: result.data };
    }
    const { text, status } = await call(method, path, body, signal);
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
  ): Promise<T> {
    const { value, status } = await read(method, path, body);
    try {
      return validate(value);
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
    async catalog() {
      // Legacy compatibility belongs to the normalized core view. The public
      // generated operation must keep its stricter wire response validator.
      const result = await documented((client) =>
        client.get<unknown, unknown, true>({
          url: "/api/v1/app/resources",
          throwOnError: true,
          responseValidator: async (value) => {
            parseCatalog(value);
          },
        }),
      );
      return parseCatalog(result.data);
    },
    async list(e, { offset = 0, limit = PER_PAGE, sort = "", filters = [] } = {}) {
      const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (sort) q.set("sort", sort);
      for (const f of filters) q.append("filter", f);
      const body = await json("GET", `${e.path}?${q}`, page.parse);
      return { items: body.items ?? [], total: body.total ?? 0 };
    },
    async get(e, id) {
      return json("GET", `${e.path}/${encodeURIComponent(id)}`, row.parse);
    },
    async one(e) {
      return json("GET", e.path, row.parse);
    },
    async replace(e, values) {
      // A singleton prints no operation set and no write path of its own, but
      // kit/rest mounts its PUT where it mounts any other write: follow the
      // entry, do not assume the read address.
      return json("PUT", writePath(e), row.parse, values);
    },
    async create(e, values) {
      return json("POST", writePath(e), row.parse, values);
    },
    async update(e, id, values) {
      return json("PATCH", `${writePath(e)}/${encodeURIComponent(id)}`, row.parse, values);
    },
    async remove(e, id) {
      const path = `${writePath(e)}/${encodeURIComponent(id)}`;
      apiPath(path);
      const route = documentedRoute("DELETE", path);
      if (route) await documented((client) => route.run(client, path));
      else await call("DELETE", path);
    },
    async command(e, id, verb, values) {
      return json("POST", commandPath(e, verb, id), row.parse, values);
    },
  };
}
