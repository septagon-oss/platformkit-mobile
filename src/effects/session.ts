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

/**
 * EndedSession names the sign-in whose saved record is being asked for back: the server it
 * signed in at, and the key its connection signed with — nothing where it held no key.
 */
export interface EndedSession {
  readonly baseURL: string;
  readonly token: string | undefined;
}

export interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

/**
 * recordOnDisk is what the stored record says about itself, read leniently: the server it names
 * and the key it carries, anything it cannot name left undefined. An absent record, one this
 * client cannot parse and one naming no server all stand for no session — never a fault, because
 * what to do with a record that is nobody's is the caller's question, not a reader's.
 */
async function recordOnDisk(
  storage: SecureStorage,
): Promise<{ readonly baseURL: string | undefined; readonly token: string | undefined }> {
  const value = await storage.getItemAsync(SESSION_KEY);
  if (value === null) return { baseURL: undefined, token: undefined };
  try {
    const record: unknown = JSON.parse(value);
    if (!record || typeof record !== "object") return { baseURL: undefined, token: undefined };
    const { baseURL, token } = record as Record<string, unknown>;
    return {
      baseURL: typeof baseURL === "string" && baseURL ? baseURL : undefined,
      token: typeof token === "string" ? token : undefined,
    };
  } catch {
    return { baseURL: undefined, token: undefined };
  }
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
    /**
     * forget retires the saved record of the session it is given and keeps the server that
     * session signed in at, so the next cold start still names the workspace. It writes only
     * while the record still names that session — the same server and the same key — because a
     * record carrying another server or another key was written by a sign-in that completed
     * since, and the ending session holds no claim on a key it never signed with: taking that
     * record would strand the sign-in that is live. A record that names no server is no
     * session's and is replaced. The read and the write are one step of the ordering above, so
     * no save can land between them.
     */
    forget: (ended: EndedSession) =>
      ordered(async () => {
        const standing = await recordOnDisk(storage);
        const ours =
          standing.baseURL === undefined ||
          (standing.baseURL === ended.baseURL && standing.token === ended.token);
        if (!ours) return;
        // What is kept is the server, and only where there is one: a shell that was never given
        // an address leaves a record naming nothing rather than one naming an empty address.
        await storage.setItemAsync(
          SESSION_KEY,
          JSON.stringify({ version: 2, ...(ended.baseURL ? { baseURL: ended.baseURL } : {}) }),
        );
      }),
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
