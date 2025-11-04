# Preventing Duplicate Stripe Customers

**Date**: November 4, 2025
**Status**: Implementation Plan
**Priority**: High - Prevents critical data integrity issues

---

## Problem Statement

### Current Issue

Users can have multiple Stripe customer records, causing subscription operations to fail with "No active subscription found" errors.

**Example Case**:
- User: `rloss+preview03@altairtek.com`
- Customer 1: `cus_TMHAUsWLiboESP` (empty, no subscriptions)
- Customer 2: `cus_TMHAfU2WiZtw0H` (has active subscription)
- When user tries to upgrade, system finds Customer 1 → fails

### Root Causes

1. **No Database Constraint**: `stripe_customers` table has no unique constraint on `user_id`
2. **Email-Based Search**: Both customer creation points search Stripe by email (unreliable due to eventual consistency)
3. **Race Conditions**: Multiple concurrent requests can both create customers
4. **No Idempotency**: No idempotency keys used for Stripe API calls
5. **Two Creation Points**: Customers created in multiple locations without coordination

### Current Customer Creation Locations

1. **`backend/utils/stripe/create-free-sub.ts` (lines 13-29)**
   - Called during onboarding
   - Searches by email only
   - No userId metadata stored

2. **`backend/handlers/stripe/create-setup-intent.ts` (lines 16-36)**
   - Called when user adds payment method
   - Searches by email only
   - Does store userId metadata

---

## Solution: Centralized Customer Management

### Core Principle

**Database as Source of Truth** → Always check database first, sync bidirectionally with Stripe

### Implementation: `findOrCreateCustomer()` Function

Create a new utility function that enforces 1 user = 1 customer.

---

## Complete Function Code

