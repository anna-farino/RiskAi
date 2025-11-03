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

/**
 * Stripe Operations Log
 *
 * Tracks every Stripe API call made by our server and correlates with webhook responses.
 * This enables targeted reconciliation by detecting missed webhooks within an hour.
 *
 * Purpose: Reduce API calls by 95% compared to full daily reconciliation
 *
 * Flow:
 * 1. Our server calls Stripe API → Log operation immediately
 * 2. Stripe sends webhook → Mark webhook_received = true
 * 3. Hourly job checks for operations with webhook_received = false (>1 min old)
 * 4. Make targeted API call to verify → Update DB if needed → Mark verified/fixed
 *
 * Data Retention: 7 days (cleaned up daily)
 */
export const stripeOperationsLog = pgTable("stripe_operations_log", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Operation Details
  operationType: text("operation_type").notNull(), // 'create_subscription', 'upgrade_subscription', 'downgrade_subscription', 'cancel_subscription'
  timestamp: timestamp("timestamp").defaultNow().notNull(), // When we made the Stripe API call

  // Identifiers
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull(), // Starts with "cus_"
  stripeSubscriptionId: text("stripe_subscription_id"), // NULL for creates (set later), non-NULL for updates/cancels

  // Request Data
  requestPayload: jsonb("request_payload"), // What we sent to Stripe (for debugging)

  // Webhook Correlation
  webhookReceived: boolean("webhook_received").default(false),
  webhookTimestamp: timestamp("webhook_timestamp"),
  webhookEventId: text("webhook_event_id"), // References stripeWebhookEvents.stripeEventId

  // Verification Status
  verificationStatus: text("verification_status").default("pending").notNull(), // 'pending', 'verified', 'fixed', 'failed'
  verificationTimestamp: timestamp("verification_timestamp"),
  verificationNotes: text("verification_notes"), // Details about what was fixed or why it failed

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for validation
export const insertStripeCustomerSchema = createInsertSchema(stripeCustomers).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertStripeWebhookEventSchema = createInsertSchema(stripeWebhookEvents).omit({
  receivedAt: true,
});

export const insertStripeOperationsLogSchema = createInsertSchema(stripeOperationsLog).omit({
  timestamp: true,
  createdAt: true,
});

// Type exports
export type StripeCustomer = typeof stripeCustomers.$inferSelect;
export type InsertStripeCustomer = typeof stripeCustomers.$inferInsert;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;
export type StripeOperationsLog = typeof stripeOperationsLog.$inferSelect;
export type InsertStripeOperationsLog = typeof stripeOperationsLog.$inferInsert;
