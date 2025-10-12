import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Subscription Tiers Table - Master Configuration
export const subscriptionTiers = pgTable("subscription_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Tier Definition
  name: text("name").notNull().unique(), // "free", "pro", "enterprise"
  displayName: text("display_name").notNull(), // "Free Plan", "Pro Plan"
  description: text("description"),

  // Pricing
  price: integer("price").notNull(), // In cents, monthly price
  yearlyPrice: integer("yearly_price"), // Annual pricing

  // Limits & Features
  maxUsers: integer("max_users").notNull(),
  maxApiCalls: integer("max_api_calls").notNull(),
  features: jsonb("features"), // Feature flags

  // Status
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Organizations Table
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Basic Info
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier
  description: text("description"),

  // Current subscription reference
  currentSubscriptionId: uuid("current_subscription_id").references(() => subscriptions.id),

  // Settings
  isActive: boolean("is_active").default(true),
  settings: jsonb("settings"), // Org-specific configurations

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Subscriptions Table - Instance Data
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  tierId: uuid("tier_id").notNull().references(() => subscriptionTiers.id),

  // Instance details
  status: text("status").notNull().default("active"), // "active", "cancelled", "expired", "past_due"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  billingCycle: text("billing_cycle"), // "monthly", "yearly"

  // External References
  stripeSubscriptionId: text("stripe_subscription_id"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Relations
export const subscriptionTiersRelations = relations(subscriptionTiers, ({ many }) => ({
  subscriptions: many(subscriptions)
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  currentSubscription: one(subscriptions, {
    fields: [organizations.currentSubscriptionId],
    references: [subscriptions.id]
  }),
  subscriptions: many(subscriptions),
  users: many(/* users - imported from user.ts if needed */)
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id]
  }),
  tier: one(subscriptionTiers, {
    fields: [subscriptions.tierId],
    references: [subscriptionTiers.id]
  })
}));

// Insert schemas for validation
export const insertSubscriptionTierSchema = createInsertSchema(subscriptionTiers).omit({
  createdAt: true,
  updatedAt: true
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  createdAt: true,
  updatedAt: true
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  createdAt: true,
  updatedAt: true
});

// Type exports
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type NewSubscriptionTier = typeof subscriptionTiers.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;