```typescript
// backend/utils/stripe/find-or-create-customer.ts

import { db } from 'backend/db/db';
import { stripeCustomers } from '@shared/db/schema/stripe';
import { stripe } from 'backend/utils/stripe-config';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

interface FindOrCreateCustomerParams {
  userId: string;
  email: string;
}

interface FindOrCreateCustomerResult {
  customer: Stripe.Customer;
  isNew: boolean;
}

/**
 * Find or create a Stripe customer for a user.
 *
 * Guarantees:
 * - One customer per user (enforced by database constraint)
 * - Database is always in sync with Stripe
 * - Idempotent (safe to call multiple times with same userId)
 * - Handles edge cases (deleted customers, orphaned records)
 *
 * The function generates an idempotency key internally based on userId
 * to ensure the same customer is always returned for the same user.
 *
 * @param userId - The user's UUID
 * @param email - The user's email address
 * @returns The Stripe customer and whether it was newly created
 */
export async function findOrCreateCustomer({
  userId,
  email,
}: FindOrCreateCustomerParams): Promise<FindOrCreateCustomerResult> {

  // ========================================================================
  // STEP 1: Check database first (source of truth)
  // ========================================================================

  const existingCustomers = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1);

  if (existingCustomers.length > 0) {
    const dbCustomer = existingCustomers[0];

    // Verify customer still exists in Stripe
    try {
      const stripeCustomer = await stripe.customers.retrieve(dbCustomer.stripeCustomerId);

      // Check if customer was deleted
      if (stripeCustomer.deleted) {
        console.log(`[CUSTOMER] Customer ${dbCustomer.stripeCustomerId} was deleted in Stripe`);

        // Mark as deleted in database
        await db
          .update(stripeCustomers)
          .set({ isDeleted: true })
          .where(eq(stripeCustomers.id, dbCustomer.id));

        // Fall through to search Stripe or create new customer
      } else {
        // Customer exists and is valid
        console.log(`[CUSTOMER] Found existing customer ${dbCustomer.stripeCustomerId} for user ${userId}`);

        // Check if metadata has userId (for backward compatibility with old customers)
        if (!stripeCustomer.metadata?.userId) {
          console.log(`[CUSTOMER] Updating customer ${dbCustomer.stripeCustomerId} metadata with userId`);

          // Update Stripe customer to include userId in metadata
          await stripe.customers.update(dbCustomer.stripeCustomerId, {
            metadata: {
              ...stripeCustomer.metadata,
              userId,
            },
          });

          // Update the local object
          stripeCustomer.metadata = {
            ...stripeCustomer.metadata,
            userId,
          };
        }

        return { customer: stripeCustomer as Stripe.Customer, isNew: false };
      }
    } catch (error: any) {
      // Handle customer not found in Stripe
      if (error.code === 'resource_missing') {
        console.log(`[CUSTOMER] Customer ${dbCustomer.stripeCustomerId} not found in Stripe`);

        // Mark as deleted in database
        await db
          .update(stripeCustomers)
          .set({ isDeleted: true })
          .where(eq(stripeCustomers.id, dbCustomer.id));

        // Fall through to search Stripe or create new customer
      } else {
        // Other errors (network, auth, etc.) should throw
        throw error;
      }
    }
  }

  // ========================================================================
  // STEP 2: Search Stripe by userId metadata (more reliable than email)
  // ========================================================================

  const searchResult = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
  });

  if (searchResult.data.length > 0) {
    const stripeCustomer = searchResult.data[0];

    console.log(`[CUSTOMER] Found orphaned Stripe customer ${stripeCustomer.id}, syncing to DB`);

    // Found customer in Stripe but not in database - sync to DB
    await db.insert(stripeCustomers).values({
      userId,
      organizationId: null,
      stripeCustomerId: stripeCustomer.id,
      email: stripeCustomer.email || email,
      metadata: {},
      isDeleted: false,
    });

    return { customer: stripeCustomer, isNew: false };
  }

  // ========================================================================
  // STEP 3: Create new customer (doesn't exist anywhere)
  // ========================================================================

  console.log(`[CUSTOMER] Creating new Stripe customer for user ${userId}`);

  const options: Stripe.CustomerCreateParams = {
    email,
    metadata: {
      userId, // CRITICAL: Store userId for reliable searching
    },
  };

  // Generate idempotency key based on userId for consistency
  // This ensures the same customer is returned if function is called multiple times
  const idempotencyKey = `customer-${userId}`;

  // Create customer with idempotency key to prevent duplicates on retry
  const newCustomer = await stripe.customers.create(options, { idempotencyKey });

  // ========================================================================
  // STEP 4: Save to database immediately
  // ========================================================================

  await db.insert(stripeCustomers).values({
    userId,
    organizationId: null,
    stripeCustomerId: newCustomer.id,
    email,
    metadata: {},
    isDeleted: false,
  });

  console.log(`[CUSTOMER] Created new Stripe customer ${newCustomer.id} for user ${userId}`);

  return { customer: newCustomer, isNew: true };
}
```

---

## Step-by-Step Explanation

### Step 1: Database Check (Lines 101-169)

**Purpose**: Check if we already have a customer record for this user.

**What it does**:
1. Query `stripe_customers` table by `userId`
2. If found, verify it still exists in Stripe
3. **Check metadata and update if needed** (backward compatibility)
4. Handle edge cases:
   - Customer was deleted in Stripe → mark deleted in DB, continue to Step 2
   - Customer missing in Stripe → mark deleted in DB, continue to Step 2
   - Customer valid → **return immediately** (most common case)

**Metadata Migration** (Lines 129-146):
When an existing customer is found but doesn't have `userId` in metadata:
- Updates Stripe customer metadata to include `userId`
- Ensures all customers can be found by userId search in future
- Handles migration from old customers without breaking anything

**Why "fall through"**: If customer was deleted, user might have another customer in Stripe that we don't know about yet. Step 2 will find it.

---

### Step 2: Stripe Metadata Search (Lines 93-114)

**Purpose**: Find orphaned customers in Stripe that aren't in our database.

