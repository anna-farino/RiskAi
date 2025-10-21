# Subscription System - Minimal Implementation Reference

**Altair News Platform • January 2025**

## Implementation Philosophy

This is a **minimal but production-ready** subscription system. We start with only 4 core tables and use flexible JSONB metadata fields instead of creating dozens of specialized tables.

**Core Principle:** Store critical data in structured columns. Store everything else in metadata. Promote fields from metadata to columns only when you need to query or index them.

---

## Architecture Overview

### Dual-Subscription Model

The platform uses a **dual-subscription architecture** because we bill two fundamentally different types of customers:

| Aspect | Individual (Free/Pro) | Organization (Enterprise) |
|--------|----------------------|---------------------------|
| **Table** | `subs_user` (NEW) | `subs_organization` (EXISTING, renamed) |
| **Foreign Key** | `user_id` → users.id | `organization_id` → organizations.id |
| **When Used** | User has NO organizationId | User HAS organizationId |
| **Billed To** | Individual person | Organization/company |
| **Number of Users** | Always 1 | 1 to unlimited |
| **Upgrade Behavior** | Free → Pro: UPDATE same row | Pro → Enterprise: END old row, CREATE new row |

### Why Two Tables?

Individual and organization subscriptions are **different billing entities** with different lifecycles, relationships, and management needs. Separating them keeps the schema clean and queries simple.

---

## The 4 Core Tables

1. **`subscription_tiers`** - Master list of plans (ALREADY EXISTS)
2. **`subs_user`** - Individual Free/Pro subscriptions (CREATE NEW)
3. **`stripe_customers`** - User/Org → Stripe mapping (CREATE NEW)
4. **`stripe_webhook_events`** - Webhook idempotency (CREATE NEW)

### What About Other Tables?

Tables like `payment_methods`, `subscription_usage`, `invoices`, etc., are **not needed initially**:
- Store in **JSONB metadata fields** for flexible data like payment method details, usage counters
- Store in **Stripe's API** for invoices, charges, refunds (query when needed)
- Promote to dedicated tables later when you need complex queries or analytics

---

## Database Schema

### Table 1: subscription_tiers (EXISTING)

**Purpose:** Master configuration of available subscription plans

**Key Fields:**
- `id` (UUID) - Primary key
- `name` (TEXT UNIQUE) - Machine name: "free", "pro", "enterprise"
- `display_name` (TEXT) - Human-readable: "Free Plan", "Pro Plan"
- `price` (INTEGER) - Monthly price in cents (Free=0, Pro=2900)
- `yearly_price` (INTEGER) - Annual price if offering yearly billing
- `max_users` (INTEGER) - Max team members (Free/Pro=1, Enterprise=-1)
- `max_api_calls` (INTEGER) - Monthly API quota (Free=1000, Pro=10000, Enterprise=-1)
- `features` (JSONB) - Feature flags: `{ "maxSources": 5, "maxKeywords": 10, "advancedAnalytics": false }`
- `is_active` (BOOLEAN) - Can hide tiers without deleting
- `sort_order` (INTEGER) - Display order in pricing page

---

### Table 2: subs_user (NEW)

**Purpose:** Individual user subscriptions for Free & Pro tiers

**Minimal Schema Strategy:** Only 8 core fields + metadata JSONB for everything else

**Core Fields:**
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users.id (ON DELETE CASCADE)
- `tier_id` (UUID) - Foreign key to subscription_tiers.id
- `status` (TEXT) - "active", "trialing", "past_due", "cancelled", "expired"
- `start_date` (TIMESTAMP) - When subscription began (never changes)
- `end_date` (TIMESTAMP) - When subscription ended (NULL = ongoing)
- `stripe_customer_id` (TEXT) - Stripe customer ID (NULL for Free users)
- `stripe_subscription_id` (TEXT) - Stripe subscription ID (NULL for Free users)
- `metadata` (JSONB) - Flexible storage (see below)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Metadata Structure:**
```json
{
  "trial_end_date": "2025-01-22T00:00:00Z",
  "billing_cycle": "monthly",
  "current_period": {
    "start": "2025-01-15T00:00:00Z",
    "end": "2025-02-15T00:00:00Z"
  },
  "payment_method": {
    "id": "pm_ABC123",
    "brand": "visa",
    "last4": "4242",
    "exp_month": 12,
    "exp_year": 2026
  },
  "usage": {
    "period_start": "2025-01-01",
    "sources_used": 3,
    "keywords_used": 7,
    "api_calls": 245
  },
  "cancellation": {
    "cancel_at_period_end": false,
    "reason": null
  },
  "promo_code": "LAUNCH2024"
}
```

---

### Table 3: subs_organization (EXISTING - RENAME)

