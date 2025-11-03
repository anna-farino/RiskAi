import { stripe } from '../../utils/stripe-config';
import { logStripeOperation } from '../../services/stripe-operation-tracker';
import { Response } from 'express';
import { FullRequest } from '../../middleware';
import { db } from '../../db/db';
import { subsUser } from '../../../shared/db/schema/subscriptions';
import { users } from '../../../shared/db/schema/user';
import { eq } from 'drizzle-orm';

/**
 * POST /api/users/account/undo-deletion
 * Cancels a scheduled account deletion (for paid users only)
 */
export default async function undoAccountDeletionHandler(
  req: FullRequest,
  res: Response
) {
  try {
    const { email, id: userId } = req.user;

    console.log('[UNDO_DELETION] 🚀 Cancelling scheduled deletion for:', email);
    console.log('[UNDO_DELETION] 🚀 User ID:', userId);

    // Verify user has pending deletion status
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user[0].accountStatus !== 'pending_deletion') {
      return res.status(400).json({
        error: 'No scheduled account deletion found'
      });
    }

    // Find customer in Stripe
    console.log('[UNDO_DELETION] 📋 Finding Stripe customer...');
    const customerResult = await stripe.customers.search({
      query: `email:"${email}"`
    });

    if (!customerResult.data || customerResult.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found in Stripe' });
    }

    const customer = customerResult.data[0];

    // Find active subscription
    console.log('[UNDO_DELETION] 📋 Finding active subscription...');
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const subscription = subscriptions.data[0];

    // Check if Stripe subscription has the cancellation set
    // If not, we'll just clean up the database (handles inconsistent state)
    if (subscription.cancel_at_period_end) {
      console.log('[UNDO_DELETION] ❌ Removing cancel_at_period_end from subscription:', subscription.id);

      // Remove the cancellation and deletion metadata
      await stripe.subscriptions.update(
        subscription.id,
        {
          cancel_at_period_end: false,
          metadata: {
            ...subscription.metadata,
            scheduled_deletion: null,
            deletion_at: null,
          },
        }
      );

      console.log('[UNDO_DELETION] ✅ Stripe subscription updated');
    } else {
      console.log('[UNDO_DELETION] ⚠️ Stripe subscription not cancelled, skipping Stripe update');
      console.log('[UNDO_DELETION] ⚠️ This indicates an inconsistent state - will clean up database only');
    }

    // Update database: clear scheduled deletion metadata
    console.log('[UNDO_DELETION] 💾 Updating subsUser metadata...');
    const currentSub = await db
      .select()
      .from(subsUser)
      .where(eq(subsUser.userId, userId))
      .limit(1);

    if (currentSub.length > 0) {
      const currentMetadata = (currentSub[0].metadata || {}) as any;

      // Remove scheduled deletion info
      delete currentMetadata.scheduled_deletion;
      delete currentMetadata.deletion_at;
      delete currentMetadata.deletion_requested_at;

      await db
        .update(subsUser)
        .set({
          metadata: currentMetadata,
          updatedAt: new Date(),
        })
        .where(eq(subsUser.userId, userId));

      console.log('[UNDO_DELETION] ✅ SubsUser metadata cleared');
    }

    // Update users.accountStatus back to 'active'
    console.log('[UNDO_DELETION] 💾 Updating users table...');
    await db
      .update(users)
      .set({
        accountStatus: 'active',
      })
      .where(eq(users.id, userId));

    console.log('[UNDO_DELETION] ✅ Users table updated');

    // Log the operation for tracking
    await logStripeOperation({
      operationType: 'undo_account_deletion',
      userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      requestPayload: { action: 'undo_scheduled_deletion' }
    });

    console.log('[UNDO_DELETION] ✅ Account deletion cancelled successfully');

    res.json({
      success: true,
      message: 'Account deletion has been cancelled',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: false,
      },
    });

  } catch (error) {
    console.error('[UNDO_DELETION] ❌ Error:', error);
    res.status(500).json({
      error: 'Failed to cancel account deletion',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
