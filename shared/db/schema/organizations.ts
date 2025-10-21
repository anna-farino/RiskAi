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
  features: jsonb("metadata"), // Feature flags

  //Stripe price idth
  stripePriceId: text("stripe_price_id"),

  // Status
  isActive: boolean("is_active").default(true),

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
  currentSubscriptionId: uuid("current_subscription_id").references(() => subsOrganization.id),

  // Settings
  isActive: boolean("is_active").default(true),
  settings: jsonb("settings"), // Org-specific configurations

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Organization Subscriptions Table (Enterprise tier)
export const subsOrganization = pgTable("subs_organization", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
  organizationSubscriptions: many(subsOrganization)
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  currentSubscription: one(subsOrganization, {
    fields: [organizations.currentSubscriptionId],
    references: [subsOrganization.id]
  }),
  subscriptions: many(subsOrganization),
  users: many(/* users - imported from user.ts if needed */)
}));

export const subsOrganizationRelations = relations(subsOrganization, ({ one }) => ({
  organization: one(organizations, {
    fields: [subsOrganization.organizationId],
    references: [organizations.id]
  }),
  tier: one(subscriptionTiers, {
    fields: [subsOrganization.tierId],
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

export const insertSubsOrganizationSchema = createInsertSchema(subsOrganization).omit({
  createdAt: true,
  updatedAt: true
});

// Type exports
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type NewSubscriptionTier = typeof subscriptionTiers.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type SubsOrganization = typeof subsOrganization.$inferSelect;
export type NewSubsOrganization = typeof subsOrganization.$inferInsert;
