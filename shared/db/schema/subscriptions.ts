import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./user";
import { subscriptionTiers } from "./organizations";

/**
 * Individual User Subscriptions (Free & Pro tiers)
 *
 * This table stores subscriptions for individual users who are NOT part of an organization.
 * When a user has organizationId=NULL, their subscription is stored here.
 *
 * Key Design Principles:
 * - Minimal core fields with flexible JSONB metadata
 * - Metadata stores: trial info, billing cycles, payment methods, usage counters, promo codes
 * - Promote fields from metadata to columns only when you need to query/index them
 */
export const subsUser = pgTable("subs_user", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Foreign Keys
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tierId: uuid("tier_id")
    .notNull()
    .references(() => subscriptionTiers.id),

  // Subscription Status & Lifecycle
  status: text("status").notNull().default("active"), // "active", "trialing", "past_due", "cancelled", "expired"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // NULL = ongoing subscription

  // Stripe Integration (NULL for Free tier users)
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),

  // Flexible Metadata Storage
  // Stores: trial_end_date, billing_cycle, current_period, payment_method, usage counters, cancellation info, promo codes
  metadata: jsonb("metadata"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Relations for subsUser table
 */
export const subsUserRelations = relations(subsUser, ({ one }) => ({
  user: one(users, {
    fields: [subsUser.userId],
    references: [users.id],
  }),
  tier: one(subscriptionTiers, {
    fields: [subsUser.tierId],
    references: [subscriptionTiers.id],
  }),
}));

// Insert schema for validation
export const insertSubsUserSchema = createInsertSchema(subsUser).omit({
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type SubsUser = typeof subsUser.$inferSelect;
export type InsertSubsUser = typeof subsUser.$inferInsert;
