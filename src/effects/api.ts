// api.ts is every request the shell makes. The kernel's routes are the same
// ones the web shell's screens call — list, read, create, patch, delete on the
// entry's own path — so there is no second API to keep honest.
//
// The session is the auth module's cookie. A native client is not a browser:
// it keeps the Set-Cookie value it was given and sends it back as Cookie, and
// the kernel's CSRF rule accepts a request that carries neither Sec-Fetch-Site
// nor Origin, because a caller that is not a browser presents what it presents
// deliberately (kit/httpx.SameSite).
import { type Catalog, type Entry, parseCatalog } from "../core/catalog";

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

/** Identity is who a session belongs to, as the auth module answers. */
export interface Identity {
  readonly userId: string;
  readonly email: string;
}

/** AuditEvent is one row of the trail, as the audit module answers. */
export interface AuditEvent {
  readonly id: string;
  readonly name: string;
  readonly occurredAt: string;
  readonly actor?: string;
  readonly payload?: unknown;
}

export interface Page {
  readonly items: readonly Record<string, unknown>[];
  readonly total: number;
}

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

export interface Api {
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
): Api {
  let cookie = initialCookie;
  let generation = 0;
  const base = baseURL.replace(/\/+$/, "");

  /**
   * call is one request, and it answers the body rather than the response
   * because the deadline has to cover reading it. A server that sends headers
   * and then stalls is the same spinner as one that never answers at all, and
   * clearing the timer when fetch resolves left exactly that hole open: fetch
   * resolves on the headers.
   */
  async function call(method: string, path: string, body?: unknown): Promise<string> {
    const started = generation;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const stop = new AbortController();
    const bell = setTimeout(() => stop.abort(), timeout);
    const init: RequestInit = { method, headers, credentials: "omit", signal: stop.signal };
    if (body !== undefined) init.body = JSON.stringify(body);
    let status = 0;
    let text = "";
    try {
      const res = await fetchImpl(base + path, init);
      // The cookie comes off the response this call was answered with, before
      // anything else, because it is what the next call presents.
      const set = res.headers.get("Set-Cookie");
      if (set && started === generation) cookie = set.split(";")[0];
      status = res.status;
      text = await res.text();
    } catch (e) {
      // A request that was cut off by the deadline says so; anything else is
      // the network's own message.
      if (stop.signal.aborted)
        throw new ApiError(
          0,
          `${base} did not answer within ${Math.round(timeout / 1000)} seconds.`,
        );
      throw e;
    } finally {
      clearTimeout(bell);
    }
    if (status >= 400) throw problem(status, text);
    return text;
  }

  function problem(status: number, text: string): ApiError {
    let detail = "";
    const fields: Record<string, string> = {};
    try {
      const p = JSON.parse(text) as { detail?: string; errors?: string[] };
      detail = (p.detail ?? "").replace(/^crud: invalid: /, "");
      for (const e of p.errors ?? []) {
        const i = e.indexOf(": ");
        if (i > 0) fields[e.slice(0, i)] = e.slice(i + 2);
      }
    } catch {
      // not a problem document; the status is what there is to say
    }
    return new ApiError(status, detail, fields);
  }

  const json = <T>(text: string): T => JSON.parse(text) as T;

  return {
    cookie: () => cookie,
    async login(email, password) {
      await call("POST", "/api/v1/auth/login", { email, password });
    },
    async logout() {
      const request = call("POST", "/api/v1/auth/logout");
      generation++;
      cookie = undefined;
      await request;
    },
    async me() {
      try {
        return await json<Identity>(await call("GET", "/api/v1/auth/me"));
      } catch {
        // A session that cannot say who it is still lists what it may read.
        return undefined;
      }
    },
    async events({ record = "", offset = 0, limit = PER_PAGE } = {}) {
      const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (record) q.set("record", record);
      try {
        const body = await json<{ items?: AuditEvent[]; total?: number }>(
          await call("GET", `/api/v1/audit/events?${q}`),
        );
        return { items: body.items ?? [], total: body.total ?? 0 };
      } catch (e) {
        // A caller who may not read the trail simply has none to show.
        if (e instanceof ApiError && (e.status === 403 || e.status === 404))
          return { items: [], total: 0 };
        throw e;
      }
    },
    async catalog() {
      return parseCatalog(await json(await call("GET", "/api/v1/admin/resources")));
    },
    async list(e, { offset = 0, limit = PER_PAGE, sort = "", filters = [] } = {}) {
      const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (sort) q.set("sort", sort);
      for (const f of filters) q.append("filter", f);
      const body = await json<{ items?: Record<string, unknown>[]; total?: number }>(
        await call("GET", `${e.path}?${q}`),
      );
      return { items: body.items ?? [], total: body.total ?? 0 };
    },
    async get(e, id) {
      return json(await call("GET", `${e.path}/${encodeURIComponent(id)}`));
    },
    async create(e, values) {
      return json(await call("POST", e.path, values));
    },
    async update(e, id, values) {
      return json(await call("PATCH", `${e.path}/${encodeURIComponent(id)}`, values));
    },
    async remove(e, id) {
      await call("DELETE", `${e.path}/${encodeURIComponent(id)}`);
    },
    async command(e, id, verb, values) {
      const at = id ? `${e.path}/${encodeURIComponent(id)}` : e.path;
      return json(await call("POST", `${at}/${encodeURIComponent(verb)}`, values));
    },
  };
}
