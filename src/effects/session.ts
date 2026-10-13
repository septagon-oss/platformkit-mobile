// One secure record binds the key this phone signs with to its server. The
// composing adapter supplies storage; this module also orders concurrent saves
// and sign-outs, and decides what each version of the record means: version 1
// held the auth module's session cookie, which a phone has no way to send, so
// it is read as the server it names and nothing else.
const SESSION_KEY = "platformkit.session";

export interface Session {
  readonly baseURL: string;
  readonly token?: string;
  readonly tokenId?: string;
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
        const { version, baseURL, token, tokenId } = record as Record<string, unknown>;
        if (version !== 1 && version !== 2) throw new Error("Unsupported saved session version");
        if (baseURL === undefined && token === undefined && tokenId === undefined) return undefined;
        if (typeof baseURL !== "string" || !baseURL) throw new Error("Invalid saved server");
        // A cookie is not a credential this client sends. Reading it as a fault
        // would strand an upgrade on the failure screen over a record that
        // parsed perfectly; the server is real, so it is kept and the person
        // types their password again.
        if (version === 1) return { baseURL };
        if (token === undefined && tokenId === undefined) return { baseURL };
        // Half a key is no key: one without an id cannot be revoked, an id
        // without its key opens nothing. Neither is a state to try to be in.
        if (typeof token !== "string" || !token || typeof tokenId !== "string" || !tokenId)
          throw new Error("Invalid saved sign-in");
        return { baseURL, token, tokenId };
      }),
    save: (session: Session) =>
      ordered(() => storage.setItemAsync(SESSION_KEY, JSON.stringify({ version: 2, ...session }))),
    // Clear the key atomically while optionally retaining the selected server.
    clear: (baseURL?: string) =>
      ordered(() =>
        storage.setItemAsync(
          SESSION_KEY,
          JSON.stringify({ version: 2, ...(baseURL ? { baseURL } : {}) }),
        ),
      ),
  };
}
