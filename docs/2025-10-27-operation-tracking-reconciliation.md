# Stripe Operation-Tracking Reconciliation System

**Date:** October 27, 2025
**Author:** Development Team
**Status:** Implemented

## Table of Contents

1. [Overview](#overview)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [Architecture](#architecture)
5. [Implementation Details](#implementation-details)
6. [Operation Flow](#operation-flow)
7. [Scheduling](#scheduling)
8. [Benefits & Comparison](#benefits--comparison)
9. [Database Schema](#database-schema)
10. [Code Examples](#code-examples)
11. [Monitoring](#monitoring)

---

## Overview

This document describes a **smarter, more efficient** approach to keeping our database in sync with Stripe: **operation tracking with targeted verification**.

Instead of polling all subscriptions daily (expensive and slow), we:
1. **Log every Stripe API call** we make
2. **Track webhook arrivals** for each operation
3. **Check hourly** for operations missing webhooks (>1 minute old)
4. **Make targeted API calls** only for missed webhooks
5. **Keep weekly full reconciliation** as ultimate safety net

### Key Improvements

- **95% fewer API calls** (from 10-100/day to 0-5/day)
- **Much faster detection** (1 hour max vs 24 hours)
- **Complete audit trail** of all operations
- **Intelligent & event-driven** vs periodic polling

---

## The Problem

### Webhook-Based Sync Risk

Our application relies on webhooks for real-time sync:

```
1. Our server → Stripe API call (create subscription)
2. Stripe processes → Sends webhook
3. Webhook handler → Updates local DB
```

**Problem:** If webhooks fail (network issues, server downtime, bugs), DB becomes out of sync.

### Previous Solution: Daily Full Reconciliation

- Fetched ALL subscriptions from Stripe daily
- Compared with entire local DB
- Fixed any discrepancies

**Downsides:**
- Expensive (many API calls)
- Slow detection (up to 24 hours out of sync)
- Wasteful (checks subscriptions that didn't change)

---

## The Solution

### Operation-Tracking Reconciliation

**Core Insight:** We only need to verify operations that WE initiated. If we log every API call and track webhook responses, we can detect missed webhooks immediately and verify only those specific operations.

```
┌─────────────────────────────────────────────┐
│  Step 1: Our Handler Calls Stripe API      │
│  → Log operation to stripe_operations_log  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Step 2: Stripe Sends Webhook              │
│  → Mark webhook_received = true in log     │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Step 3: Hourly Job Checks for Missed      │
│  → Find webhook_received = false (>1 min)  │
│  → Make targeted API call to verify        │
│  → Update DB if needed                     │
│  → Mark as verified/fixed                  │
└─────────────────────────────────────────────┘
```

---

## Architecture

### Three-Layer System

#### Layer 1: Hourly Targeted Verification (Primary)
- **When:** Every hour at :00
- **What:** Checks operations with `webhook_received = false` (>1 minute old)
- **Action:** Makes targeted Stripe API call to verify
- **API Impact:** 0-5 calls/hour (only for missed webhooks)

#### Layer 2: Daily Cleanup
- **When:** Every day at 3am EST
- **What:** Deletes operation logs older than 7 days
- **Purpose:** Keep database lean

#### Layer 3: Weekly Full Reconciliation (Ultimate Safety Net)
- **When:** Every Sunday at 2am EST
- **What:** Full comparison of all subscriptions (old approach)
- **Purpose:** Catch any edge cases not covered by operation tracking

---

## Implementation Details

### Files Created/Modified

#### 1. New Database Table
**File:** `shared/db/schema/stripe.ts`

Added `stripeOperationsLog` table:
- Tracks every Stripe API call
- Correlates with webhook responses
- 7-day retention

#### 2. Operation Tracker Service
**File:** `backend/services/stripe-operation-tracker.ts`

New functions:
- `logStripeOperation()` - Log API calls immediately
- `markWebhookReceived()` - Mark when webhook arrives
- `verifyPendingOperations()` - Hourly verification job
- `cleanupOldOperationLogs()` - Daily cleanup

#### 3. Stripe Handlers Updated (4 files)
All handlers now log operations after Stripe API calls:
- `backend/utils/stripe/create-free-sub.ts`
- `backend/handlers/stripe/subscribe-to-pro.ts`
- `backend/handlers/stripe/upgrade-subscription.ts`
- `backend/handlers/stripe/downgrade-subscription.ts`

#### 4. Webhook Handler Updated
**File:** `backend/handlers/stripe/webhook.ts`

Now calls `markWebhookReceived()` after processing each webhook event.

#### 5. Scheduler Updated
**File:** `backend/services/global-scheduler.ts`

New schedules:
- Hourly: Operation verification
- Daily 3am EST: Cleanup old logs
- Weekly Sunday 2am EST: Full reconciliation (reduced from daily)

---

## Operation Flow

### Example: User Subscribes to Pro

```typescript
// 1. Handler receives request
export default async function handleSubscribeToPro(req, res) {
  // ... validation ...

  // 2. Call Stripe API
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: PRO_PRICE_ID }],
    metadata: { userId, email, customerId }
  });

  // 3. Log the operation immediately
  await logStripeOperation({
    operationType: 'create_subscription',
    userId: req.user.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    requestPayload: { tierType: 'pro', billingPeriod }
  });

  // 4. Return success to user
  res.json({ success: true, subscription });
}
```

### Normal Flow: Webhook Arrives

```typescript
// Webhook handler processes subscription.created event
export async function handleStripeWebhook(req, res) {
  const event = stripe.webhooks.constructEvent(req.body, sig, secret);

  switch (event.type) {
    case 'customer.subscription.created':
      // Process webhook (update DB)
      await handleSubscriptionCreated(event.data.object);

      // Mark operation as webhook-received
      await markWebhookReceived(
        event.data.object.id,
        'create_subscription',
        event.id
      );
      break;
  }
}
```

### If Webhook is Missed

```typescript
// Hourly job runs at :00 of each hour
async function executeStripeVerification() {
  // Find operations with webhook_received = false (>1 min old)
  const report = await verifyPendingOperations();

  // For each pending operation:
  // 1. Call stripe.subscriptions.retrieve(id)
  // 2. Check if DB matches Stripe
  // 3. Update DB if needed
  // 4. Mark as 'verified' or 'fixed'
}
```

---

## Scheduling

### Hourly Verification (Every hour at :00)

```typescript
async function initializeStripeVerification() {
  nextVerificationAt = getNextHourTime();
  const msToNextHour = nextVerificationAt.getTime() - Date.now();

  stripeVerificationTimer = setTimeout(async () => {
    await executeStripeVerification();

    // Switch to hourly interval
    stripeVerificationTimer = setInterval(async () => {
      await executeStripeVerification();
    }, 60 * 60 * 1000); // 1 hour
  }, msToNextHour);
}
```

### Weekly Full Reconciliation (Sunday 2am EST)

```typescript
function getNextSunday2amESTTime(): Date {
  // Calculate days until next Sunday
  const currentDay = nextDate.getDay();
  let daysUntilSunday = 7 - currentDay;
  if (currentDay === 0 && next2am <= estTime) {
    daysUntilSunday = 7; // Next Sunday
  } else if (currentDay === 0) {
    daysUntilSunday = 0; // Today before 2am
  }

  next2am.setDate(next2am.getDate() + daysUntilSunday);
  return systemTime;
}
```

### Daily Cleanup (3am EST)

```typescript
async function executeCleanup() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  await db
    .delete(stripeOperationsLog)
    .where(lt(stripeOperationsLog.timestamp, sevenDaysAgo));

  log(`Deleted ${deletedCount} old operation logs`);
}
```

---

## Benefits & Comparison

### API Call Reduction

| Approach | API Calls/Day | Detection Time | Efficiency |
|----------|---------------|----------------|------------|
| **Daily Full Reconciliation** | 10-100 | Up to 24 hours | ❌ Wasteful |
| **Operation Tracking (New)** | 0-5 | Up to 1 hour | ✅ Targeted |
| **Reduction** | **95%+** | **96% faster** | **Event-driven** |

### Example Scenarios

#### Scenario 1: Normal Operation (No Missed Webhooks)
- **Old approach:** 50 API calls daily to check all subscriptions
- **New approach:** 0 API calls (all webhooks received)
- **Savings:** 100%

#### Scenario 2: 2 Missed Webhooks Per Day
- **Old approach:** 50 API calls daily
- **New approach:** 2 API calls (targeted verification)
- **Savings:** 96%

#### Scenario 3: Heavy Day (10 Missed Webhooks)
- **Old approach:** 50 API calls daily
- **New approach:** 10 API calls
- **Savings:** 80%

### Detection Speed Comparison

| Issue | Old Detection | New Detection | Improvement |
|-------|---------------|---------------|-------------|
| Webhook missed at 9:15am | Next day 2am (16h 45m) | Next hour 10:00am (45min) | **96% faster** |
| Webhook missed at 1:50am | Same day 2am (10min) | Next hour 2:00am (10min) | **Same** |
| Average case | **~12 hours** | **~30 minutes** | **96% faster** |

---

## Database Schema

### stripe_operations_log Table

```sql
CREATE TABLE stripe_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Operation Details
  operation_type TEXT NOT NULL,  -- 'create_subscription', 'upgrade_subscription', etc.
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Identifiers
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,  -- NULL for creates (set later)

  -- Request Data
  request_payload JSONB,  -- What we sent to Stripe

  -- Webhook Correlation
  webhook_received BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_timestamp TIMESTAMP,
  webhook_event_id TEXT,

  -- Verification Status
  verification_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'verified', 'fixed', 'failed'
  verification_timestamp TIMESTAMP,
  verification_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for hourly verification query
CREATE INDEX idx_stripe_operations_verification
  ON stripe_operations_log (webhook_received, timestamp, verification_status)
  WHERE webhook_received = false AND verification_status = 'pending';
```

---

## Code Examples

### Logging an Operation

```typescript
// In any Stripe handler, immediately after API call
await logStripeOperation({
  operationType: 'upgrade_subscription',
  userId: req.user.id,
  stripeCustomerId: customer.id,
  stripeSubscriptionId: subscription.id,
  requestPayload: {
    fromTier: 'free',
    toTier: 'pro',
    billingPeriod,
    hasPromoCode: !!promotionCodeId
  }
});
```

### Marking Webhook Received

```typescript
// In webhook handler, after successful processing
await markWebhookReceived(
  subscriptionId,
  'upgrade_subscription',
  event.id
);
```

### Verification Report

```typescript
interface VerificationReport {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  operationsChecked: number;
  webhooksMissed: number;
  verificationsSucceeded: number;
  verificationsFailed: number;
  details: {
    operationId: string;
    operationType: string;
    status: 'verified' | 'fixed' | 'failed';
    notes: string;
  }[];
}
```

---

## Monitoring

### Log Messages

All operations are logged with context:

```
[OPERATION TRACKER] Logged create_subscription for user abc123, subscription sub_xxx
[OPERATION TRACKER] Marked webhook received for operation op_xxx, subscription sub_xxx
[STRIPE VERIFICATION] Starting hourly operation verification
[STRIPE VERIFICATION] Found 3 pending operations to verify
[STRIPE VERIFICATION] Webhook missed: subscription sub_xxx not in DB
[STRIPE VERIFICATION] Completed: 3 operations checked, 1 webhook missed, 1 fixed, 0 failed in 1234ms
```

### Scheduler Status API

```typescript
getGlobalSchedulerStatus() {
  return {
    stripeVerification: {
      initialized: true,
      lastRun: '2025-10-27T14:00:00Z',
      nextRun: '2025-10-27T15:00:00Z',
      schedule: 'Every hour at :00',
      description: 'Targeted verification for operations with missed webhooks'
    },
    stripeReconciliation: {
      initialized: true,
      lastRun: '2025-10-27T02:00:00Z',
      nextRun: '2025-11-03T02:00:00Z',
      schedule: 'Weekly at Sunday 2am EST',
      description: 'Full reconciliation - ultimate safety net for edge cases'
    }
  };
}
```

### Monitoring Checklist

**Daily:**
- Check logs for verification runs every hour
- Look for operations with `verification_status = 'failed'`

**Weekly:**
- Review verification reports for patterns
- Check if weekly full reconciliation finds any issues

**Monthly:**
- Analyze API usage (should be <150 calls/month)
- Review operation log retention (should be 7 days)

---

## Best Practices

### 1. Always Log After Stripe API Call

```typescript
// ✅ CORRECT: Log immediately after successful API call
const subscription = await stripe.subscriptions.create(params);
await logStripeOperation({ ... });

// ❌ WRONG: Don't log before API call
await logStripeOperation({ ... });
const subscription = await stripe.subscriptions.create(params);
```

### 2. Include Rich Payload Data

```typescript
// ✅ CORRECT: Include useful debugging info
await logStripeOperation({
  operationType: 'upgrade_subscription',
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  requestPayload: {
    fromTier: 'free',
    toTier: 'pro',
    billingPeriod: 'monthly',
    hasPromoCode: true,
    promoCodeId: 'promo_xxx'
  }
});

// ❌ WRONG: Minimal data
await logStripeOperation({
  operationType: 'upgrade_subscription',
  userId,
  stripeCustomerId,
  stripeSubscriptionId
});
```

### 3. Handle Verification Failures

```typescript
// Operations marked as 'failed' need manual review
const failedOps = await db
  .select()
  .from(stripeOperationsLog)
  .where(eq(stripeOperationsLog.verificationStatus, 'failed'));

// Investigate each failure
for (const op of failedOps) {
  console.log('Failed operation:', op.id);
  console.log('Notes:', op.verificationNotes);
  // Manual intervention may be required
}
```

---

## Conclusion

The operation-tracking reconciliation system provides a **smarter, more efficient** way to keep our database in sync with Stripe:

### Key Achievements

✅ **95% fewer API calls** - From 10-100/day to 0-5/day
✅ **96% faster detection** - From 12 hours average to 30 minutes
✅ **Complete audit trail** - Every operation logged with full context
✅ **Intelligent verification** - Only checks operations that need it
✅ **Triple safety net** - Hourly verification + weekly full scan + audit logs

### Next Steps

1. **Monitor initial performance** - Track API usage and detection times
2. **Review failed operations** - Investigate any patterns in failures
3. **Consider additional operations** - Expand tracking to payment methods, promo codes, etc.
4. **Add alerting** - Set up notifications for high failure rates

---

## Related Documentation

- [Stripe Reconciliation Implementation](./2025-10-27-stripe-reconciliation-implementation.md) - Original daily reconciliation approach
- [Webhook Integration Guide](../backend/handlers/stripe/webhook.ts) - Webhook processing details

---

*Last updated: October 27, 2025*
