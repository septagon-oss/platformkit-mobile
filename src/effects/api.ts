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
   * events is a window of the audit trail, newest first. The trail cannot be
   * asked about one record, so a caller that wants a record's activity asks
   * for a window and keeps what is about it.
   */
  events(limit?: number): Promise<readonly AuditEvent[]>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  catalog(): Promise<Catalog>;
  /** list is a window of rows, in an order, through equality filters spelled field:value. */
  list(e: Entry, q?: Window): Promise<Page>;
  get(e: Entry, id: string): Promise<Record<string, unknown>>;
  create(e: Entry, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(e: Entry, id: string, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  remove(e: Entry, id: string): Promise<void>;
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

  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    const started = generation;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const stop = new AbortController();
    const bell = setTimeout(() => stop.abort(), timeout);
    const init: RequestInit = { method, headers, credentials: "omit", signal: stop.signal };
    if (body !== undefined) init.body = JSON.stringify(body);
    let res: Response;
    try {
      res = await fetchImpl(base + path, init);
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
    const set = res.headers.get("Set-Cookie");
    if (set && started === generation) cookie = set.split(";")[0];
    if (res.status >= 400) throw await problem(res);
    return res;
  }

  async function problem(res: Response): Promise<ApiError> {
    let detail = "";
    const fields: Record<string, string> = {};
    try {
      const p = (await res.json()) as { detail?: string; errors?: string[] };
      detail = (p.detail ?? "").replace(/^crud: invalid: /, "");
      for (const e of p.errors ?? []) {
        const i = e.indexOf(": ");
        if (i > 0) fields[e.slice(0, i)] = e.slice(i + 2);
      }
    } catch {
      // not a problem document; the status is what there is to say
    }
    return new ApiError(res.status, detail, fields);
  }

  const json = async <T>(res: Response): Promise<T> => (await res.json()) as T;

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
    async events(limit = 100) {
      const q = new URLSearchParams({ limit: String(limit), offset: "0" });
      try {
        const body = await json<{ items?: AuditEvent[] }>(
          await call("GET", `/api/v1/audit/events?${q}`),
        );
        return body.items ?? [];
      } catch (e) {
        // A caller who may not read the trail simply has none to show.
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return [];
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
  };
}
