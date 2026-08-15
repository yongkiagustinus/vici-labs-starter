import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Users table — the minimal shape needed for credentials auth + billing.
 * Extend freely per product; keep the `id` / `email` contract stable so shared
 * auth/billing code keeps working.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 200 }),
  passwordHash: text("password_hash").notNull(),

  // Billing snapshot kept on the user row for a simple single-seat model.
  // Move to a dedicated `subscriptions` table when you add teams/seats.
  billingCustomerId: text("billing_customer_id"),
  billingStatus: varchar("billing_status", { length: 32 })
    .notNull()
    .default("free"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
