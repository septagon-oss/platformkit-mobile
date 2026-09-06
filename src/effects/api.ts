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

export interface Page {
  readonly items: readonly Record<string, unknown>[];
  readonly total: number;
}

export interface Api {
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  catalog(): Promise<Catalog>;
  list(e: Entry, page: number, sort: string): Promise<Page>;
  get(e: Entry, id: string): Promise<Record<string, unknown>>;
  create(e: Entry, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(e: Entry, id: string, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  remove(e: Entry, id: string): Promise<void>;
  /** cookie is the session the shell should persist, or undefined when signed out. */
  readonly cookie: () => string | undefined;
}

export function createApi(
  baseURL: string,
  fetchImpl: typeof fetch = fetch,
  initialCookie?: string,
): Api {
  let cookie = initialCookie;
  let generation = 0;
  const base = baseURL.replace(/\/+$/, "");

  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    const started = generation;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const init: RequestInit = { method, headers, credentials: "omit" };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetchImpl(base + path, init);
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
    async catalog() {
      return parseCatalog(await json(await call("GET", "/api/v1/admin/resources")));
    },
    async list(e, page, sort) {
      const q = new URLSearchParams({
        limit: String(PER_PAGE),
        offset: String(Math.max(page - 1, 0) * PER_PAGE),
      });
      if (sort) q.set("sort", sort);
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
