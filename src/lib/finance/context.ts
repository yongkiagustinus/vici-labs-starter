import { getCurrentUser } from "@/lib/auth";
import { financeRepo } from "@/lib/db/finance-repo";
import type { Household } from "@/lib/db/finance-schema";
import type { User } from "@/lib/db/schema";

/**
 * Resolves the authenticated user + their household for a finance route.
 * Returns null when there is no valid session — callers respond 401.
 */
export async function getFinanceContext(): Promise<{
  user: User;
  household: Household;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const household = await financeRepo.getOrCreateHousehold(user.id);
  return { user, household };
}
