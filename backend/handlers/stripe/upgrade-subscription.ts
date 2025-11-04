import { stripe } from 'backend/utils/stripe-config';
import { logStripeOperation } from 'backend/services/stripe-operation-tracker';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import { planPrice } from './get-plan-prices';

export default async function handleUpgradeSubscription(req: FullRequest, res: Response) {
  try {
    const { email } = req.user;
    const { paymentMethodId, promotionCodeId, billingPeriod = 'monthly' } = req.body;

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
    const currentPlan = subscription.items.data.find(
      item => item 
    );

    if (!currentPlan) {
      return res.status(400).json({
        error: `Subscription doesn't have a plan`
      });
    }

    console.log('[UPGRADE] Changing plan:', subscription.id);

    // First, attach the payment method to the customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });
      console.log('[UPGRADE] Attached payment method:', paymentMethodId);
    } catch (error: any) {
      // If already attached, that's fine - continue
      if (error.code !== 'resource_missing') {
        console.log('[UPGRADE] Payment method already attached or other error:', error.code);
      } else {
        throw error;
      }
    }

    // Set the payment method as default for the customer
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Select price ID based on billing period
    const priceId = billingPeriod === 'yearly' ? planPrice.pro.yearly : planPrice.pro.monthly;

    // Update subscription: remove free item, add pro item
    const updateParams: any = {
      items: [
        {
          id: currentPlan.id,
          deleted: true,
        },
        {
          price: priceId,
        },
      ],
      proration_behavior: 'create_prorations',
      default_payment_method: paymentMethodId,
      metadata: {
        ...subscription.metadata,
        billingPeriod
      }
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

    // Log the operation for tracking
    await logStripeOperation({
      operationType: 'upgrade_subscription',
      userId: req.user.id,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      requestPayload: { fromTier: 'free', toTier: 'pro', billingPeriod, hasPromoCode: !!promotionCodeId }
    });

    res.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
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
