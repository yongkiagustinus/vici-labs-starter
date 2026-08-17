import * as SecureStore from "expo-secure-store";

/**
 * Session token persistence. The backend's JWT session cookie value is stored
 * in the OS keychain/keystore via SecureStore, so it survives relaunches and
 * never touches JS-readable storage. The sync cursor and cached user email live
 * alongside it (non-secret, but keychain is fine for the small footprint).
 */

const TOKEN_KEY = "vici.session.token";
const USER_KEY = "vici.session.user";

let cachedToken: string | null | undefined;

export async function getSessionToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? null;
  return cachedToken;
}

export async function setSessionToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getCachedUser(): Promise<{ id: string; email: string } | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setCachedUser(
  user: { id: string; email: string } | null
): Promise<void> {
  if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  else await SecureStore.deleteItemAsync(USER_KEY);
}
