import { stripe } from 'backend/utils/stripe-config';
import { logStripeOperation } from 'backend/services/stripe-operation-tracker';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import { db } from 'backend/db/db';
import { subsUser } from '@shared/db/schema/subscriptions';
import { eq } from 'drizzle-orm';
import { planPrice } from './get-plan-prices';

export default async function handleDowngradeSubscription(
  req: FullRequest,
  res: Response
) {
  try {
    const { email, id: userId } = req.user;

    console.log('[DOWNGRADE] 🚀 Starting downgrade for:', email);
    console.log('[DOWNGRADE] 🚀 User ID:', userId);

    // Find customer
    const customerResult = await stripe.customers.search({
      query: `email:"${email}"`
    });

    if (!customerResult.data || customerResult.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerResult.data[0];

    // Find active pro subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const subscription = subscriptions.data[0];

    // Verify it's a pro subscription
    const proItem = subscription.items.data.find(
      item => (item.price.id === planPrice.pro.monthly || item.price.id === planPrice.pro.yearly)
    );

    if (!proItem) {
      return res.status(400).json({
        error: 'Subscription is not on Pro plan'
      });
    }

    console.log('[DOWNGRADE] 📋 Scheduling downgrade at period end:', subscription.id);
    console.log('[DOWNGRADE] 📋 Current subscription state:');
    console.log('[DOWNGRADE]    - Status:', subscription.status);
    console.log('[DOWNGRADE]    - Current period end:', subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString() : 'UNDEFINED');
    console.log('[DOWNGRADE]    - Current price ID:', subscription.items.data[0]?.price.id || 'NONE');
    console.log('[DOWNGRADE]    - Cancel at period end (before):', subscription.cancel_at_period_end);
    console.log('[DOWNGRADE]    - Items in subscription:', subscription.items.data.length);
    console.log('[DOWNGRADE] 📋 About to call Stripe API with:');
    console.log('[DOWNGRADE]    - cancel_at_period_end: true');
    console.log('[DOWNGRADE]    - metadata.scheduled_downgrade_to_free: "true"');
    console.log('[DOWNGRADE]    - metadata.userId:', userId);

    // Schedule downgrade: cancel Pro at period end, then auto-create Free
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      {
        cancel_at_period_end: true,
        metadata: {
          ...subscription.metadata,
          scheduled_downgrade_to_free: 'true',
          userId: userId,
        },
      }
    );

    // Verify Stripe actually accepted the change
    if (!updatedSubscription.cancel_at_period_end) {
      console.error('[DOWNGRADE] ❌ Stripe did not set cancel_at_period_end to true');
      console.error('[DOWNGRADE] ❌ Response:', JSON.stringify(updatedSubscription, null, 2));
      return res.status(500).json({
        error: 'Failed to schedule downgrade',
        details: 'Stripe did not accept the cancellation. This may be due to billing period restrictions or account limitations. Please contact support.'
      });
    }

    if (!updatedSubscription.cancel_at) {
      console.error('[DOWNGRADE] ❌ Stripe did not set a cancel_at timestamp');
      console.error('[DOWNGRADE] ❌ Response:', JSON.stringify(updatedSubscription, null, 2));
      return res.status(500).json({
        error: 'Failed to schedule downgrade',
        details: 'Stripe did not set a cancellation date. Your subscription may not support scheduled cancellation. Please contact support.'
      });
    }

    console.log('[DOWNGRADE] ✅ Stripe API response received:');
    console.log('[DOWNGRADE]    - cancel_at_period_end:', updatedSubscription.cancel_at_period_end);
    console.log('[DOWNGRADE]    - cancel_at:', updatedSubscription.cancel_at ? new Date(updatedSubscription.cancel_at * 1000).toISOString() : 'NULL');
    console.log('[DOWNGRADE]    - current_period_end:', updatedSubscription.items.data[0]?.current_period_end ? new Date(updatedSubscription.items.data[0].current_period_end * 1000).toISOString() : 'UNDEFINED');
    console.log('[DOWNGRADE]    - status:', updatedSubscription.status);
    console.log('[DOWNGRADE]    - items count:', updatedSubscription.items.data.length);
    console.log('[DOWNGRADE]    - First item price ID:', updatedSubscription.items.data[0]?.price.id || 'NONE');
    console.log('[DOWNGRADE]    - Metadata:', JSON.stringify(updatedSubscription.metadata, null, 2));

    // Update database: mark scheduled downgrade and clear promo code
    const currentSub = await db
      .select()
      .from(subsUser)
      .where(eq(subsUser.userId, userId))
      .limit(1);

    if (currentSub.length > 0) {
      const currentMetadata = (currentSub[0].metadata || {}) as any;

      // Add scheduled downgrade info
      currentMetadata.scheduled_downgrade_to_free = true;
      currentMetadata.downgrade_at = updatedSubscription.cancel_at;

      // Remove promo code from metadata
      if (currentMetadata.promo_code) {
        delete currentMetadata.promo_code;
      }

      await db
        .update(subsUser)
        .set({
          metadata: currentMetadata,
          updatedAt: new Date(),
        })
        .where(eq(subsUser.userId, userId));

      console.log('[DOWNGRADE] 💾 Database metadata updated:');
      console.log('[DOWNGRADE]    - scheduled_downgrade_to_free:', currentMetadata.scheduled_downgrade_to_free);
      console.log('[DOWNGRADE]    - downgrade_at:', currentMetadata.downgrade_at ? new Date(currentMetadata.downgrade_at * 1000).toISOString() : 'UNDEFINED');
      console.log('[DOWNGRADE]    - promo_code cleared:', !currentMetadata.promo_code);
    }

    console.log('[DOWNGRADE] ✅ Scheduled downgrade to Free at period end:', subscription.id);

    // Log the operation for tracking
    await logStripeOperation({
      operationType: 'downgrade_subscription',
      userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      requestPayload: { fromTier: 'pro', toTier: 'free' }
    });

    console.log('[DOWNGRADE] 📤 Sending response to frontend:');
    console.log('[DOWNGRADE]    - success: true');
    console.log('[DOWNGRADE]    - subscription.id:', updatedSubscription.id);
    console.log('[DOWNGRADE]    - subscription.status:', updatedSubscription.status);
    console.log('[DOWNGRADE]    - subscription.cancel_at_period_end:', updatedSubscription.cancel_at_period_end);
    console.log('[DOWNGRADE]    - subscription.cancel_at:', updatedSubscription.cancel_at ? new Date(updatedSubscription.cancel_at * 1000).toISOString() : 'NULL');
    console.log('[DOWNGRADE]    - subscription.current_period_end:', updatedSubscription.items.data[0]?.current_period_end ? new Date(updatedSubscription.items.data[0].current_period_end * 1000).toISOString() : 'UNDEFINED');

    res.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        cancel_at: updatedSubscription.cancel_at,
        current_period_end: updatedSubscription.items.data[0]?.current_period_end,
      },
    });

  } catch (error) {
    console.error('[DOWNGRADE] ❌ Error occurred:');
    console.error('[DOWNGRADE] ❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[DOWNGRADE] ❌ Error message:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('[DOWNGRADE] ❌ Stack trace:', error.stack);
    }
    res.status(500).json({
      error: 'Failed to downgrade subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
