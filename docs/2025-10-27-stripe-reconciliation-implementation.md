# Stripe Subscription Reconciliation Implementation

**Date:** October 27, 2025
**Author:** Development Team
**Status:** Implemented

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Implementation Details](#implementation-details)
5. [Reconciliation Logic](#reconciliation-logic)
6. [Scheduling & Frequency](#scheduling--frequency)
7. [Error Handling](#error-handling)
8. [Monitoring & Observability](#monitoring--observability)
9. [API Rate Limits](#api-rate-limits)
10. [Best Practices](#best-practices)

---

## Overview

This document describes the implementation of a periodic reconciliation system that keeps the local database in sync with Stripe subscription data. The reconciliation job runs daily at 2am EST and ensures that any missed or failed webhooks don't result in data inconsistencies.

### Key Features

- ✅ **Daily automated reconciliation** at 2am EST (off-peak hours)
- ✅ **Stripe as source of truth** - always updates DB to match Stripe
- ✅ **Comprehensive discrepancy detection** - status, tier, metadata mismatches
- ✅ **Detailed logging and reporting** for monitoring and debugging
- ✅ **Graceful error handling** to prevent scheduler disruption
- ✅ **Rate limit conscious** - well within Stripe's API limits

---

## Problem Statement

### The Challenge

The application uses webhooks to keep subscription data synchronized between Stripe and the local database:

```
1. User action → Stripe API call (create/update subscription)
2. Stripe processes → Sends webhook to our server
3. Webhook handler → Updates local database
```

### The Risk

If webhook communication breaks down for any reason, the database falls out of sync with Stripe:

**Common failure scenarios:**
- Network failures during webhook delivery
- Server downtime when webhook arrives
- Webhook processing errors (bugs, database issues)
- Missed webhook events due to configuration issues
- Out-of-order webhook delivery

**Consequences:**
- Users shown incorrect subscription status
- Access control based on outdated data
- Billing discrepancies
- Poor user experience

---

## Solution Architecture

### Multi-Layer Approach

We implement a **periodic reconciliation job** as the primary safety net, with future considerations for additional layers:

```
┌─────────────────────────────────────────┐
│   Primary: Webhook System (Real-time)  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Safety Net: Daily Reconciliation       │
│  Runs at 2am EST                        │
│  - Fetch all subscriptions from Stripe │
│  - Compare with local DB                │
│  - Fix discrepancies                    │
│  - Log everything                       │
└─────────────────────────────────────────┘
```

### Future Enhancements (Not Yet Implemented)

- **On-demand verification** when users view subscription settings
- **Webhook monitoring & alerting** for delivery failures
- **Failed webhook retry queue** with DLQ pattern

---

## Implementation Details

### File Structure

```
backend/
├── services/
│   ├── stripe-reconciliation.ts    # Core reconciliation logic (NEW)
│   └── global-scheduler.ts         # Updated with reconciliation scheduler
└── handlers/
    └── stripe/
        ├── webhook.ts               # Existing webhook handler
        └── webhook-utils/           # Webhook event processors
            ├── subscription-created.ts
            ├── subscription-updated.ts
            └── subscription-deleted.ts
```

### Dependencies

```typescript
import { stripe } from 'backend/utils/stripe-config';        // Stripe client
import { db } from 'backend/db/db';                          // Database client
import { subsUser } from '@shared/db/schema/subscriptions';   // Subscription schema
import { subscriptionTiers } from '@shared/db/schema/organizations'; // Tiers
import { stripeCustomers } from '@shared/db/schema/stripe';   // Customers
```

---

## Reconciliation Logic

### Main Flow

```typescript
async function reconcileSubscriptions(): Promise<ReconciliationReport> {
  // 1. Fetch all subscriptions from Stripe (with pagination)
  const stripeSubscriptions = await fetchAllStripeSubscriptions();

  // 2. Fetch all subscriptions from local DB
  const dbSubscriptions = await db.select().from(subsUser);

  // 3. Create lookup map for efficient comparison
  const dbSubscriptionMap = new Map(
    dbSubscriptions.map(sub => [sub.stripeSubscriptionId, sub])
  );

  // 4. Compare each Stripe subscription with DB
  for (const stripeSub of stripeSubscriptions) {
    const dbSub = dbSubscriptionMap.get(stripeSub.id);

    if (!dbSub) {
      // Discrepancy Type 1: Missing in DB
      await handleMissingSubscription(stripeSub, report);
    } else {
      // Discrepancy Types 2-4: Status, tier, metadata mismatches
      await checkSubscriptionDiscrepancies(stripeSub, dbSub, report);
    }
  }

  // 5. Return comprehensive report
  return report;
}
```

### Discrepancy Types Detected

#### 1. Missing in Database

**Condition:** Subscription exists in Stripe but not in local DB

**Action:**
- Extract userId, customerId, email from Stripe metadata
- Look up tier by Stripe price ID
- Create stripe_customers record if needed
- Insert new subscription record in DB

```typescript
await db.insert(subsUser).values({
  userId,
  tierId: tier.id,
  status: stripeSub.status,
  startDate: new Date(stripeSub.start_date * 1000),
  stripeCustomerId: customerId,
  stripeSubscriptionId: stripeSub.id,
  metadata: {
    tier: tier.name,
    current_period: { start, end },
    cancel_at_period_end: stripeSub.cancel_at_period_end,
    promo_code: stripeSub.discounts.length > 0
  }
});
```

#### 2. Status Mismatch

**Condition:** Subscription status differs between Stripe and DB

**Examples:**
- Stripe: `active`, DB: `canceled`
- Stripe: `past_due`, DB: `active`

**Action:** Update DB status to match Stripe

```typescript
if (stripeSub.status !== dbSub.status) {
  updates.status = stripeSub.status;
  // Log discrepancy for monitoring
}
```

#### 3. Tier Mismatch

**Condition:** Price ID in Stripe maps to different tier than stored in DB

**Example:**
- User upgraded from monthly to yearly plan
- Webhook was missed
- DB still shows old tier

**Action:** Update DB tier to match Stripe price

```typescript
const priceId = stripeSub.items.data[0]?.price.id;
const tierResult = await db
  .select()
  .from(subscriptionTiers)
  .where(eq(subscriptionTiers.stripePriceId, priceId));

if (tierResult[0].id !== dbSub.tierId) {
  updates.tierId = tierResult[0].id;
}
```

#### 4. Metadata Mismatch

**Condition:** Subscription metadata differs (promo codes, billing period, etc.)

**Action:** Update DB metadata to match Stripe

```typescript
const stripePromoCode = stripeSub.discounts.length > 0;
const dbPromoCode = dbSub.metadata?.promo_code;

if (stripePromoCode !== dbPromoCode) {
  updates.metadata = {
    ...dbSub.metadata,
    promo_code: stripePromoCode,
    current_period: { start, end },
    cancel_at_period_end: stripeSub.cancel_at_period_end
  };
}
```

### Pagination Handling

Stripe's List API returns up to 100 results per request. The reconciliation handles pagination automatically:

```typescript
async function fetchAllStripeSubscriptions(): Promise<Stripe.Subscription[]> {
  const subscriptions: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  while (hasMore) {
    const response = await stripe.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.customer', 'data.items.data.price']
    });

    subscriptions.push(...response.data);
    hasMore = response.has_more;

    if (hasMore && response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  return subscriptions;
}
```

---

## Scheduling & Frequency

### Daily Schedule

**Time:** 2am EST (Eastern Standard Time)
**Reason:** Off-peak hours, between scraping runs (12am and 3am)

### Implementation

The reconciliation is integrated into the existing global scheduler:

```typescript
// In global-scheduler.ts

// Calculate next 2am EST
function getNext2amESTTime(): Date {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const estOffset = -5 * 60 * 60000;
  const estTime = new Date(utcTime + estOffset);

  const next2am = new Date(estTime);
  next2am.setHours(2, 0, 0, 0);

  if (next2am <= estTime) {
    next2am.setDate(next2am.getDate() + 1);
  }

  const systemTime = new Date(next2am.getTime() - estOffset);
  return systemTime;
}

// Initialize daily reconciliation
async function initializeStripeReconciliation(): Promise<void> {
  nextReconciliationAt = getNext2amESTTime();
  const delay = nextReconciliationAt.getTime() - Date.now();

  const scheduleNextReconciliation = () => {
    stripeReconciliationTimer = setTimeout(async () => {
      await executeStripeReconciliation();
      scheduleNextReconciliation(); // Reschedule for next day
    }, delay);
  };

  scheduleNextReconciliation();
}
```

### Integration with Global Scheduler

```typescript
export async function initializeGlobalScheduler(): Promise<boolean> {
  // ... existing scraper initialization ...

  // Initialize Stripe reconciliation scheduler
  await initializeStripeReconciliation();

  return true;
}
```

---

## Error Handling

### Graceful Failure Recovery

The reconciliation system is designed to never disrupt the main scheduler:

```typescript
try {
  const report = await reconcileSubscriptions();
  log('[STRIPE RECONCILIATION] Completed successfully');
} catch (error) {
  // Log error but don't throw - keeps scheduler running
  log(`[STRIPE RECONCILIATION] Error: ${error.message}`, 'error');
}
```

### Individual Subscription Error Handling

If one subscription fails to reconcile, continue processing others:

```typescript
for (const stripeSub of stripeSubscriptions) {
  try {
    // Process this subscription
  } catch (error) {
    // Log error for this subscription
    report.errors.push(`Error processing ${stripeSub.id}: ${error.message}`);
    // Continue to next subscription
  }
}
```

### Retry Logic for Transient Errors

Stripe SDK automatically retries on network errors. For persistent errors, the system:
- Logs the error with full context
- Marks discrepancy as "failed to fix"
- Includes in reconciliation report
- Will retry in next daily run (24 hours later)

---

## Monitoring & Observability

### Reconciliation Report Structure

```typescript
interface ReconciliationReport {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;                    // milliseconds
  subscriptionsChecked: number;
  discrepanciesFound: number;
  discrepanciesFixed: number;
  discrepanciesFailed: number;
  discrepancies: ReconciliationDiscrepancy[];
  errors: string[];
}
```

### Discrepancy Details

```typescript
interface ReconciliationDiscrepancy {
  type: 'missing_in_db' | 'status_mismatch' | 'tier_mismatch' | 'metadata_mismatch';
  stripeSubscriptionId: string;
  userId?: string;
  details: string;
  before?: any;                        // State before fix
  after?: any;                         // State after fix
  fixed: boolean;
  error?: string;                      // If fix failed
}
```

### Logging Strategy

All reconciliation activities are logged with context:

```typescript
// Start of reconciliation
log('[STRIPE RECONCILIATION] Starting subscription reconciliation', 'stripe-reconciliation');

// Discovery of discrepancies
log('[STRIPE RECONCILIATION] DISCREPANCY: Status mismatch...', 'stripe-reconciliation');

// Successful fixes
log('[STRIPE RECONCILIATION] ✓ Updated subscription abc123', 'stripe-reconciliation');

// Failures
log('[STRIPE RECONCILIATION] ✗ Failed to update: error message', 'stripe-reconciliation-error');

// Summary
log('[STRIPE RECONCILIATION] Completed: 3 found, 2 fixed, 1 failed in 1234ms', 'stripe-reconciliation');
```

### Scheduler Status API

The global scheduler status now includes reconciliation info:

```typescript
getGlobalSchedulerStatus() {
  return {
    scraper: { /* existing scraper status */ },
    stripeReconciliation: {
      initialized: boolean,
      lastRun: string | null,
      lastRunEST: string | null,
      nextRun: string,
      nextRunEST: string,
      schedule: 'Daily at 2am EST',
      description: 'Stripe subscription reconciliation - keeps DB in sync with Stripe'
    }
  };
}
```

---

## API Rate Limits

### Stripe Rate Limits

- **Live mode:** 100 read requests per second
- **Test mode:** 25 read requests per second

### Reconciliation API Usage

For a typical SaaS application:

**Per reconciliation run:**
- List subscriptions: ~1-5 API calls (depends on pagination)
- No additional calls (all data fetched via expand parameter)

**Example calculation (100 subscriptions):**
- 1 API call to list 100 subscriptions
- Total: **~1-2 calls per day**

**Example calculation (500 subscriptions):**
- 5 API calls to list 500 subscriptions (100 per page)
- Total: **~5 calls per day**

### Impact Assessment

With daily reconciliation:
- **100 subscriptions:** 1-2 calls/day = negligible
- **1,000 subscriptions:** 10 calls/day = negligible
- **10,000 subscriptions:** 100 calls/day = 0.001 calls/second = 0.001% of limit

**Conclusion:** Even at scale, reconciliation is well within Stripe's rate limits.

---

## Best Practices

### 1. Stripe as Source of Truth

Always update the local database to match Stripe, never the reverse:

```typescript
// ✅ CORRECT
if (stripeSub.status !== dbSub.status) {
  await db.update(subsUser).set({ status: stripeSub.status });
}

// ❌ WRONG
if (stripeSub.status !== dbSub.status) {
  await stripe.subscriptions.update(stripeSub.id, {
    status: dbSub.status
  });
}
```

**Rationale:** Stripe owns the billing relationship. The local DB is a cache for performance.

### 2. Preserve Audit Trail

Log all changes with before/after values:

```typescript
const discrepancy: ReconciliationDiscrepancy = {
  type: 'status_mismatch',
  details: `Status mismatch: Stripe='${stripeSub.status}', DB='${dbSub.status}'`,
  before: { status: dbSub.status },
  after: { status: stripeSub.status },
  fixed: true
};
```

### 3. Idempotency

Reconciliation should be safe to run multiple times:

```typescript
// Always check current state before updating
if (stripeSub.status !== dbSub.status) {
  await updateStatus();
}

// Not: Always update unconditionally
```

### 4. Error Isolation

Don't let one failure stop the entire reconciliation:

```typescript
for (const subscription of subscriptions) {
  try {
    await reconcileOne(subscription);
  } catch (error) {
    // Log but continue
    logError(error);
  }
}
```

### 5. Webhook Priority

Webhooks remain the primary sync mechanism. Reconciliation is the safety net:

```
Webhooks:     Real-time, efficient, primary mechanism
Reconciliation: Daily, comprehensive, safety net for missed events
```

### 6. Metadata Enrichment

Use Stripe metadata to store essential identifiers:

```typescript
await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  metadata: {
    userId: req.user.id,          // Essential for reconciliation
    email: req.user.email,        // Helpful for debugging
    customerId: customerId,       // Redundant but useful
    billingPeriod: 'monthly'      // Additional context
  }
});
```

---

## Usage Examples

### Running Manually (Development/Testing)

```typescript
import { reconcileSubscriptions } from 'backend/services/stripe-reconciliation';

// Run reconciliation manually
const report = await reconcileSubscriptions();

console.log('Discrepancies found:', report.discrepanciesFound);
console.log('Discrepancies fixed:', report.discrepanciesFixed);
console.log('Duration:', report.duration, 'ms');

// Inspect details
report.discrepancies.forEach(d => {
  console.log(`- ${d.type}: ${d.details}`);
  console.log(`  Before:`, d.before);
  console.log(`  After:`, d.after);
  console.log(`  Fixed:`, d.fixed);
});
```

### Checking Scheduler Status

```typescript
import { getGlobalSchedulerStatus } from 'backend/services/global-scheduler';

const status = getGlobalSchedulerStatus();

console.log('Reconciliation Status:');
console.log('- Initialized:', status.stripeReconciliation.initialized);
console.log('- Last run:', status.stripeReconciliation.lastRunEST);
console.log('- Next run:', status.stripeReconciliation.nextRunEST);
```

### Forcing Immediate Reconciliation

If you suspect sync issues and want to run reconciliation immediately:

```typescript
import { reconcileSubscriptions } from 'backend/services/stripe-reconciliation';

// In admin endpoint or debugging script
await reconcileSubscriptions();
```

---

## Conclusion

The Stripe reconciliation system provides a robust safety net for subscription data synchronization. By running daily at 2am EST, it ensures that even if webhooks fail, the database stays in sync with Stripe within 24 hours.

### Key Takeaways

- ✅ **Automated:** Runs daily without manual intervention
- ✅ **Reliable:** Handles errors gracefully, logs everything
- ✅ **Efficient:** Minimal API usage, well within rate limits
- ✅ **Observable:** Comprehensive reporting and logging
- ✅ **Maintainable:** Clean separation from webhook logic

### Next Steps

Consider implementing additional layers:
- On-demand verification when users view settings
- Webhook monitoring dashboard
- Failed webhook retry queue with DLQ pattern

---

## Related Documentation

- [Stripe Webhooks Best Practices](https://stripe.dev/blog/building-solid-stripe-integrations-developers-guide-success)
- [Database Reconciliation Patterns](https://stripe.dev/blog/database-reconciliation-growing-businesses-part-3)
- [Webhook Integration Guide](../backend/handlers/stripe/webhook.ts)

---

*Last updated: October 27, 2025*
