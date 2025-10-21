import { stripe } from 'backend/utils/stripe-config';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import { db } from 'backend/db/db';
import { subsUser } from '@shared/db/schema/subscriptions';
import { eq } from 'drizzle-orm';

const FREE_PRICE_ID = 'price_1SIai04uGyk26FKnKrY7JcZ5';
const PRO_PRICE_ID = 'price_1SIZwt4uGyk26FKnXAd3TWtW';

export default async function handleDowngradeSubscription(
  req: FullRequest,
  res: Response
) {
  try {
    const { email, id: userId } = req.user;

    console.log('[DOWNGRADE] Starting downgrade for:', email);

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
      item => item.price.id === PRO_PRICE_ID
    );

    if (!proItem) {
      return res.status(400).json({
        error: 'Subscription is not on Pro plan'
      });
    }

    console.log('[DOWNGRADE] Downgrading subscription:', subscription.id);

    // Update subscription: remove pro item, add free item
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      {
        items: [
          {
            id: proItem.id,
            deleted: true,
          },
          {
            price: FREE_PRICE_ID,
          },
        ],
        proration_behavior: 'create_prorations',
        // Remove payment method requirement for Free tier
        default_payment_method: null as any,
        // Clear any discounts/promos
        discounts: null,
      }
    );

    // Update database: clear promo code from metadata
    const currentSub = await db
      .select()
      .from(subsUser)
      .where(eq(subsUser.userId, userId))
      .limit(1);

    if (currentSub.length > 0) {
      const currentMetadata = (currentSub[0].metadata || {}) as any;

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

      console.log('[DOWNGRADE] Cleared promo code from metadata');
    }

    console.log('[DOWNGRADE] ✅ Downgraded to Free:', subscription.id);

    res.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
      },
    });

  } catch (error) {
    console.error('[DOWNGRADE] Error:', error);
    res.status(500).json({
      error: 'Failed to downgrade subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
