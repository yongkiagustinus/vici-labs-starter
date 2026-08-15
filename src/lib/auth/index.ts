import { cookies } from "next/headers";
import { usersRepo } from "@/lib/db/users-repo";
import type { User } from "@/lib/db/schema";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "./session";

/**
 * Server-side auth helpers for Route Handlers and Server Components.
 * Uses the request cookie store; safe in the Node runtime.
 */

/** Read + verify the current session, returning the full user (or null). */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return usersRepo.findById(session.sub);
}

/** Issue a session cookie for a user. */
export async function startSession(user: User): Promise<void> {
  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions);
}

/** Clear the session cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE } from "./session";