**Purpose:** Organization subscriptions for Enterprise tier

**Action Required:** Rename existing `subscriptions` table to `subs_organization`

**Fields:**
- `id` (UUID) - Primary key
- `organization_id` (UUID) - Foreign key to organizations.id
- `tier_id` (UUID) - Foreign key to subscription_tiers.id
- `status` (TEXT) - Same as subs_user
- `start_date` (TIMESTAMP)
- `end_date` (TIMESTAMP)
- `billing_cycle` (TEXT) - "monthly" or "yearly"
- `stripe_subscription_id` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### Table 4: stripe_customers (NEW)

**Purpose:** Maps users/organizations to Stripe customer records

**🚨 CRITICAL:** Cannot bill anyone without this table

**Fields:**
- `id` (UUID) - Primary key
- `user_id` (UUID) - If individual customer (NULL for org)
- `organization_id` (UUID) - If org customer (NULL for individual)
- `stripe_customer_id` (TEXT UNIQUE) - Stripe's customer ID (starts with "cus_")
- `email` (TEXT) - Email for invoices
- `metadata` (JSONB) - Billing address, tax IDs, default payment method
- `is_deleted` (BOOLEAN) - Soft delete (never hard delete Stripe customers)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Constraint:** Either `user_id` OR `organization_id` must be set, never both (CHECK constraint)

**Metadata Structure:**
```json
{
  "default_payment_method": "pm_ABC123",
  "billing_address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94102",
    "country": "US"
  },
  "tax_ids": [
    { "type": "eu_vat", "value": "DE123456789" }
  ]
}
```

---

### Table 5: stripe_webhook_events (NEW)

**Purpose:** Logs every webhook from Stripe for idempotency and debugging

**🚨 CRITICAL:** Without this, you'll process webhooks multiple times causing data corruption

**Fields:**
- `id` (UUID) - Primary key
- `stripe_event_id` (TEXT UNIQUE) - Stripe's event ID (starts with "evt_")
- `event_type` (TEXT) - What happened: "customer.subscription.created", etc.
- `event_data` (JSONB) - Full webhook payload
- `processed` (BOOLEAN) - Successfully handled?
- `processed_at` (TIMESTAMP)
- `processing_error` (TEXT)
- `retry_count` (INTEGER)
- `received_at` (TIMESTAMP)

**Idempotency Pattern:**
```typescript
if (await eventExists(evt_id)) return "already processed";
```

---

## Drizzle Schema Definitions

### subs_user

```typescript
// shared/db/schema/subscriptions.ts
import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./user";
import { subscriptionTiers } from "./organizations";

export const subsUser = pgTable("subs_user", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tierId: uuid("tier_id")
    .notNull()
    .references(() => subscriptionTiers.id),

  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),

  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export type SubsUser = typeof subsUser.$inferSelect;
export type InsertSubsUser = typeof subsUser.$inferInsert;
```

### subs_organization

```typescript
export const subsOrganization = pgTable("subs_organization", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  tierId: uuid("tier_id")
    .notNull()
    .references(() => subscriptionTiers.id),

  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  billingCycle: text("billing_cycle"),
  stripeSubscriptionId: text("stripe_subscription_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subsOrganizationRelations = relations(subsOrganization, ({ one }) => ({
  organization: one(organizations, {
    fields: [subsOrganization.organizationId],
    references: [organizations.id],
  }),
  tier: one(subscriptionTiers, {
    fields: [subsOrganization.tierId],
    references: [subscriptionTiers.id],
  }),
}));

export type SubsOrganization = typeof subsOrganization.$inferSelect;
export type InsertSubsOrganization = typeof subsOrganization.$inferInsert;
```

### stripe_customers

```typescript
// shared/db/schema/stripe.ts
import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./user";
import { organizations } from "./organizations";

export const stripeCustomers = pgTable("stripe_customers", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),

  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  email: text("email").notNull(),

  metadata: jsonb("metadata"),

  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  checkOneEntity: sql`CHECK (
    (user_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND organization_id IS NOT NULL)
  )`
}));

export type StripeCustomer = typeof stripeCustomers.$inferSelect;
export type InsertStripeCustomer = typeof stripeCustomers.$inferInsert;
```

### stripe_webhook_events

```typescript
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),

  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  eventData: jsonb("event_data").notNull(),

  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
  retryCount: integer("retry_count").default(0),

  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;
```

---

## Upgrade Flow

### Stage 1: User Signs Up (Free Tier)

**Database State:**
- `users`: 1 row (organizationId=NULL)
- `subs_user`: 1 row (tier=free, status=active, stripe fields=NULL)
- `stripe_customers`: 0 rows

