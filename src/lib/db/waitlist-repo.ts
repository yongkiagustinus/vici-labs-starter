import { hasDatabase } from "@/lib/env";
import { getDb } from "./index";
import { waitlist, type WaitlistEntry } from "./finance-schema";

/**
 * Waitlist repository — landing-page early-access capture. Postgres when
 * DATABASE_URL is set, in-memory otherwise (zero-infra local dev). `add` is
 * idempotent on email so a double-submit doesn't error.
 */
export interface WaitlistRepo {
  add(input: {
    email: string;
    platform?: string | null;
    source?: string | null;
  }): Promise<{ entry: WaitlistEntry; created: boolean }>;
  count(): Promise<number>;
}

const mem = new Map<string, WaitlistEntry>();

const inMemoryRepo: WaitlistRepo = {
  async add({ email, platform, source }) {
    const key = email.toLowerCase();
    const existing = mem.get(key);
    if (existing) return { entry: existing, created: false };
    const entry: WaitlistEntry = {
      id: "mem-" + Math.random().toString(36).slice(2),
      email: key,
      platform: platform ?? null,
      source: source ?? null,
      createdAt: new Date(),
    };
    mem.set(key, entry);
    return { entry, created: true };
  },
  async count() {
    return mem.size;
  },
};

const postgresRepo: WaitlistRepo = {
  async add({ email, platform, source }) {
    const rows = await getDb()
      .insert(waitlist)
      .values({ email: email.toLowerCase(), platform, source })
      .onConflictDoNothing({ target: waitlist.email })
      .returning();
    if (rows[0]) return { entry: rows[0], created: true };
    // Conflict: fetch the existing row.
    const { eq } = await import("drizzle-orm");
    const existing = await getDb()
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email.toLowerCase()))
      .limit(1);
    return { entry: existing[0], created: false };
  },
  async count() {
    const rows = await getDb().select().from(waitlist);
    return rows.length;
  },
};

export const waitlistRepo: WaitlistRepo = hasDatabase
  ? postgresRepo
  : inMemoryRepo;
