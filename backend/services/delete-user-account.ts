import { stripe } from '../utils/stripe-config';
import { blockAuth0User } from '../utils/auth0/block-user';
import { db } from '../db/db';
import { users } from '../../shared/db/schema/user';
import { subsUser } from '../../shared/db/schema/subscriptions';
import { eq } from 'drizzle-orm';
import { logStripeOperation } from './stripe-operation-tracker';

type Args = {
  userId: string;
  email: string;
};

type Output = {
  success: boolean;
  message: string;
};

/**
 * Immediately deletes a user account (for free tier users)
 * 1. Cancels Stripe subscription immediately
 * 2. Blocks Auth0 user
 * 3. Updates users table (accountStatus='deleted', accountDeletedAt=now)
 * 4. Updates subsUser status to 'cancelled'
 */
export async function deleteUserAccountImmediately({
  userId,
  email,
}: Args): Promise<Output> {
  console.log('[DELETE_IMMEDIATE] 🚀 Starting immediate deletion for:', email);
  console.log('[DELETE_IMMEDIATE] 🚀 User ID:', userId);

  // Track operation status for error reporting
  const operationStatus = {
    stripeCancelled: false,
    auth0Blocked: false,
    databaseUpdated: false,
  };

  try {
    // Step 1: Cancel Stripe subscription immediately
    console.log('[DELETE_IMMEDIATE] 📋 Finding Stripe customer...');
    let stripeCustomerId: string | undefined;
    let stripeSubscriptionId: string | undefined;

    try {
      const customerResult = await stripe.customers.search({
        query: `email:"${email}"`,
      });

      if (customerResult.data && customerResult.data.length > 0) {
        const customer = customerResult.data[0];
        stripeCustomerId = customer.id;
        console.log('[DELETE_IMMEDIATE] ✅ Found Stripe customer:', stripeCustomerId);

        // Find active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 10, // Get all active subscriptions
        });

        console.log('[DELETE_IMMEDIATE] 📋 Found', subscriptions.data.length, 'active subscription(s)');

        // Cancel all active subscriptions immediately
        for (const subscription of subscriptions.data) {
          console.log('[DELETE_IMMEDIATE] ❌ Canceling subscription:', subscription.id);
          await stripe.subscriptions.cancel(subscription.id);
          stripeSubscriptionId = subscription.id;
          console.log('[DELETE_IMMEDIATE] ✅ Subscription canceled');
        }

        operationStatus.stripeCancelled = true;

        // Log the operation
        await logStripeOperation({
          operationType: 'delete_account_immediate',
          userId,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscriptionId || null,
          requestPayload: { email, deletionType: 'immediate' },
        });
      } else {
        console.log('[DELETE_IMMEDIATE] ⚠️ No Stripe customer found for email:', email);
        operationStatus.stripeCancelled = true; // Mark as "complete" since there's nothing to cancel
      }
    } catch (stripeError) {
      console.error('[DELETE_IMMEDIATE] ❌ Stripe operation failed:', stripeError);
      // Continue with other operations - we'll log the partial failure
    }

    // Step 2: Block Auth0 user
    console.log('[DELETE_IMMEDIATE] 🔒 Blocking Auth0 user...');
    try {
      await blockAuth0User({ userId });
      console.log('[DELETE_IMMEDIATE] ✅ Auth0 user blocked');
      operationStatus.auth0Blocked = true;
    } catch (auth0Error) {
      console.error('[DELETE_IMMEDIATE] ❌ Failed to block Auth0 user:', auth0Error);
      // Continue with deletion even if Auth0 fails
    }

    // Step 3: Update Database in Transaction
    console.log('[DELETE_IMMEDIATE] 💾 Updating database in transaction...');
    await db.transaction(async (tx) => {
      // Update users table
      await tx
        .update(users)
        .set({
          accountStatus: 'deleted',
          accountDeletedAt: new Date(),
        })
        .where(eq(users.id, userId));

      console.log('[DELETE_IMMEDIATE] ✅ Users table updated');

      // Update subsUser status
      await tx
        .update(subsUser)
        .set({
          status: 'cancelled',
          endDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subsUser.userId, userId));

      console.log('[DELETE_IMMEDIATE] ✅ SubsUser table updated');
    });

    operationStatus.databaseUpdated = true;
    console.log('[DELETE_IMMEDIATE] ✅ Database transaction committed');

    // Check if all critical operations succeeded
    if (!operationStatus.stripeCancelled || !operationStatus.auth0Blocked) {
      console.warn('[DELETE_IMMEDIATE] ⚠️ Partial deletion - some operations failed:');
      console.warn('[DELETE_IMMEDIATE]    - Stripe:', operationStatus.stripeCancelled ? '✅' : '❌');
      console.warn('[DELETE_IMMEDIATE]    - Auth0:', operationStatus.auth0Blocked ? '✅' : '❌');
      console.warn('[DELETE_IMMEDIATE]    - Database:', operationStatus.databaseUpdated ? '✅' : '❌');
    }

    console.log('[DELETE_IMMEDIATE] ✅ Account deletion completed successfully');
    return {
      success: true,
      message: 'Account deleted successfully',
    };
  } catch (error) {
    console.error('[DELETE_IMMEDIATE] ❌ Error during account deletion:', error);
    console.error('[DELETE_IMMEDIATE] ⚠️ Operation status at time of error:');
    console.error('[DELETE_IMMEDIATE]    - Stripe:', operationStatus.stripeCancelled ? '✅ Cancelled' : '❌ Not cancelled');
    console.error('[DELETE_IMMEDIATE]    - Auth0:', operationStatus.auth0Blocked ? '✅ Blocked' : '❌ Not blocked');
    console.error('[DELETE_IMMEDIATE]    - Database:', operationStatus.databaseUpdated ? '✅ Updated' : '❌ Not updated');
    console.error('[DELETE_IMMEDIATE] ⚠️ MANUAL CLEANUP MAY BE REQUIRED');

    throw new Error(
      `Failed to delete account: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
