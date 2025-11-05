import { stripe } from 'backend/utils/stripe-config';
import { logStripeOperation } from 'backend/services/stripe-operation-tracker';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import { db } from 'backend/db/db';
import { subsUser } from '@shared/db/schema/subscriptions';
import { eq } from 'drizzle-orm';
import { planPrice } from './get-plan-prices';

type DowngradeType = 
  'pro_to_free' |
  'pro_yearly_to_pro_monthly' 

export default async function handleDowngradeSubscription(
  req: FullRequest,
  res: Response
) {
  const { email, id: userId } = req.user;
  const { downgradeType } = req.body as { downgradeType: DowngradeType }

  let logLabel: string = "SUBSCRIPTION"; 
  switch (downgradeType) {
    case 'pro_to_free':
      logLabel = "DOWNGRADE"
      break
    case 'pro_yearly_to_pro_monthly':
      logLabel = "CHANGE"
      break
  }

  try {
    console.log(`[${logLabel}] 🚀 Starting downgrade for:`, email);
    console.log(`[${logLabel}] 🚀 User ID:`, userId);

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

    console.log(`[${logLabel}] 📋 Scheduling downgrade at period end:`, subscription.id);
    console.log(`[${logLabel}] 📋 Current subscription state:`);
    console.log(`[${logLabel}]    - Status:`, subscription.status);
    console.log(`[${logLabel}]    - Current period end:`, subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString() : 'UNDEFINED');
    console.log(`[${logLabel}]    - Current price ID:`, subscription.items.data[0]?.price.id || 'NONE');
    console.log(`[${logLabel}]    - Cancel at period end (before):`, subscription.cancel_at_period_end);
    console.log(`[${logLabel}]    - Items in subscription:`, subscription.items.data.length);
    console.log(`[${logLabel}] 📋 About to call Stripe API with:`);
    console.log(`[${logLabel}]    - cancel_at_period_end: true`);

    let metadataScheduled: string;
    switch (downgradeType) {
      case 'pro_to_free':
        metadataScheduled = 'scheduled_downgrade_to_free'
        break
      case 'pro_yearly_to_pro_monthly':
        metadataScheduled = 'scheduled_change_from_yearly_to_monthly'
        break
    }
    console.log(`[${logLabel}]    - metadata.${metadataScheduled}: "true"`);
    console.log(`[${logLabel}]    - metadata.userId:`, userId);

    // Schedule downgrade: cancel Pro at period end, then auto-create Free
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      {
        cancel_at_period_end: true,
        metadata: {
          ...subscription.metadata,
          [metadataScheduled]: 'true',
          userId: userId,
        },
      }
    );

    // Verify Stripe actually accepted the change
    if (!updatedSubscription.cancel_at_period_end) {
      console.error(`[${logLabel}] ❌ Stripe did not set cancel_at_period_end to true`);
      console.error(`[${logLabel}] ❌ Response:`, JSON.stringify(updatedSubscription, null, 2));
      return res.status(500).json({
        error: 'Failed to schedule downgrade',
        details: 'Stripe did not accept the cancellation. This may be due to billing period restrictions or account limitations. Please contact support.'
      });
    }

    if (!updatedSubscription.cancel_at) {
      console.error(`[${logLabel}] ❌ Stripe did not set a cancel_at timestamp`);
      console.error(`[${logLabel}] ❌ Response:`, JSON.stringify(updatedSubscription, null, 2));
      return res.status(500).json({
        error: 'Failed to schedule downgrade',
        details: 'Stripe did not set a cancellation date. Your subscription may not support scheduled cancellation. Please contact support.'
      });
    }

    console.log(`[${logLabel}] ✅ Stripe API response received:`);
    console.log(`[${logLabel}]    - cancel_at_period_end:`, updatedSubscription.cancel_at_period_end);
    console.log(`[${logLabel}]    - cancel_at:`, updatedSubscription.cancel_at ? new Date(updatedSubscription.cancel_at * 1000).toISOString() : 'NULL');
    console.log(`[${logLabel}]    - current_period_end:`, updatedSubscription.items.data[0]?.current_period_end ? new Date(updatedSubscription.items.data[0].current_period_end * 1000).toISOString() : 'UNDEFINED');
    console.log(`[${logLabel}]    - status:`, updatedSubscription.status);
    console.log(`[${logLabel}]    - items count:`, updatedSubscription.items.data.length);
    console.log(`[${logLabel}]    - First item price ID:`, updatedSubscription.items.data[0]?.price.id || 'NONE');
    console.log(`[${logLabel}]    - Metadata:`, JSON.stringify(updatedSubscription.metadata, null, 2));

    const currentSub = await db
      .select()
      .from(subsUser)
      .where(eq(subsUser.userId, userId))
      .limit(1);

    if (currentSub.length > 0) {
      const currentMetadata = (currentSub[0].metadata || {}) as any;

      // Add scheduled downgrade info
      currentMetadata[metadataScheduled] = true;
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

      console.log(`[${logLabel}] 💾 Database metadata updated:`);
      console.log(`[${logLabel}]    -  ${metadataScheduled}:`, currentMetadata[metadataScheduled]);
      console.log(`[${logLabel}]    - downgrade_at:`, currentMetadata.downgrade_at ? new Date(currentMetadata.downgrade_at * 1000).toISOString() : 'UNDEFINED');
      console.log(`[${logLabel}]    - promo_code cleared:`, !currentMetadata.promo_code);
    }

    console.log(`[${logLabel}] ✅ Scheduled downgrade to Free at period end:`, subscription.id);

    // Log the operation for tracking
    await logStripeOperation({
      operationType: 'downgrade_subscription',
      userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      requestPayload: { downgradeType }
    });

    console.log(`[${logLabel}] 📤 Sending response to frontend:`);
    console.log(`[${logLabel}]    - success: true`);
    console.log(`[${logLabel}]    - subscription.id:`, updatedSubscription.id);
    console.log(`[${logLabel}]    - subscription.status:`, updatedSubscription.status);
    console.log(`[${logLabel}]    - subscription.cancel_at_period_end:`, updatedSubscription.cancel_at_period_end);
    console.log(`[${logLabel}]    - subscription.cancel_at:`, updatedSubscription.cancel_at ? new Date(updatedSubscription.cancel_at * 1000).toISOString() : 'NULL');
    console.log(`[${logLabel}]    - subscription.current_period_end:`, updatedSubscription.items.data[0]?.current_period_end ? new Date(updatedSubscription.items.data[0].current_period_end * 1000).toISOString() : 'UNDEFINED');

    let newSubscription: { plan: string, billingPeriod: string | null }
    switch (downgradeType) {
      case 'pro_to_free':
        newSubscription = {
          plan: 'free',
          billingPeriod: null
        }
        break
      case 'pro_yearly_to_pro_monthly': {
        newSubscription = {
          plan: 'pro',
          billingPeriod: 'monthly'
        }
      }
    }

    res.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        new_subscription: newSubscription,
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        cancel_at: updatedSubscription.cancel_at,
        current_period_end: updatedSubscription.items.data[0]?.current_period_end,
      },
    });

  } catch (error) {
    console.error(`[${logLabel}] ❌ Error occurred:`);
    console.error(`[${logLabel}] ❌ Error type:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`[${logLabel}] ❌ Error message:`, error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(`[${logLabel}] ❌ Stack trace:`, error.stack);
    }
    res.status(500).json({
      error: 'Failed to downgrade subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
