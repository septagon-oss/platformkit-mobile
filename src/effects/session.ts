// One secure record binds the cookie to its server. The composing adapter
// supplies storage; this module also orders concurrent saves and sign-outs.
const SESSION_KEY = "platformkit.session";

export interface Session {
  readonly baseURL: string;
  readonly cookie?: string;
}

export interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
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
        if (value === null) return undefined;
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
    // Clear authentication atomically while optionally retaining the selected server.
    clear: (baseURL?: string) =>
      ordered(() =>
        storage.setItemAsync(
          SESSION_KEY,
          JSON.stringify({ version: 1, ...(baseURL ? { baseURL } : {}) }),
        ),
      ),
  };
}
