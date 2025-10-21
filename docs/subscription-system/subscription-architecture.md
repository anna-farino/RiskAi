# Subscription System Architecture - Production Ready Design

**Project:** Altair News Platform
**Version:** 1.0
**Last Updated:** October 2025
**Author:** System Architecture Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Subscription Tiers & Features](#subscription-tiers--features)
4. [Database Schema Design](#database-schema-design)
5. [Stripe Integration Architecture](#stripe-integration-architecture)
6. [Subscription Lifecycle Flows](#subscription-lifecycle-flows)
7. [Usage Tracking & Enforcement](#usage-tracking--enforcement)
8. [Security Considerations](#security-considerations)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### The Challenge

We need a production-ready subscription system that handles:
- **Free & Pro tiers**: Individual users without organizations
- **Enterprise tier**: Team-based subscriptions with multiple members
- **Stripe integration**: Payment processing, webhooks, and subscription management
- **Usage enforcement**: Source limits, keyword tracking, API quotas
- **Trial management**: 1-week Pro trial with automatic downgrade

### The Solution

A **dual-subscription model** that elegantly transitions from individual to team subscriptions:

```
User Signs Up (Free)
    ↓
Individual Subscription (user_subscriptions table)
    ↓
Upgrades to Pro (still individual, Stripe subscription created)
    ↓
Wants Enterprise? → Organization Created → Team Subscription
```

This approach:
- ✅ Avoids creating unnecessary organizations for Free/Pro users
- ✅ Allows seamless upgrade path to Enterprise
- ✅ Maintains clear data model boundaries
- ✅ Simplifies billing logic
- ✅ Production-ready with proper Stripe integration

---

## Current State Analysis

### Existing Schema (✅ Good Foundation)

**Tables Already Created:**
- `subscription_tiers` - Master tier configuration
- `subscriptions` - Subscription instances (organization-level)
- `organizations` - Team/company entities
- `users` - User accounts with `organizationId`

### What's Missing (❌ Needs Implementation)

1. **Individual Subscriptions Table** - For Free/Pro users without organizations
2. **Stripe Integration Tables** - Customer mapping, webhook logs, payment methods
3. **Usage Tracking Tables** - Enforce limits (sources, keywords, API calls)
4. **Trial Management Logic** - Handle 1-week Pro trial period
5. **Feature Access Control** - Map tiers to applet permissions

---

## Subscription Tiers & Features

### Feature Matrix (From Your Screenshot)

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| **Applets** |
| Access to Threat Tracker | ✅ | ✅ | ✅ |
| Access to News Radar | ✅ | ✅ | ✅ |
| Access Tech Stack Overview | ✅ | ✅ | ✅ |
| Access to CVE Reporter | ✅ | ✅ | ✅ |
| Access to Report Center | ✅ | ✅ | ✅ |
| **Limits** |
| Amount of Sources Available | 5 | 15 | Custom |
| Custom Tech Stack Keywords | 10 | 50 | Custom |
| **Team Features** |
| Team Members | 1 | 1 | Unlimited |
| Organization Management | ❌ | ❌ | ✅ |
| Role-Based Access Control | ❌ | ❌ | ✅ |

### Pricing Structure

```typescript
const TIER_CONFIG = {
  free: {
    name: 'free',
    displayName: 'Free',
    price: 0, // $0/month
    yearlyPrice: 0,
    maxUsers: 1,
    maxSources: 5,
    maxKeywords: 10,
    maxApiCalls: 1000, // per month
    features: {
      threatTracker: true,
      newsRadar: true,
      techStack: true,
      cveReporter: true,
      reportCenter: true,
      organizationManagement: false,
      rbac: false
    }
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    price: 2900, // $29/month (in cents)
    yearlyPrice: 29000, // $290/year (2 months free)
    maxUsers: 1,
    maxSources: 15,
    maxKeywords: 50,
    maxApiCalls: 10000,
    trialDays: 7,
    features: {
      // All applets available
      threatTracker: true,
      newsRadar: true,
      techStack: true,
      cveReporter: true,
      reportCenter: true,
      organizationManagement: false,
      rbac: false
    }
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    price: 9900, // $99/month base
    yearlyPrice: 99000,
    maxUsers: -1, // unlimited
    maxSources: -1, // unlimited
    maxKeywords: -1, // unlimited
    maxApiCalls: -1, // unlimited
    features: {
      // All features
      threatTracker: true,
      newsRadar: true,
      techStack: true,
      cveReporter: true,
      reportCenter: true,
      organizationManagement: true,
      rbac: true,
      customIntegrations: true,
      prioritySupport: true
    }
  }
};
```

---

## Database Schema Design

### Overview

The schema uses a **dual-track approach**:
- **Individual Track**: `user_subscriptions` (Free & Pro)
- **Team Track**: `subscriptions` → `organizations` (Enterprise)

### Complete Schema

#### 1. User Subscriptions (NEW - Individual Free/Pro Users)

```typescript
// shared/db/schema/user-subscriptions.ts
export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tierId: uuid("tier_id").notNull().references(() => subscriptionTiers.id),

  // Status & Lifecycle
  status: text("status").notNull().default("active"),
  // "active", "trialing", "cancelled", "expired", "past_due", "paused"

  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // null = ongoing
  trialEndDate: timestamp("trial_end_date"), // For Pro trial
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),

  // Billing
  billingCycle: text("billing_cycle"), // "monthly", "yearly"
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),

  // Stripe Integration
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),

  // Metadata
  metadata: jsonb("metadata"), // Custom data, promo codes, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Constraints
  CONSTRAINT: {
    uniqueActiveUserSubscription: 'UNIQUE(user_id) WHERE status IN (\'active\', \'trialing\')'
  }
});

// Indexes
CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_trial_end ON user_subscriptions(trial_end_date)
  WHERE trial_end_date IS NOT NULL;
```

**Key Design Decisions:**

1. **One Active Subscription Per User**: Unique constraint ensures users can't have multiple active subscriptions
2. **Trial Tracking**: Separate `trialEndDate` field for easy trial management
3. **Stripe IDs at Subscription Level**: Keeps payment data with subscription
4. **Soft Cancellation**: `cancelAtPeriodEnd` allows users to finish their billing period

#### 2. Stripe Customers (NEW - Stripe Integration)

```typescript
// shared/db/schema/stripe.ts
export const stripeCustomers = pgTable("stripe_customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),

  // Stripe Data
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  email: text("email").notNull(),

  // Payment Methods
  defaultPaymentMethodId: text("default_payment_method_id"),

  // Billing Details
  billingAddress: jsonb("billing_address"), // {line1, city, state, postal_code, country}
  taxIds: jsonb("tax_ids"), // Array of tax IDs for invoicing

  // Status
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),

  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Constraint: Either userId OR organizationId must be set, not both
  CHECK: 'CHECK ((user_id IS NOT NULL AND organization_id IS NULL) OR (user_id IS NULL AND organization_id IS NOT NULL))'
});

CREATE UNIQUE INDEX idx_stripe_customers_user ON stripe_customers(user_id)
  WHERE user_id IS NOT NULL AND is_deleted = false;
CREATE UNIQUE INDEX idx_stripe_customers_org ON stripe_customers(organization_id)
  WHERE organization_id IS NOT NULL AND is_deleted = false;
```

**Why This Design:**
- Handles both individual (user) and team (organization) billing
- Prevents duplicate Stripe customers via unique indexes
- Stores billing information for invoicing
- Supports soft deletion for audit trail

#### 3. Payment Methods (NEW)

```typescript
export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  stripeCustomerId: text("stripe_customer_id").notNull().references(() => stripeCustomers.stripeCustomerId),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),

  // Card Details (for display only, never store full card numbers)
  type: text("type").notNull(), // "card", "bank_account", "paypal"
  cardBrand: text("card_brand"), // "visa", "mastercard", "amex"
  cardLast4: text("card_last4"),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),

  // Status
  isDefault: boolean("is_default").default(false),
  isExpired: boolean("is_expired").default(false),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

CREATE INDEX idx_payment_methods_customer ON payment_methods(stripe_customer_id);
```

#### 4. Stripe Webhook Events (NEW - Critical for Production)

```typescript
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),

  // Event Details
  eventType: text("event_type").notNull(), // "customer.subscription.updated", etc.
  eventData: jsonb("event_data").notNull(), // Full event payload

  // Processing
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
  retryCount: integer("retry_count").default(0),

  // Metadata
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

CREATE INDEX idx_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON stripe_webhook_events(processed, received_at);
CREATE INDEX idx_webhook_events_stripe_id ON stripe_webhook_events(stripe_event_id);
```

**Why Critical:**
- **Idempotency**: Prevents duplicate event processing via `stripeEventId` unique constraint
- **Retry Logic**: Track failed webhooks for manual intervention
- **Audit Trail**: Full event payload for debugging
- **Processing Queue**: Unprocessed events can be reprocessed

#### 5. Subscription Usage Tracking (NEW - Enforce Limits)

```typescript
export const subscriptionUsage = pgTable("subscription_usage", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Reference (either user subscription OR organization subscription)
  userSubscriptionId: uuid("user_subscription_id").references(() => userSubscriptions.id, { onDelete: 'cascade' }),
  organizationSubscriptionId: uuid("organization_subscription_id").references(() => subscriptions.id, { onDelete: 'cascade' }),

  // Usage Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),

  // Usage Metrics
  sourcesUsed: integer("sources_used").default(0),
  keywordsUsed: integer("keywords_used").default(0),
  apiCallsUsed: integer("api_calls_used").default(0),

  // Detailed Tracking (optional, for analytics)
  usageDetails: jsonb("usage_details"), // Breakdown by feature

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  CHECK: 'CHECK ((user_subscription_id IS NOT NULL AND organization_subscription_id IS NULL) OR (user_subscription_id IS NULL AND organization_subscription_id IS NOT NULL))'
});

CREATE INDEX idx_subscription_usage_user ON subscription_usage(user_subscription_id, period_start);
CREATE INDEX idx_subscription_usage_org ON subscription_usage(organization_subscription_id, period_start);
CREATE INDEX idx_subscription_usage_period ON subscription_usage(period_end)
  WHERE period_end > NOW(); -- Active periods
```

#### 6. Feature Access Log (NEW - Audit & Analytics)

```typescript
export const featureAccessLog = pgTable("feature_access_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),

  // Access Details
  featureName: text("feature_name").notNull(), // "threat_tracker", "news_radar"
  action: text("action").notNull(), // "view", "create", "update", "delete"
  allowed: boolean("allowed").notNull(),
  denialReason: text("denial_reason"), // "quota_exceeded", "tier_restriction"

  // Context
  resourceId: uuid("resource_id"), // What was accessed
  metadata: jsonb("metadata"),

  // Timestamp
  accessedAt: timestamp("accessed_at").defaultNow().notNull()
});

CREATE INDEX idx_feature_access_user ON feature_access_log(user_id, accessed_at);
CREATE INDEX idx_feature_access_feature ON feature_access_log(feature_name, accessed_at);
CREATE INDEX idx_feature_access_denied ON feature_access_log(allowed, accessed_at)
  WHERE allowed = false;
```

**Use Cases:**
- Track denied access attempts (user hitting limits)
- Analytics on feature usage patterns
- Audit trail for compliance
- Identify upgrade opportunities

#### 7. Modified Subscriptions Table (Organization/Enterprise Only)

**Your existing `subscriptions` table is perfect** for organization-level subscriptions. Just clarify its purpose:

```typescript
// This table is for ENTERPRISE/TEAM subscriptions only
// Individual Free/Pro users use user_subscriptions instead
export const subscriptions = pgTable("subscriptions", {
  // ... existing fields ...

  // Add these for clarity
  subscriptionType: text("subscription_type").default("organization"), // Always "organization"
  seatsIncluded: integer("seats_included"), // Number of team members included
  seatsUsed: integer("seats_used").default(0), // Track usage
});
```

---

## Stripe Integration Architecture

### Setup Requirements

1. **Stripe Account Setup**
   - Create Stripe account (test mode first)
   - Generate API keys (publishable & secret)
   - Configure webhook endpoint
   - Set up products and prices

2. **Environment Variables**

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Product IDs (create these in Stripe Dashboard)
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_...
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=price_...
```

3. **Install Stripe SDK**

```bash
npm install stripe
```

### Core Stripe Service

```typescript
// backend/services/stripe/stripe-service.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export class StripeService {
  /**
   * Create a new Stripe customer for a user
   */
  async createCustomer(userId: string, email: string, name: string): Promise<Stripe.Customer> {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId }
    });

    // Save to database
    await db.insert(stripeCustomers).values({
      userId,
      stripeCustomerId: customer.id,
      email
    });

    return customer;
  }

  /**
   * Create a subscription with trial period
   */
  async createSubscription({
    customerId,
    priceId,
    trialDays = 0
  }: {
    customerId: string;
    priceId: string;
    trialDays?: number;
  }): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: trialDays > 0 ? trialDays : undefined,
      payment_behavior: trialDays > 0 ? 'default_incomplete' : 'error_if_incomplete',
      expand: ['latest_invoice.payment_intent']
    });

    return subscription;
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(subscriptionId: string, newPriceId: string): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId
      }],
      proration_behavior: 'create_prorations' // Pro-rate the difference
    });
  }

  /**
   * Create a portal session for customer to manage subscription
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
  }
}
```

### Webhook Handler

**Critical for production**: Stripe webhooks are how you know when payments succeed/fail, trials end, etc.

```typescript
// backend/handlers/stripe/webhooks.ts
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from 'backend/db/db';
import { stripeWebhookEvents, userSubscriptions } from '@shared/db/schema';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Check if already processed (idempotency)
  const existing = await db.select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, event.id))
    .limit(1);

  if (existing.length > 0) {
    console.log('Webhook already processed:', event.id);
    return res.json({ received: true, duplicate: true });
  }

  // Log webhook event
  await db.insert(stripeWebhookEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    eventData: event,
    processed: false
  });

  try {
    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    // Mark as processed
    await db.update(stripeWebhookEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(stripeWebhookEvents.stripeEventId, event.id));

  } catch (error: any) {
    console.error('Error processing webhook:', error);

    // Log error for retry
    await db.update(stripeWebhookEvents)
      .set({
        processingError: error.message,
        retryCount: sql`retry_count + 1`
      })
      .where(eq(stripeWebhookEvents.stripeEventId, event.id));

    // Return 500 so Stripe retries
    return res.status(500).json({ error: 'Processing failed' });
  }

  res.json({ received: true });
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  // Sync with database
  await db.update(userSubscriptions)
    .set({
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  // Send email reminder: "Your trial ends in 3 days"
  const userSub = await db.select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (userSub.length > 0) {
    // Send email via SendGrid or similar
    await sendTrialEndingEmail(userSub[0].userId);
  }
}

// ... more handlers
```

### Webhook Events to Handle

| Event | Action | Priority |
|-------|--------|----------|
| `customer.subscription.created` | Create subscription record | HIGH |
| `customer.subscription.updated` | Sync status changes | HIGH |
| `customer.subscription.deleted` | Mark cancelled, revoke access | HIGH |
| `customer.subscription.trial_will_end` | Send reminder email (3 days before) | MEDIUM |
| `invoice.payment_succeeded` | Mark paid, extend access | HIGH |
| `invoice.payment_failed` | Mark past_due, send warning | HIGH |
| `payment_method.attached` | Update payment method | MEDIUM |
| `customer.updated` | Sync customer details | LOW |

---

## Subscription Lifecycle Flows

### Flow 1: User Signs Up (Free Tier)

```
1. User completes registration
   ↓
2. Create user record in database
   ↓
3. Create FREE tier subscription automatically

   INSERT INTO user_subscriptions (
     user_id,
     tier_id,
     status,
     start_date
   ) VALUES (
     $userId,
     (SELECT id FROM subscription_tiers WHERE name = 'free'),
     'active',
     NOW()
   );

   ↓
4. No Stripe customer needed yet (it's free!)
   ↓
5. User has access with Free limits:
   - 5 sources
   - 10 keywords
   - All applets available
```

**Implementation:**

```typescript
// backend/services/subscription/subscription-service.ts
export async function createFreeSubscription(userId: string) {
  const freeTier = await db.select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.name, 'free'))
    .limit(1);

  if (freeTier.length === 0) {
    throw new Error('Free tier not configured');
  }

  await db.insert(userSubscriptions).values({
    userId,
    tierId: freeTier[0].id,
    status: 'active',
    startDate: new Date()
  });

  // Initialize usage tracking
  await db.insert(subscriptionUsage).values({
    userSubscriptionId: subscription.id,
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    sourcesUsed: 0,
    keywordsUsed: 0,
    apiCallsUsed: 0
  });
}
```

### Flow 2: Free User Upgrades to Pro (With 1-Week Trial)

```
1. User clicks "Upgrade to Pro"
   ↓
2. Check if Stripe customer exists
   - If NO: Create Stripe customer
   - If YES: Use existing
   ↓
3. User adds payment method
   (Stripe Checkout or Elements)
   ↓
4. Create Stripe subscription with 7-day trial

   const subscription = await stripe.subscriptions.create({
     customer: customerId,
     items: [{ price: PRO_MONTHLY_PRICE_ID }],
     trial_period_days: 7,
     payment_behavior: 'default_incomplete'
   });

   ↓
5. Update user_subscriptions record

   UPDATE user_subscriptions SET
     tier_id = (SELECT id FROM subscription_tiers WHERE name = 'pro'),
     status = 'trialing',
     trial_end_date = NOW() + INTERVAL '7 days',
     stripe_subscription_id = $stripeSubId,
     stripe_customer_id = $customerId
   WHERE user_id = $userId;

   ↓
6. User immediately gets Pro features (15 sources, 50 keywords)
   ↓
7. After 7 days, Stripe automatically charges
   - Payment succeeds → status becomes 'active'
   - Payment fails → status becomes 'past_due', grace period
   ↓
8. If payment fails after retries → Downgrade to Free
```

**Implementation:**

```typescript
export async function upgradeToProWithTrial(userId: string, paymentMethodId: string) {
  // Get current subscription
  const currentSub = await db.select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (currentSub.length === 0) {
    throw new Error('No active subscription found');
  }

  // Get or create Stripe customer
  let customer = await getOrCreateStripeCustomer(userId);

  // Attach payment method
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customer.stripeCustomerId
  });

  // Set as default
  await stripe.customers.update(customer.stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  });

  // Get Pro tier
  const proTier = await db.select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.name, 'pro'))
    .limit(1);

  // Create Stripe subscription with trial
  const stripeSubscription = await stripe.subscriptions.create({
    customer: customer.stripeCustomerId,
    items: [{ price: process.env.STRIPE_PRO_MONTHLY_PRICE_ID }],
    trial_period_days: 7,
    payment_behavior: 'default_incomplete',
    metadata: {
      userId,
      userSubscriptionId: currentSub[0].id
    }
  });

  const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Update our database
  await db.update(userSubscriptions)
    .set({
      tierId: proTier[0].id,
      status: 'trialing',
      trialEndDate: trialEnd,
      stripeCustomerId: customer.stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePaymentMethodId: paymentMethodId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      billingCycle: 'monthly',
      updatedAt: new Date()
    })
    .where(eq(userSubscriptions.id, currentSub[0].id));

  // Update usage limits immediately
  await updateUsageLimits(currentSub[0].id, proTier[0]);

  return { success: true, trialEndDate: trialEnd };
}
```

### Flow 3: Trial Ends & Auto-Charges

```
Day 7, 11:59 PM
   ↓
Stripe automatically attempts to charge the payment method
   ↓
┌─────────────────────────────────────────┐
│ Payment Succeeds                        │
│ ↓                                       │
│ Webhook: invoice.payment_succeeded      │
│ ↓                                       │
│ UPDATE user_subscriptions               │
│ SET status = 'active',                  │
│     trial_end_date = NULL               │
│ ↓                                       │
│ User continues with Pro features        │
└─────────────────────────────────────────┘
           ↓ (OR)
┌─────────────────────────────────────────┐
│ Payment Fails                           │
│ ↓                                       │
│ Webhook: invoice.payment_failed         │
│ ↓                                       │
│ UPDATE user_subscriptions               │
│ SET status = 'past_due'                 │
│ ↓                                       │
│ Send email: "Payment failed"            │
│ ↓                                       │
│ Stripe retries 3 times over 7 days     │
│ ↓                                       │
│ Still failing?                          │
│ ↓                                       │
│ Webhook: customer.subscription.deleted  │
│ ↓                                       │
│ DOWNGRADE to Free tier                  │
│ UPDATE user_subscriptions               │
│ SET tier_id = (free tier),              │
│     status = 'expired'                  │
│ ↓                                       │
│ User loses Pro features, back to Free   │
└─────────────────────────────────────────┘
```

**Implementation:**

```typescript
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

  await db.update(userSubscriptions)
    .set({ status: 'past_due' })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));

  // Send email warning
  const userSub = await getUserSubscription(subscription.id);
  await sendPaymentFailedEmail(userSub.userId, invoice.hosted_invoice_url);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const freeTier = await db.select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.name, 'free'))
    .limit(1);

  // Downgrade to free
  await db.update(userSubscriptions)
    .set({
      tierId: freeTier[0].id,
      status: 'expired',
      stripeSubscriptionId: null,
      endDate: new Date()
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));

  // Reset usage limits
  await updateUsageLimits(userSub.id, freeTier[0]);

  // Send email
  await sendDowngradeNotificationEmail(userSub.userId);
}
```

### Flow 4: Pro User Upgrades to Enterprise (Team)

This is the **critical transition** from individual to organization-based subscription.

```
1. Pro user wants Enterprise (team features)
   ↓
2. Show "Create Organization" form
   - Organization name
   - Slug
   - Invite team members
   ↓
3. Create organization record

   INSERT INTO organizations (name, slug)
   VALUES ($orgName, $slug)
   RETURNING id;

   ↓
4. Create organization subscription (NOT user subscription)

   INSERT INTO subscriptions (
     organization_id,
     tier_id,
     status,
     start_date,
     stripe_subscription_id
   ) VALUES (
     $orgId,
     (SELECT id FROM subscription_tiers WHERE name = 'enterprise'),
     'active',
     NOW(),
     $newStripeSubscriptionId
   );

   ↓
5. Move user to organization

   UPDATE users
   SET organization_id = $orgId
   WHERE id = $userId;

   ↓
6. Cancel old individual subscription

   await stripe.subscriptions.cancel($oldSubscriptionId);

   UPDATE user_subscriptions
   SET status = 'cancelled',
       end_date = NOW()
   WHERE user_id = $userId;

   ↓
7. Create NEW Stripe subscription for organization

   const orgSubscription = await stripe.subscriptions.create({
     customer: orgCustomerId,
     items: [{
       price: ENTERPRISE_MONTHLY_PRICE_ID,
       quantity: 1 // Base price
     }],
     metadata: {
       organizationId: $orgId,
       subscriptionType: 'organization'
     }
   });

   ↓
8. User now accesses features via organization subscription
   - Check: users.organization_id → organizations.current_subscription_id
   - Instead of: user_subscriptions

   ↓
9. Can now invite team members
   - All members share organization subscription
   - All get Enterprise features
```

**Implementation:**

```typescript
export async function upgradeToEnterprise(
  userId: string,
  organizationData: { name: string; slug: string }
) {
  return await db.transaction(async (tx) => {
    // 1. Get current user subscription
    const currentSub = await tx.select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (currentSub.length === 0 || currentSub[0].status !== 'active') {
      throw new Error('No active subscription to upgrade');
    }

    // 2. Create organization
    const [org] = await tx.insert(organizations)
      .values({
        name: organizationData.name,
        slug: organizationData.slug,
        isActive: true
      })
      .returning();

    // 3. Get Enterprise tier
    const [enterpriseTier] = await tx.select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.name, 'enterprise'))
      .limit(1);

    // 4. Create Stripe customer for organization
    const orgCustomer = await stripe.customers.create({
      name: org.name,
      email: currentUser.email,
      metadata: { organizationId: org.id }
    });

    await tx.insert(stripeCustomers).values({
      organizationId: org.id,
      stripeCustomerId: orgCustomer.id,
      email: currentUser.email
    });

    // 5. Create Stripe subscription for organization
    const stripeSubscription = await stripe.subscriptions.create({
      customer: orgCustomer.id,
      items: [{ price: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID }],
      metadata: {
        organizationId: org.id,
        subscriptionType: 'organization'
      }
    });

    // 6. Create organization subscription
    const [orgSub] = await tx.insert(subscriptions)
      .values({
        organizationId: org.id,
        tierId: enterpriseTier.id,
        status: 'active',
        startDate: new Date(),
        billingCycle: 'monthly',
        stripeSubscriptionId: stripeSubscription.id
      })
      .returning();

    // 7. Link organization to subscription
    await tx.update(organizations)
      .set({ currentSubscriptionId: orgSub.id })
      .where(eq(organizations.id, org.id));

    // 8. Move user to organization
    await tx.update(users)
      .set({ organizationId: org.id })
      .where(eq(users.id, userId));

    // 9. Cancel old individual subscription in Stripe
    if (currentSub[0].stripeSubscriptionId) {
      await stripe.subscriptions.cancel(currentSub[0].stripeSubscriptionId);
    }

    // 10. Mark old user subscription as cancelled
    await tx.update(userSubscriptions)
      .set({
        status: 'cancelled',
        endDate: new Date(),
        cancelAtPeriodEnd: false
      })
      .where(eq(userSubscriptions.id, currentSub[0].id));

    return { organization: org, subscription: orgSub };
  });
}
```

---

## Usage Tracking & Enforcement

### Checking Subscription & Limits

**Core function** used throughout your app:

```typescript
// backend/services/subscription/access-control.ts

export interface UserAccess {
  tier: 'free' | 'pro' | 'enterprise';
  status: string;
  limits: {
    maxSources: number;
    maxKeywords: number;
    maxApiCalls: number;
  };
  usage: {
    sourcesUsed: number;
    keywordsUsed: number;
    apiCallsUsed: number;
  };
  features: {
    threatTracker: boolean;
    newsRadar: boolean;
    techStack: boolean;
    cveReporter: boolean;
    reportCenter: boolean;
    organizationManagement: boolean;
    rbac: boolean;
  };
}

export async function getUserAccess(userId: string): Promise<UserAccess> {
  // Check if user is part of organization (Enterprise)
  const user = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0) {
    throw new Error('User not found');
  }

  let tier, limits, usage, status;

  if (user[0].organizationId) {
    // User is in organization - use organization subscription
    const orgSub = await db.select({
      subscription: subscriptions,
      tier: subscriptionTiers,
      usage: subscriptionUsage
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(organizations.currentSubscriptionId, subscriptions.id))
    .innerJoin(subscriptionTiers, eq(subscriptions.tierId, subscriptionTiers.id))
    .leftJoin(subscriptionUsage, eq(subscriptionUsage.organizationSubscriptionId, subscriptions.id))
    .where(eq(organizations.id, user[0].organizationId))
    .limit(1);

    if (orgSub.length === 0) {
      throw new Error('Organization subscription not found');
    }

    tier = orgSub[0].tier;
    status = orgSub[0].subscription.status;
    usage = orgSub[0].usage || { sourcesUsed: 0, keywordsUsed: 0, apiCallsUsed: 0 };

  } else {
    // Individual subscription
    const userSub = await db.select({
      subscription: userSubscriptions,
      tier: subscriptionTiers,
      usage: subscriptionUsage
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionTiers, eq(userSubscriptions.tierId, subscriptionTiers.id))
    .leftJoin(subscriptionUsage, eq(subscriptionUsage.userSubscriptionId, userSubscriptions.id))
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

    if (userSub.length === 0) {
      throw new Error('User subscription not found');
    }

    tier = userSub[0].tier;
    status = userSub[0].subscription.status;
    usage = userSub[0].usage || { sourcesUsed: 0, keywordsUsed: 0, apiCallsUsed: 0 };
  }

  return {
    tier: tier.name as any,
    status,
    limits: {
      maxSources: tier.maxSources,
      maxKeywords: tier.maxKeywords,
      maxApiCalls: tier.maxApiCalls
    },
    usage: {
      sourcesUsed: usage.sourcesUsed,
      keywordsUsed: usage.keywordsUsed,
      apiCallsUsed: usage.apiCallsUsed
    },
    features: tier.features as any
  };
}
```

### Middleware: Enforce Limits

```typescript
// backend/middleware/subscription-guard.ts

export function requireSubscription(minTier: 'free' | 'pro' | 'enterprise') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.id; // From auth middleware

    try {
      const access = await getUserAccess(userId);

      // Check if subscription is active
      if (access.status !== 'active' && access.status !== 'trialing') {
        return res.status(402).json({
          error: 'Subscription required',
          message: 'Your subscription is not active'
        });
      }

      // Check tier
      const tierOrder = { free: 0, pro: 1, enterprise: 2 };
      if (tierOrder[access.tier] < tierOrder[minTier]) {
        return res.status(403).json({
          error: 'Upgrade required',
          message: `This feature requires ${minTier} tier or higher`,
          currentTier: access.tier,
          requiredTier: minTier
        });
      }

      // Attach to request
      req.userAccess = access;
      next();

    } catch (error) {
      res.status(500).json({ error: 'Failed to check subscription' });
    }
  };
}

export function checkLimit(limitType: 'sources' | 'keywords' | 'apiCalls') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const access = req.userAccess;

    if (!access) {
      return res.status(500).json({ error: 'Access control not initialized' });
    }

    // Check limit
    const limitKey = `max${limitType.charAt(0).toUpperCase() + limitType.slice(1)}` as keyof typeof access.limits;
    const usageKey = `${limitType}Used` as keyof typeof access.usage;

    const maxAllowed = access.limits[limitKey];
    const currentUsage = access.usage[usageKey];

    // -1 means unlimited (enterprise)
    if (maxAllowed !== -1 && currentUsage >= maxAllowed) {
      return res.status(429).json({
        error: 'Limit exceeded',
        message: `You have reached your ${limitType} limit`,
        limit: maxAllowed,
        usage: currentUsage,
        upgradeRequired: true
      });
    }

    next();
  };
}
```

### Usage Example

```typescript
// backend/apps/news-radar/router.ts
import { requireSubscription, checkLimit } from 'backend/middleware/subscription-guard';

router.post('/sources',
  requireSubscription('free'), // All tiers can add sources
  checkLimit('sources'), // But respect limits
  async (req, res) => {
    // Add source logic
    const { url, name } = req.body;

    // ... create source ...

    // Increment usage counter
    await incrementUsage(req.user.id, 'sources');

    res.json({ success: true });
  }
);

router.post('/keywords',
  requireSubscription('free'),
  checkLimit('keywords'),
  async (req, res) => {
    // Add keyword logic
    // ...
  }
);

// Enterprise-only feature
router.post('/team/invite',
  requireSubscription('enterprise'),
  async (req, res) => {
    // Only enterprise tier can invite team members
    // ...
  }
);
```

### Increment Usage

```typescript
export async function incrementUsage(
  userId: string,
  type: 'sources' | 'keywords' | 'apiCalls',
  amount: number = 1
) {
  // Determine if user or organization subscription
  const user = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0) return;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of month

  if (user[0].organizationId) {
    // Organization subscription
    const orgSub = await db.select()
      .from(organizations)
      .where(eq(organizations.id, user[0].organizationId))
      .limit(1);

    if (orgSub.length === 0) return;

    await db.insert(subscriptionUsage)
      .values({
        organizationSubscriptionId: orgSub[0].currentSubscriptionId,
        periodStart,
        periodEnd,
        [`${type}Used`]: amount
      })
      .onConflictDoUpdate({
        target: [subscriptionUsage.organizationSubscriptionId, subscriptionUsage.periodStart],
        set: {
          [`${type}Used`]: sql`${subscriptionUsage[`${type}Used`]} + ${amount}`
        }
      });

  } else {
    // Individual subscription
    const userSub = await db.select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (userSub.length === 0) return;

    await db.insert(subscriptionUsage)
      .values({
        userSubscriptionId: userSub[0].id,
        periodStart,
        periodEnd,
        [`${type}Used`]: amount
      })
      .onConflictDoUpdate({
        target: [subscriptionUsage.userSubscriptionId, subscriptionUsage.periodStart],
        set: {
          [`${type}Used`]: sql`${subscriptionUsage[`${type}Used`]} + ${amount}`
        }
      });
  }
}
```

---

## Security Considerations

### 1. Stripe Webhook Security

**Critical:** Always verify webhook signatures!

```typescript
try {
  event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    process.env.STRIPE_WEBHOOK_SECRET!
  );
} catch (err) {
  // Reject invalid webhooks
  return res.status(400).send('Invalid signature');
}
```

### 2. Idempotency

**Problem:** Webhook might be sent multiple times

**Solution:** Check `stripeEventId` before processing

```typescript
const existing = await db.select()
  .from(stripeWebhookEvents)
  .where(eq(stripeWebhookEvents.stripeEventId, event.id));

if (existing.length > 0) {
  return res.json({ received: true, duplicate: true });
}
```

### 3. Prevent Subscription Hijacking

**Problem:** User could modify subscription IDs in requests

**Solution:** Always verify ownership

```typescript
// BAD - Don't trust user input
async function cancelSubscription(subscriptionId: string) {
  await stripe.subscriptions.cancel(subscriptionId); // ❌ Dangerous!
}

// GOOD - Verify ownership
async function cancelSubscription(userId: string) {
  const sub = await db.select()
    .from(userSubscriptions)
    .where(and(
      eq(userSubscriptions.userId, userId),
      eq(userSubscriptions.status, 'active')
    ))
    .limit(1);

  if (sub.length === 0) {
    throw new Error('No active subscription found');
  }

  await stripe.subscriptions.cancel(sub[0].stripeSubscriptionId!);
}
```

### 4. Rate Limiting on Subscription Endpoints

```typescript
import rateLimit from 'express-rate-limit';

const subscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many subscription requests'
});

router.post('/subscribe', subscriptionLimiter, handleSubscribe);
```

### 5. PCI Compliance

**Never store:**
- Full credit card numbers
- CVV codes
- Raw card data

**Always use:**
- Stripe Elements for card collection
- Stripe Checkout for complete payment flow
- Only store `payment_method_id` and last 4 digits

```typescript
// GOOD - Store only reference
await db.insert(paymentMethods).values({
  stripePaymentMethodId: 'pm_1234...', // ✅ Safe
  cardLast4: '4242', // ✅ OK for display
  cardBrand: 'visa' // ✅ OK for display
});

// BAD - Never do this
await db.insert(paymentMethods).values({
  cardNumber: '4242424242424242', // ❌ NEVER!
  cvv: '123' // ❌ NEVER!
});
```

---

## Implementation Roadmap

### Phase 1: Database Foundation (Week 1)

**Priority: CRITICAL**

- [ ] Create migration for new tables:
  - `user_subscriptions`
  - `stripe_customers`
  - `payment_methods`
  - `stripe_webhook_events`
  - `subscription_usage`
  - `feature_access_log`

- [ ] Seed `subscription_tiers` with Free/Pro/Enterprise config

- [ ] Write database queries/services:
  - `getUserAccess(userId)`
  - `createFreeSubscription(userId)`
  - `incrementUsage(userId, type, amount)`

**Deliverables:**
- Migration files in `backend/db/migrations/`
- Type definitions in schema files
- Basic query functions

### Phase 2: Stripe Integration (Week 2)

**Priority: HIGH**

- [ ] Install Stripe SDK: `npm install stripe`
- [ ] Set up Stripe account (test mode)
- [ ] Create products & prices in Stripe Dashboard
- [ ] Implement `StripeService` class:
  - `createCustomer()`
  - `createSubscription()`
  - `updateSubscription()`
  - `cancelSubscription()`
  - `createPortalSession()`

- [ ] Build webhook handler:
  - Signature verification
  - Event logging to `stripe_webhook_events`
  - Handler functions for key events

- [ ] Deploy webhook endpoint
- [ ] Register webhook URL in Stripe Dashboard

**Deliverables:**
- `backend/services/stripe/stripe-service.ts`
- `backend/handlers/stripe/webhooks.ts`
- Webhook endpoint configured

### Phase 3: Subscription Flows (Week 3)

**Priority: HIGH**

- [ ] User registration → Auto-create Free subscription
- [ ] Upgrade flow: Free → Pro (with trial)
  - Frontend: Payment form (Stripe Elements)
  - Backend: Process upgrade, create Stripe subscription

- [ ] Downgrade flow: Pro → Free
  - Cancel Stripe subscription
  - Reset to Free tier

- [ ] Trial end automation:
  - Background job to check `trial_end_date`
  - Send reminder emails

**Deliverables:**
- `backend/services/subscription/subscription-flows.ts`
- API endpoints:
  - `POST /api/subscriptions/upgrade`
  - `POST /api/subscriptions/cancel`
  - `GET /api/subscriptions/current`

### Phase 4: Usage Tracking & Limits (Week 3-4)

**Priority: HIGH**

- [ ] Implement middleware:
  - `requireSubscription(minTier)`
  - `checkLimit(limitType)`

- [ ] Apply middleware to protected routes
- [ ] Build usage tracking:
  - `incrementUsage()` called on resource creation
  - Monthly reset job

- [ ] Frontend: Display usage stats
  - "5/15 sources used"
  - Upgrade prompts

**Deliverables:**
- `backend/middleware/subscription-guard.ts`
- Usage dashboard component
- Background job for usage reset

### Phase 5: Organization/Enterprise (Week 5)

**Priority: MEDIUM**

- [ ] Organization creation flow
- [ ] Upgrade individual → organization subscription
- [ ] Team member invitation system
- [ ] Organization billing management
- [ ] Admin panel for organization owners

**Deliverables:**
- `backend/services/organization/organization-service.ts`
- Organization management UI
- Team member invite flow

### Phase 6: Testing & Polish (Week 6)

**Priority: HIGH**

- [ ] Write unit tests:
  - Subscription creation
  - Upgrade/downgrade flows
  - Usage limit enforcement
  - Webhook handlers

- [ ] Integration tests:
  - Stripe test mode end-to-end
  - Trial expiration scenarios
  - Payment failure handling

- [ ] User acceptance testing
- [ ] Bug fixes

**Deliverables:**
- Test suite with >80% coverage
- Documented test scenarios
- Bug fix log

### Phase 7: Production Launch (Week 7)

**Priority: CRITICAL**

- [ ] Switch Stripe to live mode
- [ ] Configure production webhook endpoint
- [ ] Set up monitoring:
  - Webhook failure alerts
  - Payment failure tracking
  - Usage anomaly detection

- [ ] Create runbook for common issues
- [ ] Launch!

**Deliverables:**
- Production Stripe account configured
- Monitoring dashboard
- Support documentation

---

## Testing Strategy

### Unit Tests

```typescript
// tests/subscription-service.test.ts
describe('SubscriptionService', () => {
  it('should create free subscription on user registration', async () => {
    const userId = await createTestUser();
    const sub = await getUserAccess(userId);

    expect(sub.tier).toBe('free');
    expect(sub.limits.maxSources).toBe(5);
  });

  it('should upgrade to Pro with trial', async () => {
    const userId = await createTestUser();
    await upgradeToProWithTrial(userId, 'pm_test_123');

    const sub = await getUserAccess(userId);
    expect(sub.tier).toBe('pro');
    expect(sub.status).toBe('trialing');
    expect(sub.limits.maxSources).toBe(15);
  });

  it('should downgrade to free after payment failure', async () => {
    // Simulate payment failure webhook
    await handlePaymentFailed(mockInvoice);

    const sub = await getUserAccess(userId);
    expect(sub.tier).toBe('free');
  });
});
```

### Integration Tests with Stripe Test Mode

```typescript
// tests/stripe-integration.test.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!);

describe('Stripe Integration', () => {
  it('should create subscription and handle webhooks', async () => {
    // 1. Create customer
    const customer = await stripe.customers.create({
      email: 'test@example.com'
    });

    // 2. Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: PRO_PRICE_ID }],
      trial_period_days: 7
    });

    expect(subscription.status).toBe('trialing');

    // 3. Trigger webhook manually
    const event = await stripe.events.create({
      type: 'customer.subscription.created',
      data: { object: subscription }
    });

    // 4. Send to webhook handler
    await handleStripeWebhook(event);

    // 5. Verify database updated
    const dbSub = await db.select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));

    expect(dbSub[0].status).toBe('trialing');
  });
});
```

### Test Scenarios

| Scenario | Expected Result | Priority |
|----------|----------------|----------|
| User signs up | Free subscription created | HIGH |
| Upgrade to Pro | Trial starts, Pro limits active | HIGH |
| Trial ends, payment succeeds | Status → active | HIGH |
| Trial ends, payment fails | Downgrade to free | HIGH |
| User cancels Pro | Subscription ends at period end | MEDIUM |
| Upgrade Pro → Enterprise | Organization created, sub migrated | MEDIUM |
| Add source at limit | 429 error, upgrade prompt | MEDIUM |
| Add keyword under limit | Success, usage incremented | HIGH |
| Webhook sent twice | Second one ignored (idempotent) | HIGH |
| Invalid webhook signature | Rejected with 400 | HIGH |

---

## Minimal Viable Production (MVP) Requirements

**Must-Have for Launch:**

✅ **Database Schema**
- All tables created and indexed
- Seed data for tiers

✅ **Stripe Integration**
- Account configured (live mode)
- Webhook endpoint deployed and verified
- Products/prices created

✅ **Core Flows**
- User registration → Free subscription
- Upgrade to Pro with trial
- Payment processing
- Downgrade on payment failure

✅ **Security**
- Webhook signature verification
- Idempotency checks
- Ownership verification on all endpoints

✅ **Basic Monitoring**
- Webhook failure alerts
- Payment failure notifications
- Error logging

**Nice-to-Have (Post-MVP):**

- Organization/Enterprise tier
- Advanced usage analytics
- Promo codes/coupons
- Annual billing discount
- Referral program
- Custom enterprise pricing

---

## Frequently Asked Questions

### Q: Why separate `user_subscriptions` and `subscriptions` tables?

**A:** Clean separation of concerns:
- `user_subscriptions`: Individual Free/Pro users (no organization overhead)
- `subscriptions`: Team/Enterprise subscriptions (organization-level)

This avoids creating empty organizations for solo users and simplifies billing logic.

### Q: What happens to user data when downgrading?

**A:**
- Sources > limit: User can't add more, but existing ones remain (read-only)
- Keywords > limit: Same - can view but not add
- API calls: Fresh quota each month

Consider: Archive excess data or offer "unlock" by upgrading.

### Q: How do I handle refunds?

**A:** Stripe handles automatically:
```typescript
// Webhook: charge.refunded
async function handleRefund(charge: Stripe.Charge) {
  // Log refund
  // Optionally extend subscription
  // Send confirmation email
}
```

### Q: Should I support PayPal, Apple Pay, etc.?

**A:** Stripe supports these out-of-box via Stripe Checkout. No extra code needed!

### Q: How do I test without real payments?

**A:** Use Stripe test mode:
- Test card: `4242 4242 4242 4242`
- Webhooks: Use Stripe CLI to forward to localhost
- All features work identically

---

## Summary & Next Steps

### What You Have

✅ Solid foundation with `subscriptions`, `subscription_tiers`, `organizations` tables
✅ Clear tier structure (Free, Pro, Enterprise)
✅ Your dual-subscription approach is architecturally sound

### What You Need

❌ `user_subscriptions` table for Free/Pro individuals
❌ Stripe integration tables (`stripe_customers`, etc.)
❌ Usage tracking tables
❌ Webhook handler implementation
❌ Access control middleware

### Immediate Next Steps

1. **Create migration** for new tables (Phase 1)
2. **Set up Stripe account** in test mode (Phase 2)
3. **Implement `StripeService`** class (Phase 2)
4. **Build webhook handler** (Phase 2)
5. **Test end-to-end** with Stripe test cards (Phase 6)

### Questions to Resolve

- **Monthly vs Annual billing**: Offer both? (Recommended: Yes, with discount)
- **Grace period**: How long after payment failure? (Recommended: 7 days, Stripe default)
- **Data retention**: Keep excess sources/keywords on downgrade? (Recommended: Yes, read-only)
- **Trial eligibility**: Once per user or allow retrial? (Recommended: Once per email)

---

**This document is your blueprint.** Follow the roadmap, implement phase by phase, and you'll have a robust, production-ready subscription system.

Questions? Need clarification on any section? Let's discuss!