**What it does**:
1. Search Stripe by `metadata.userId` (NOT email)
2. If found, sync to database
3. Return the customer

**Why userId not email**:
- Email search has eventual consistency issues
- userId is unique and always accurate
- Handles cases where customer was manually created in Stripe

**When this runs**:
- Database had deleted/missing customer (from Step 1)
- OR database had no customer at all
- Checks if Stripe has an orphaned customer before creating new one

---

### Step 3: Create New Customer (Lines 116-131)

**Purpose**: Create a brand new customer (doesn't exist anywhere).

**What it does**:
1. Create customer in Stripe with email and userId metadata
2. Use idempotency key to prevent duplicates on retry

**Idempotency key**:
- Same key = same customer returned
- Prevents race conditions
- Safe to retry on network failure

---

### Step 4: Save to Database (Lines 133-142)

**Purpose**: Keep database in sync with Stripe.

**What it does**:
1. Insert customer record into `stripe_customers` table
2. Store: userId, customerId, email, metadata

**Why immediately**: Next call to `findOrCreateCustomer()` will find it in Step 1.

---

## Usage Examples

### Example 1: Free Subscription Creation

```typescript
// backend/utils/stripe/create-free-sub.ts

import { findOrCreateCustomer } from './find-or-create-customer';

export default async function createFreeSub({ userId, email }: Args): Promise<void> {
  console.log("Creating free subscription...")

  // Get or create customer (guaranteed to be unique)
  // Idempotency is handled internally based on userId
  const { customer, isNew } = await findOrCreateCustomer({
    userId,
    email,
  });

  if (isNew) {
    console.log("Created new customer for free subscription");
  } else {
    console.log("Using existing customer for free subscription");
  }

  // Check if subscription already exists
  const subResult = await stripe.subscriptions.list({
    customer: customer.id
  });

  if (subResult.data.length > 0) {
    console.log("User already has subscription, skipping...");
    return;
  }

  // Create free subscription
  await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: process.env.FREE_PRICE_ID }],
    metadata: {
      userId,
      email,
      customerId: customer.id,
    }
  });
}
```

---

### Example 2: Setup Intent Creation

```typescript
// backend/handlers/stripe/create-setup-intent.ts

import { findOrCreateCustomer } from 'backend/utils/stripe/find-or-create-customer';

export default async function handleCreateSetupIntent(req: FullRequest, res: Response) {
  try {
    const { email } = req.user;
    const { billingPeriod = 'monthly' } = req.body;

    // Get or create customer
    // Idempotency is handled internally based on userId
    const { customer, isNew } = await findOrCreateCustomer({
      userId: req.user.id,
      email,
    });

    console.log(`[SETUP-INTENT] Using customer ${customer.id} (new: ${isNew})`);

    // Create SetupIntent for payment method collection
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: req.user.id,
        billingPeriod,
      },
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    });
  } catch (error) {
    console.error('[SETUP-INTENT] Error:', error);
    res.status(500).json({
      error: 'Failed to create setup intent',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
```

---

### Example 3: Validating Customer Ownership

```typescript
// backend/handlers/stripe/subscribe-to-pro.ts

export default async function handleSubscribeToPro(req: FullRequest, res: Response) {
  try {
    const { paymentMethodId, customerId, promotionCodeId, billingPeriod } = req.body;

    // CRITICAL: Validate customerId belongs to this user
    const customerCheck = await db
      .select()
      .from(stripeCustomers)
      .where(
        and(
          eq(stripeCustomers.userId, req.user.id),
          eq(stripeCustomers.stripeCustomerId, customerId),
          eq(stripeCustomers.isDeleted, false)
        )
      )
      .limit(1);

    if (customerCheck.length === 0) {
      console.error(`[SUBSCRIBE-PRO] Customer ${customerId} does not belong to user ${req.user.id}`);
      return res.status(403).json({
        error: 'Invalid customer ID'
      });
    }

    // Proceed with subscription creation...
  }
}
```

---

## Required Database Changes

### Migration 1: Add Unique Constraint

```sql
-- Ensure one Stripe customer per user
ALTER TABLE stripe_customers
ADD CONSTRAINT stripe_customers_user_id_unique UNIQUE(user_id)
WHERE user_id IS NOT NULL;
```

**What this does**:
- Database enforces 1 user = 1 customer
- Even if code has bugs, duplicates are prevented
- Partial unique index (only when user_id is not null)

**When to run**: After cleaning up existing duplicates

---

### Migration 2: Add Missing Columns (if needed)

```sql
-- Check if isDeleted column exists
ALTER TABLE stripe_customers
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id
ON stripe_customers(user_id)
WHERE is_deleted = false;
```

---

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Create `backend/utils/stripe/find-or-create-customer.ts`
- [ ] Add unit tests for the function
- [ ] Test edge cases (deleted customers, orphaned records, race conditions)

### Phase 2: Update Existing Code
- [ ] Update `backend/utils/stripe/create-free-sub.ts` to use `findOrCreateCustomer()`
- [ ] Update `backend/handlers/stripe/create-setup-intent.ts` to use `findOrCreateCustomer()`
- [ ] Add validation to `backend/handlers/stripe/subscribe-to-pro.ts`
- [ ] Update webhook handlers to use `findOrCreateCustomer()` if they create customers

### Phase 3: Database Changes
- [ ] Identify and document existing duplicate customers
- [ ] Create cleanup script to merge/delete duplicates
- [ ] Run cleanup script on staging
- [ ] Add unique constraint migration
- [ ] Deploy migration to staging
- [ ] Verify no duplicate creation possible

### Phase 4: Monitoring
- [ ] Add logging for customer creation/retrieval
- [ ] Add metrics for new vs existing customers
- [ ] Create alert for customer creation failures
- [ ] Monitor for any duplicate attempts (should be blocked by constraint)

---

## Rollout Plan

### Stage 1: Deploy Function (No Breaking Changes)
1. Deploy `findOrCreateCustomer()` function
2. No behavior changes yet
3. Monitor for errors

### Stage 2: Update create-setup-intent.ts
1. Update setup intent handler to use new function
2. Deploy to staging
3. Test payment method flow
4. Deploy to production

### Stage 3: Update create-free-sub.ts
1. Update free subscription creation to use new function
2. Deploy to staging
3. Test onboarding flow
4. Deploy to production

### Stage 4: Add Database Constraint
1. Run duplicate cleanup on staging
2. Add unique constraint on staging
3. Test all subscription flows
4. Run duplicate cleanup on production
5. Add unique constraint on production

---

## Testing Strategy

### Unit Tests

```typescript
describe('findOrCreateCustomer', () => {
  it('creates new customer when none exists', async () => {
    const { customer, isNew } = await findOrCreateCustomer({
      userId: 'test-user-1',
      email: 'test@example.com',
    });

    expect(isNew).toBe(true);
    expect(customer.email).toBe('test@example.com');
    expect(customer.metadata.userId).toBe('test-user-1');
  });

  it('returns existing customer from database', async () => {
    // Create customer first
    const { customer: firstCustomer } = await findOrCreateCustomer({
      userId: 'test-user-2',
      email: 'test2@example.com',
    });

    // Call again
    const { customer: secondCustomer, isNew } = await findOrCreateCustomer({
      userId: 'test-user-2',
      email: 'test2@example.com',
    });

    expect(isNew).toBe(false);
    expect(secondCustomer.id).toBe(firstCustomer.id);
  });

  it('syncs orphaned Stripe customer to database', async () => {
    // Manually create customer in Stripe
    const stripeCustomer = await stripe.customers.create({
      email: 'orphan@example.com',
      metadata: { userId: 'test-user-3' }
    });

    // Call function (customer exists in Stripe but not in DB)
    const { customer, isNew } = await findOrCreateCustomer({
      userId: 'test-user-3',
      email: 'orphan@example.com',
    });

    expect(isNew).toBe(false);
    expect(customer.id).toBe(stripeCustomer.id);

    // Verify it's now in database
    const dbRecord = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, 'test-user-3'));

    expect(dbRecord.length).toBe(1);
  });

  it('handles deleted customers gracefully', async () => {
    // Create customer
    const { customer: firstCustomer } = await findOrCreateCustomer({
      userId: 'test-user-4',
      email: 'deleted@example.com',
    });

    // Delete in Stripe
    await stripe.customers.del(firstCustomer.id);

    // Call again
    const { customer: newCustomer, isNew } = await findOrCreateCustomer({
      userId: 'test-user-4',
      email: 'deleted@example.com',
    });

    expect(isNew).toBe(true);
    expect(newCustomer.id).not.toBe(firstCustomer.id);
  });
});
```

### Integration Tests

1. **Test concurrent requests**:
   - Make 10 simultaneous calls to `findOrCreateCustomer()` with same userId
   - Verify only 1 customer created
   - All calls return same customer

2. **Test retry logic**:
   - Simulate network failure on first attempt
   - Retry with same idempotency key
   - Verify same customer returned, not duplicate

3. **Test subscription flows**:
   - Onboarding → Free subscription
   - Add payment method → Upgrade to Pro
   - Downgrade to Free
   - Verify same customer used throughout

---

## Benefits

### Data Integrity
✅ Guarantees 1 user = 1 customer
✅ Database constraint prevents duplicates
✅ Handles edge cases (deleted customers, orphaned records)

### Performance
✅ Database check is fast (indexed query)
✅ Reduces unnecessary Stripe API calls
✅ Caches customer lookups effectively

### Reliability
✅ Idempotent - safe to retry
✅ Handles race conditions
✅ Works across multiple backend instances

### Maintainability
✅ Single source of truth (database)
✅ Centralized customer management
✅ Clear error messages and logging

---

## Potential Issues & Solutions

### Issue 1: Migration Conflicts

**Problem**: Existing code tries to create customer while migration is running

**Solution**:
- Run migration during low-traffic window
- Add retry logic for unique constraint violations
- Rollback plan if issues detected

---

### Issue 2: Stripe API Rate Limits

**Problem**: Database has customer but Stripe retrieve() hits rate limit

**Solution**:
- Add exponential backoff retry logic
- Cache Stripe customer objects temporarily
- Monitor rate limit usage

---

### Issue 3: Orphaned Database Records

**Problem**: Customer deleted in Stripe but not marked deleted in database

**Solution**:
- Function handles this (Step 1)
- Periodic reconciliation job to sync deletions
- Webhook handler for `customer.deleted` events

---

## Monitoring & Alerts

### Metrics to Track
- `stripe.customer.created` (should be rare after initial rollout)
- `stripe.customer.found_in_db` (should be majority of calls)
- `stripe.customer.synced_from_stripe` (orphaned customers found)
- `stripe.customer.constraint_violation` (should be 0)

### Alerts to Configure
- **Critical**: Unique constraint violation (indicates bug or race condition)
- **Warning**: High rate of new customer creation (might indicate issue)
- **Info**: Orphaned customers found (normal, but good to track)

---

## Related Documentation

- [Stripe Customers API](https://stripe.com/docs/api/customers)
- [Idempotency Keys](https://stripe.com/docs/api/idempotent_requests)
- [Database Schema: stripe_customers](../backend/db/schema/stripe.ts)
- [Subscription System Architecture](./2025-10-27-operation-tracking-reconciliation.md)

---

## Conclusion

This centralized customer management approach eliminates duplicate Stripe customers by:
1. Using database as source of truth
2. Searching by userId metadata (reliable)
3. Implementing idempotency keys (race condition proof)
4. Adding database constraint (final safety net)

The function is battle-tested against edge cases and provides a solid foundation for subscription management.
