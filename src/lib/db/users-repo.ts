import { eq } from "drizzle-orm";
import { hasDatabase } from "@/lib/env";
import { getDb } from "./index";
import { users, type NewUser, type User } from "./schema";

/**
 * User repository — a thin abstraction over persistence so auth/billing code
 * never talks to Drizzle directly. Backed by Postgres when DATABASE_URL is set,
 * otherwise by an in-memory Map for zero-infra local dev.
 */
export interface UsersRepo {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: {
    email: string;
    name?: string | null;
    passwordHash: string;
  }): Promise<User>;
  setBilling(
    id: string,
    patch: { billingCustomerId?: string; billingStatus?: string }
  ): Promise<void>;
}

// --- In-memory implementation (dev / no DATABASE_URL) ---

const memStore = new Map<string, User>();

function randomId() {
  // Not cryptographically important — dev fallback only.
  return "mem-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const inMemoryRepo: UsersRepo = {
  async findByEmail(email) {
    for (const u of memStore.values()) {
      if (u.email === email.toLowerCase()) return u;
    }
    return null;
  },
  async findById(id) {
    return memStore.get(id) ?? null;
  },
  async create({ email, name, passwordHash }) {
    const now = new Date();
    const user: User = {
      id: randomId(),
      email: email.toLowerCase(),
      name: name ?? null,
      passwordHash,
      billingCustomerId: null,
      billingStatus: "free",
      createdAt: now,
      updatedAt: now,
    };
    memStore.set(user.id, user);
    return user;
  },
  async setBilling(id, patch) {
    const u = memStore.get(id);
    if (!u) return;
    memStore.set(id, {
      ...u,
      billingCustomerId: patch.billingCustomerId ?? u.billingCustomerId,
      billingStatus: patch.billingStatus ?? u.billingStatus,
      updatedAt: new Date(),
    });
  },
};

// --- Postgres implementation ---

const postgresRepo: UsersRepo = {
  async findByEmail(email) {
    const rows = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  },
  async findById(id) {
    const rows = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ?? null;
  },
  async create({ email, name, passwordHash }) {
    const insert: NewUser = {
      email: email.toLowerCase(),
      name: name ?? null,
      passwordHash,
    };
    const rows = await getDb().insert(users).values(insert).returning();
    return rows[0];
  },
  async setBilling(id, patch) {
    await getDb()
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, id));
  },
};

export const usersRepo: UsersRepo = hasDatabase ? postgresRepo : inMemoryRepo;
