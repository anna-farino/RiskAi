import { stripe } from 'backend/utils/stripe-config';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';

const FREE_PRICE_ID = 'price_1SIai04uGyk26FKnKrY7JcZ5';
const PRO_PRICE_ID = 'price_1SIZwt4uGyk26FKnXAd3TWtW';

export default async function handleUpgradeSubscription(
  req: FullRequest,
  res: Response
) {
  try {
    const { email } = req.user;
    const { paymentMethodId, promotionCodeId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method required' });
    }

    // Find customer
    const customerResult = await stripe.customers.search({
      query: `email:"${email}"`
    });

    if (!customerResult.data || customerResult.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerResult.data[0];

    // Find active free subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const subscription = subscriptions.data[0];

    // Verify it's a free subscription
    const freeItem = subscription.items.data.find(
      item => item.price.id === FREE_PRICE_ID
    );

    if (!freeItem) {
      return res.status(400).json({
        error: 'Subscription is not on free plan'
      });
    }

    console.log('[UPGRADE] Upgrading subscription:', subscription.id);

    // Set the payment method as default for the customer
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update subscription: remove free item, add pro item
    const updateParams: any = {
      items: [
        {
          id: freeItem.id,
          deleted: true,
        },
        {
          price: PRO_PRICE_ID,
        },
      ],
      proration_behavior: 'create_prorations',
      default_payment_method: paymentMethodId,
    };

    // Add promotion code if provided
    if (promotionCodeId) {
      updateParams.discounts = [{ promotion_code: promotionCodeId }];
      console.log('[UPGRADE] Applying promotion code:', promotionCodeId);
    }

    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      updateParams
    );

    console.log('[UPGRADE] ✅ Upgraded to Pro:', subscription.id);

    res.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        current_period_end: updatedSubscription.current_period_end,
      },
    });

  } catch (error) {
    console.error('[UPGRADE] Error:', error);
    res.status(500).json({
      error: 'Failed to upgrade subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
