// session.ts is the two facts the shell keeps between launches: where the
// server is and the cookie it was given. Both live in the secure store.
import * as SecureStore from "expo-secure-store";

const URL_KEY = "platformkit.url";
const COOKIE_KEY = "platformkit.cookie";

export interface Session {
  readonly baseURL: string;
  readonly cookie?: string;
}

export async function loadSession(): Promise<Session | undefined> {
  const baseURL = await SecureStore.getItemAsync(URL_KEY);
  if (!baseURL) return undefined;
  const cookie = await SecureStore.getItemAsync(COOKIE_KEY);
  return cookie ? { baseURL, cookie } : { baseURL };
}

export async function saveSession(s: Session): Promise<void> {
  await SecureStore.setItemAsync(URL_KEY, s.baseURL);
  if (s.cookie) await SecureStore.setItemAsync(COOKIE_KEY, s.cookie);
  else await SecureStore.deleteItemAsync(COOKIE_KEY);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(COOKIE_KEY);
}
