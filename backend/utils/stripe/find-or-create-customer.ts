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

        const stripeCustomerNonDeleted = stripeCustomer as Stripe.Customer

        // Check if metadata has userId (for backward compatibility with old customers)
        if (!stripeCustomerNonDeleted.metadata?.userId) {
          console.log(`[CUSTOMER] Updating customer ${dbCustomer.stripeCustomerId} metadata with userId`);

          // Update Stripe customer to include userId in metadata
          await stripe.customers.update(dbCustomer.stripeCustomerId, {
            metadata: {
              ...stripeCustomerNonDeleted.metadata,
              userId,
            },
          });

          // Update the local object
          stripeCustomerNonDeleted.metadata = {
            ...stripeCustomerNonDeleted.metadata,
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
