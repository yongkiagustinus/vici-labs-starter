import Constants from "expo-constants";
import { getSessionToken, setSessionToken } from "@/auth/session";
import { SESSION_COOKIE } from "@/auth/constants";
import type {
  Account,
  CreateAccountInput,
  CreateTransactionInput,
  Household,
  SessionUser,
  SyncResponse,
  Transaction,
  UpdateTransactionInput,
} from "./types";

/**
 * Typed HTTP client for the studio template backend.
 *
 * The backend authenticates with an httpOnly `vici_session` JWT cookie set by
 * `POST /api/auth/login|signup`. React Native's fetch has no cookie jar, so we
 * capture the token from the `Set-Cookie` response header on auth and replay it
 * as an explicit `Cookie` header on every subsequent request. The token lives in
 * SecureStore (see auth/session.ts).
 */

export function apiBaseUrl(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl;
  return (process.env.EXPO_PUBLIC_API_BASE_URL || fromExtra || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** True when the failure was a 401 — the caller should route to login. */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = await getSessionToken();
    if (token) finalHeaders["Cookie"] = `${SESSION_COOKIE}=${token}`;
  }

  const res = await fetch(`${apiBaseUrl()}${path}`, { ...rest, headers: finalHeaders });

  // Capture a rotated/issued session cookie if present.
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    if (match) await setSessionToken(match[1]);
  }

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : {};
  if (!res.ok) {
    const message =
      (body as { error?: string }).error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export const api = {
  // --- auth ---
  async login(email: string, password: string): Promise<SessionUser> {
    const { user } = await request<{ ok: boolean; user: SessionUser }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }), auth: false }
    );
    return user;
  },
  async signup(email: string, password: string, name?: string): Promise<SessionUser> {
    const { user } = await request<{ ok: boolean; user: SessionUser }>(
      "/api/auth/signup",
      {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
        auth: false,
      }
    );
    return user;
  },
  async logout(): Promise<void> {
    await request("/api/auth/logout", { method: "POST" }).catch(() => {});
    await setSessionToken(null);
  },

  // --- household ---
  household(): Promise<{ household: Household; memberIds: string[] }> {
    return request("/api/finance/household");
  },

  // --- accounts ---
  async listAccounts(): Promise<Account[]> {
    const { accounts } = await request<{ accounts: Account[] }>(
      "/api/finance/accounts"
    );
    return accounts;
  },
  async createAccount(input: CreateAccountInput): Promise<Account> {
    const { account } = await request<{ account: Account }>(
      "/api/finance/accounts",
      { method: "POST", body: JSON.stringify(input) }
    );
    return account;
  },

  // --- transactions ---
  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const { transaction } = await request<{ transaction: Transaction }>(
      "/api/finance/transactions",
      { method: "POST", body: JSON.stringify(input) }
    );
    return transaction;
  },
  async updateTransaction(
    id: string,
    patch: UpdateTransactionInput
  ): Promise<Transaction> {
    const { transaction } = await request<{ transaction: Transaction }>(
      `/api/finance/transactions/${id}`,
      { method: "PATCH", body: JSON.stringify(patch) }
    );
    return transaction;
  },

  // --- delta sync ---
  sync(since: number): Promise<SyncResponse> {
    return request(`/api/finance/sync?since=${since}`);
  },

  // --- analytics (fire-and-forget) ---
  async track(name: string, props: Record<string, unknown> = {}, userId?: string) {
    await request("/api/track", {
      method: "POST",
      body: JSON.stringify({ name, props, userId }),
    }).catch(() => {});
  },
};