**Operations:**
1. Create user in users table
2. Create Free subscription in subs_user (no Stripe involvement)

---

### Stage 2: User Upgrades to Pro

**Key Insight: It's an UPDATE operation**

**Database State:**
- `users`: 1 row (no changes)
- `subs_user`: 1 row (UPDATED: tier=pro, status=trialing, Stripe IDs added)
- `stripe_customers`: 1 row (NEW)

**Operations:**
1. User enters payment via Stripe Checkout
2. Create Stripe customer
3. Insert into `stripe_customers`
4. Create Stripe subscription with 7-day trial
5. **UPDATE existing `subs_user` row** (change tier to pro, add Stripe IDs, populate metadata)

**Important:** We UPDATE the existing row, not create a new one. This preserves subscription history.

---

### Stage 3: User Upgrades to Enterprise

**Key Insight: Old row ended, new row created in different table**

**Database State:**
- `users`: 1 row (organizationId=org-1)
- `subs_user`: 1 row (status=cancelled, end_date set)
- `subs_organization`: 1 row (NEW, tier=enterprise, status=active)
- `stripe_customers`: 2 rows (user + org)
- `organizations`: 1 row (NEW)

**Operations:**
1. Show "Create Organization" form
2. Create organization record
3. Create Stripe customer for organization
4. Insert into `stripe_customers` (organizationId set, userId=NULL)
5. Create Stripe subscription for org
6. **INSERT new row in `subs_organization`**
7. Update user.organizationId
8. **END old `subs_user` row** (status=cancelled, end_date=NOW())
9. Cancel old Stripe subscription

**Important:** This is a fundamentally different billing entity, so we create a new row in a different table.

---

## Stripe Integration

### Setup Steps

1. Install Stripe SDK: `npm install stripe`
2. Create Stripe account (test mode)
3. Create Products & Prices (Free, Pro)
4. Set up Webhooks:
   - Local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - Production: Add webhook endpoint in Stripe Dashboard
5. Environment Variables:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Critical Webhooks to Handle

| Event | What It Means | Action |
|-------|---------------|--------|
| `customer.subscription.created` | New subscription started | Update subs_user with Stripe IDs |
| `customer.subscription.updated` | Subscription changed | Update subs_user status, metadata |
| `customer.subscription.deleted` | Subscription cancelled | Set status=cancelled, end_date=NOW() |
| `invoice.payment_succeeded` | Payment went through | Update status=active, current_period in metadata |
| `invoice.payment_failed` | Payment failed | Set status=past_due, email user, retry |

### Webhook Handler Pattern

```typescript
export async function handleStripeWebhook(req: Request) {
  // 1. Verify webhook signature
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  // 2. Check idempotency (already processed?)
  const existing = await db.query.stripeWebhookEvents.findFirst({
    where: eq(stripeWebhookEvents.stripeEventId, event.id)
  });
  if (existing) return "already processed";

  // 3. Log the event
  await db.insert(stripeWebhookEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    eventData: event.data,
    processed: false
  });

  // 4. Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
    // ... other cases
  }

  // 5. Mark as processed
  await db.update(stripeWebhookEvents)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(stripeWebhookEvents.stripeEventId, event.id));
}
```

---

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Rename `subscriptions` table to `subs_organization`
- [ ] Create `subs_user` table (minimal schema with metadata)
- [ ] Create `stripe_customers` table (with CHECK constraint)
- [ ] Create `stripe_webhook_events` table
- [ ] Add indexes: `subs_user(user_id)`, `stripe_customers(stripe_customer_id)`
- [ ] Seed `subscription_tiers` with Free & Pro tiers

### Phase 2: Stripe Setup
- [ ] Create Stripe account (test mode)
- [ ] Create Products: "Free Plan", "Pro Plan"
- [ ] Create Prices: $0/month (Free), $29/month (Pro)
- [ ] Install Stripe CLI for local testing
- [ ] Add environment variables

### Phase 3: User Registration
- [ ] On signup, auto-create Free subscription in `subs_user`
- [ ] Test: New user has Free tier access
- [ ] Test: User cannot exceed Free limits

### Phase 4: Pro Upgrade
- [ ] Build "Upgrade to Pro" UI with Stripe Checkout
- [ ] On checkout success: Create Stripe customer
- [ ] Insert into `stripe_customers`
- [ ] Create Stripe subscription with 7-day trial
- [ ] UPDATE existing `subs_user` row to Pro tier
- [ ] Store trial info in metadata
- [ ] Test: User immediately gets Pro features

