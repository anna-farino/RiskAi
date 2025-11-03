import { stripe } from 'backend/utils/stripe-config';
import { logStripeOperation } from 'backend/services/stripe-operation-tracker';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import { db } from 'backend/db/db';
import { subsUser } from '@shared/db/schema/subscriptions';
import { eq } from 'drizzle-orm';

export default async function handleCancelScheduledDowngrade(
  req: FullRequest,
  res: Response
) {
  try {
    const { email, id: userId } = req.user;

    console.log('[CANCEL-DOWNGRADE] Cancelling scheduled downgrade for:', email);

    // Find customer
    const customerResult = await stripe.customers.search({
      query: `email:"${email}"`
    });

    if (!customerResult.data || customerResult.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerResult.data[0];

    // Find active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const subscription = subscriptions.data[0];

    // Verify it has cancel_at_period_end set
    if (!subscription.cancel_at_period_end) {
      return res.status(400).json({
        error: 'No scheduled downgrade found'
      });
    }

    console.log('[CANCEL-DOWNGRADE] Removing cancel_at_period_end:', subscription.id);

    // Remove the cancellation
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      {
        cancel_at_period_end: false,
        metadata: {
          ...subscription.metadata,
          scheduled_downgrade_to_free: null,
        },
      }
    );

    // Update database: clear scheduled downgrade metadata
    const currentSub = await db
      .select()
      .from(subsUser)
      .where(eq(subsUser.userId, userId))
      .limit(1);

    if (currentSub.length > 0) {
      const currentMetadata = (currentSub[0].metadata || {}) as any;

      // Remove scheduled downgrade info
      delete currentMetadata.scheduled_downgrade_to_free;
      delete currentMetadata.downgrade_at;

      await db
        .update(subsUser)
        .set({
          metadata: currentMetadata,
          updatedAt: new Date(),
        })
        .where(eq(subsUser.userId, userId));

      console.log('[CANCEL-DOWNGRADE] Cleared scheduled downgrade from metadata');
    }

    console.log('[CANCEL-DOWNGRADE] ✅ Cancelled scheduled downgrade:', subscription.id);

    // Log the operation for tracking
    await logStripeOperation({
      operationType: 'upgrade_subscription',
      userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      requestPayload: { action: 'cancel_scheduled_downgrade' }
    });

    res.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
      },
    });

  } catch (error) {
    console.error('[CANCEL-DOWNGRADE] Error:', error);
    res.status(500).json({
      error: 'Failed to cancel scheduled downgrade',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
