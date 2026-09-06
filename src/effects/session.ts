// One secure record binds the cookie to its server. The composing adapter
// supplies storage; this module also orders concurrent saves and sign-outs.
const SESSION_KEY = "platformkit.session";
const URL_KEY = "platformkit.url";
const COOKIE_KEY = "platformkit.cookie";

export interface Session {
  readonly baseURL: string;
  readonly cookie?: string;
}

export interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export function createSessionStore(storage: SecureStorage) {
  let pending: Promise<unknown> = Promise.resolve();

  function ordered<T>(effect: () => Promise<T>): Promise<T> {
    const next = pending.then(effect);
    pending = next.catch(() => undefined);
    return next;
  }

  return {
    load: () =>
      ordered(async (): Promise<Session | undefined> => {
        const value = await storage.getItemAsync(SESSION_KEY);
        if (value === null) {
          // Legacy writes could pair a new server with an old cookie. Retain
          // only the address and require authentication again after upgrading.
          const baseURL = await storage.getItemAsync(URL_KEY);
          const session = baseURL ? { baseURL } : undefined;
          await storage.setItemAsync(SESSION_KEY, JSON.stringify({ version: 1, ...session }));
          await storage.deleteItemAsync(COOKIE_KEY);
          await storage.deleteItemAsync(URL_KEY);
          return session;
        }
        const record: unknown = JSON.parse(value);
        if (!record || typeof record !== "object") throw new Error("Invalid saved session");
        const { version, baseURL, cookie } = record as Record<string, unknown>;
        if (version !== 1) throw new Error("Unsupported saved session version");
        if (baseURL === undefined && cookie === undefined) return undefined;
        if (typeof baseURL !== "string" || !baseURL) throw new Error("Invalid saved server");
        if (cookie === undefined) return { baseURL };
        if (typeof cookie !== "string" || !cookie) throw new Error("Invalid saved cookie");
        return { baseURL, cookie };
      }),
    save: (session: Session) =>
      ordered(() => storage.setItemAsync(SESSION_KEY, JSON.stringify({ version: 1, ...session }))),
    // A tombstone prevents an old two-key session from being restored later.
    clear: (baseURL?: string) =>
      ordered(() =>
        storage.setItemAsync(
          SESSION_KEY,
          JSON.stringify({ version: 1, ...(baseURL ? { baseURL } : {}) }),
        ),
      ),
  };
}
