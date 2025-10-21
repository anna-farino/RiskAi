import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./user";
import { organizations } from "./organizations";

/**
 * Stripe Customers
 *
 * Maps users and organizations to their Stripe customer records.
 * This is the bridge between our internal entities and Stripe's billing system.
 *
 * CRITICAL CONSTRAINT: Either user_id OR organization_id must be set, never both.
 * - user_id: For individual Free/Pro users
 * - organization_id: For Enterprise organizations
 */
export const stripeCustomers = pgTable(
  "stripe_customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Entity References (XOR constraint: exactly one must be set)
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),

    // Stripe Integration
    stripeCustomerId: text("stripe_customer_id").notNull().unique(), // Starts with "cus_"
    email: text("email").notNull(), // Email for invoices

    // Flexible Metadata Storage
    // Stores: default_payment_method, billing_address, tax_ids
    metadata: jsonb("metadata"),

    // Soft Delete (never hard delete Stripe customers)
    isDeleted: boolean("is_deleted").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // CHECK constraint: exactly one of user_id or organization_id must be set
    checkOneEntity: check(
      "check_one_entity",
      sql`(
        (${table.userId} IS NOT NULL AND ${table.organizationId} IS NULL) OR
        (${table.userId} IS NULL AND ${table.organizationId} IS NOT NULL)
      )`
    ),
  })
);

/**
 * Stripe Webhook Events
 *
 * Logs every webhook received from Stripe for idempotency and debugging.
 *
 * CRITICAL: Without this table, webhooks could be processed multiple times,
 * causing data corruption and billing issues.
 *
 * Idempotency Pattern:
 * 1. Check if stripe_event_id already exists
 * 2. If yes, return "already processed"
 * 3. If no, insert record and process event
 */
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Stripe Event Details
  stripeEventId: text("stripe_event_id").notNull().unique(), // Starts with "evt_"
  eventType: text("event_type").notNull(), // e.g., "customer.subscription.created"
  eventData: jsonb("event_data").notNull(), // Full webhook payload

  // Processing Status
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
  retryCount: integer("retry_count").default(0),

  // Timestamps
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

// Insert schemas for validation
export const insertStripeCustomerSchema = createInsertSchema(stripeCustomers).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertStripeWebhookEventSchema = createInsertSchema(stripeWebhookEvents).omit({
  receivedAt: true,
});

// Type exports
export type StripeCustomer = typeof stripeCustomers.$inferSelect;
export type InsertStripeCustomer = typeof stripeCustomers.$inferInsert;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;
