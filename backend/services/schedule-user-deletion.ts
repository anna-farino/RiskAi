import { stripe } from '../utils/stripe-config';
import { db } from '../db/db';
import { users } from '../../shared/db/schema/user';
import { subsUser } from '../../shared/db/schema/subscriptions';
import { eq } from 'drizzle-orm';
import { logStripeOperation } from './stripe-operation-tracker';

type Args = {
  userId: string;
  email: string;
  stripeSubscriptionId: string;
};

type Output = {
  success: boolean;
  scheduledDate: number; // Unix timestamp
  message: string;
};

/**
 * Schedules account deletion for paid users
 * 1. Updates Stripe subscription (cancel_at_period_end + metadata)
 * 2. Updates subsUser.metadata
 * 3. Updates users.accountStatus = 'pending_deletion'
 * Returns the scheduled deletion date
 */
export async function scheduleUserDeletion({
  userId,
  email,
  stripeSubscriptionId,
}: Args): Promise<Output> {
  console.log('[DELETE_SCHEDULE] 🚀 Starting scheduled deletion for:', email);
  console.log('[DELETE_SCHEDULE] 🚀 User ID:', userId);
  console.log('[DELETE_SCHEDULE] 🚀 Subscription ID:', stripeSubscriptionId);

  let stripeUpdated = false;
  let originalCancelAtPeriodEnd = false;
  let originalMetadata: Record<string, string> = {};

  try {
    // Step 1: Update Stripe FIRST (before database)
    console.log('[DELETE_SCHEDULE] 📋 Updating Stripe subscription...');
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    // Store original values for potential rollback
    originalCancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    originalMetadata = { ...subscription.metadata };

    const updatedSubscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        cancel_at_period_end: true,
        metadata: {
          ...subscription.metadata,
          scheduled_deletion: 'true',
          userId: userId,
          // Store current_period_end only if it exists
          ...(subscription.current_period_end && {
            deletion_at: subscription.current_period_end.toString()
          }),
        },
      }
    );

    stripeUpdated = true;
    const scheduledDate = updatedSubscription.cancel_at || updatedSubscription.current_period_end;
    console.log('[DELETE_SCHEDULE] ✅ Stripe subscription updated');
    console.log('[DELETE_SCHEDULE]    - cancel_at_period_end:', updatedSubscription.cancel_at_period_end);
    console.log('[DELETE_SCHEDULE]    - cancel_at:', scheduledDate ? new Date(scheduledDate * 1000).toISOString() : 'NULL');

    // Step 2: Update Database in Transaction
    console.log('[DELETE_SCHEDULE] 💾 Updating database in transaction...');
    await db.transaction(async (tx) => {
      // Update subsUser metadata
      const currentSub = await tx
        .select()
        .from(subsUser)
        .where(eq(subsUser.userId, userId))
        .limit(1);

      if (currentSub.length > 0) {
        const currentMetadata = (currentSub[0].metadata || {}) as any;

        // Add scheduled deletion info
        currentMetadata.scheduled_deletion = true;
        currentMetadata.deletion_at = scheduledDate;
        currentMetadata.deletion_requested_at = Math.floor(Date.now() / 1000);

        await tx
          .update(subsUser)
          .set({
            metadata: currentMetadata,
            updatedAt: new Date(),
          })
          .where(eq(subsUser.userId, userId));

        console.log('[DELETE_SCHEDULE] ✅ SubsUser metadata updated');
        console.log('[DELETE_SCHEDULE]    - scheduled_deletion:', currentMetadata.scheduled_deletion);
        console.log('[DELETE_SCHEDULE]    - deletion_at:', currentMetadata.deletion_at ? new Date(currentMetadata.deletion_at * 1000).toISOString() : 'UNDEFINED');
      }

      // Update users.accountStatus
      await tx
        .update(users)
        .set({
          accountStatus: 'pending_deletion',
        })
        .where(eq(users.id, userId));

      console.log('[DELETE_SCHEDULE] ✅ Users table updated');
    });

    console.log('[DELETE_SCHEDULE] ✅ Database transaction committed');

    // Step 3: Log the operation
    await logStripeOperation({
      operationType: 'delete_account_scheduled',
      userId,
      stripeCustomerId: updatedSubscription.customer as string,
      stripeSubscriptionId,
      requestPayload: { email, deletionType: 'scheduled', scheduledDate },
    });

    console.log('[DELETE_SCHEDULE] ✅ Account deletion scheduled successfully');
    return {
      success: true,
      scheduledDate,
      message: `Account deletion scheduled for ${new Date(scheduledDate * 1000).toISOString()}`,
    };
  } catch (error) {
    console.error('[DELETE_SCHEDULE] ❌ Error during scheduled deletion:', error);

    // ROLLBACK: If Stripe was updated but database failed, revert Stripe changes
    if (stripeUpdated) {
      console.error('[DELETE_SCHEDULE] 🔄 Rolling back Stripe changes...');
      try {
        await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: originalCancelAtPeriodEnd,
          metadata: originalMetadata,
        });
        console.log('[DELETE_SCHEDULE] ✅ Stripe rollback successful');
      } catch (rollbackError) {
        console.error('[DELETE_SCHEDULE] ❌ Stripe rollback failed:', rollbackError);
        console.error('[DELETE_SCHEDULE] ⚠️ MANUAL INTERVENTION REQUIRED - Stripe subscription needs manual cleanup');
        // This is a critical error - Stripe and DB are now inconsistent
        // The operation log will help identify this for manual cleanup
      }
    }

    throw new Error(
      `Failed to schedule account deletion: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