### Phase 5: Webhook Handling
- [ ] Build webhook endpoint `/api/webhooks/stripe`
- [ ] Verify webhook signature
- [ ] Check for duplicate events using `stripe_webhook_events`
- [ ] Handle: subscription.created, updated, deleted
- [ ] Handle: invoice.payment_succeeded, payment_failed
- [ ] Test: Trial ends → payment succeeds → status=active
- [ ] Test: Trial ends → payment fails → downgrade to Free

### Phase 6: Subscription Management
- [ ] Build "Manage Subscription" page
- [ ] Show current plan, billing cycle, next bill date
- [ ] Allow cancellation (set `cancel_at_period_end` in metadata)
- [ ] Allow reactivation if cancelled
- [ ] Show usage stats from metadata

### Phase 7: Enterprise (Future)
- [ ] Build organization creation flow
- [ ] Create row in `subs_organization`
- [ ] End old `subs_user` row
- [ ] Move user to organization
- [ ] Test: User accesses via org subscription

---

## Key Code Patterns

### Check User's Current Subscription

```typescript
export async function getUserSubscription(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  // Check if user is in an organization (Enterprise)
  if (user.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
      with: { currentSubscription: { with: { tier: true } } }
    });

    return {
      tier: org.currentSubscription.tier,
      status: org.currentSubscription.status,
      type: 'organization' as const,
    };
  }

  // Individual user (Free/Pro)
  const subscription = await db.query.subsUser.findFirst({
    where: eq(subsUser.userId, userId),
    with: { tier: true }
  });

  return {
    tier: subscription.tier,
    status: subscription.status,
    type: 'individual' as const,
    metadata: subscription.metadata,
  };
}
```

### Create Free Subscription on Signup

```typescript
export async function createFreeSubscription(userId: string) {
  const freeTier = await db.query.subscriptionTiers.findFirst({
    where: eq(subscriptionTiers.name, 'free')
  });

  const [subscription] = await db.insert(subsUser).values({
    userId,
    tierId: freeTier.id,
    status: 'active',
    startDate: new Date(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    metadata: {
      usage: {
        period_start: new Date().toISOString(),
        sources_used: 0,
        keywords_used: 0,
        api_calls: 0
      }
    }
  }).returning();

  return subscription;
}
```

### Track Usage (Increment Counters)

```typescript
export async function incrementUsage(
  userId: string,
  type: 'sources' | 'keywords' | 'api_calls'
) {
  const field = type === 'sources' ? 'sources_used'
              : type === 'keywords' ? 'keywords_used'
              : 'api_calls';

  // Use PostgreSQL JSON update to increment counter
  await db.execute(sql`
    UPDATE subs_user
    SET metadata = jsonb_set(
      metadata,
      '{usage,${field}}',
      to_jsonb((metadata->'usage'->>${field})::int + 1)
    )
    WHERE user_id = ${userId}
  `);

  // Check if user exceeded limits
  const subscription = await db.query.subsUser.findFirst({
    where: eq(subsUser.userId, userId),
    with: { tier: true }
  });

  const usage = subscription?.metadata?.usage || {};
  const limits = subscription?.tier?.features || {};

  if (usage[field] > limits[`max_${type}`]) {
    throw new Error(`${type} limit exceeded`);
  }
}
```

---

## Important Decisions & Rationale

### Why Metadata JSONB?

**Pros:**
- Flexible - add new fields without migrations
- Simple - no table creation for every data type
- Fast iteration - change structure easily
- Sufficient for most queries

**When to Promote to Column:**
- Need to query/filter on field frequently
- Need to index the field
- Need database constraints (NOT NULL, UNIQUE)
- Accessed on every request

### Why Two Subscription Tables?

Individual and organization subscriptions are **fundamentally different**:
- Different foreign key relationships
- Different lifecycles (simple upgrade vs team management)
- Different billing entities (personal credit card vs company invoice)
- Cleaner separation of concerns
- Simpler queries (no complex WHERE clauses to differentiate)

### Why Store Some Data in Stripe API?

**Store Locally:**
- Customer mappings (critical for queries)
- Subscription status (accessed frequently)
- Webhook events (idempotency)

**Query from Stripe:**
- Invoices (rare access, comprehensive in Stripe)
- Charges (rare access)
- Refunds (rare access)
- Detailed payment history (better in Stripe Dashboard)

This keeps the database schema minimal while maintaining full functionality.

---

## File Locations

- HTML Doc: `docs/subscription-system/minimal-implementation-guide.html`
- This Reference: `docs/subscription-system/minimal-implementation-reference.md`
- Schema Files:
  - `shared/db/schema/subscriptions.ts` (subs_user, subs_organization)
  - `shared/db/schema/stripe.ts` (stripe_customers, stripe_webhook_events)

---

**Version 1.0 • January 2025**

*Start simple. Scale smart. Keep metadata flexible.*
