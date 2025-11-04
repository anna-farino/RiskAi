import { stripe } from 'backend/utils/stripe-config';
import { logStripeOperation } from 'backend/services/stripe-operation-tracker';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import { planPrice } from './get-plan-prices';

export default async function handleSubscribeToPro(
  req: FullRequest,
  res: Response
) {
  try {
    const { email } = req.user;
    const { paymentMethodId, customerId, promotionCodeId, billingPeriod = 'monthly' } = req.body;

    if (!paymentMethodId || !customerId) {
      return res.status(400).json({
        error: 'Payment method and customer ID required'
      });
    }

    console.log('[SUBSCRIBE-PRO] Creating Pro subscription for:', email);

    // First, attach the payment method to the customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      console.log('[SUBSCRIBE-PRO] Attached payment method:', paymentMethodId);
    } catch (error: any) {
      // If already attached, that's fine - continue
      if (error.code !== 'resource_missing') {
        console.log('[SUBSCRIBE-PRO] Payment method already attached or other error:', error.code);
      } else {
        throw error;
      }
    }

    // Set payment method as default for customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Select price ID based on billing period
    const priceId = billingPeriod === 'yearly' ? planPrice.pro.yearly : planPrice.pro.monthly;

    // Create Pro subscription
    const subscriptionParams: any = {
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      default_payment_method: paymentMethodId,
      metadata: {
        userId: req.user.id,
        email: email,
        customerId,
        billingPeriod
      },
    };

    // Add promotion code if provided
    if (promotionCodeId) {
      subscriptionParams.discounts = [{ promotion_code: promotionCodeId }];
      console.log('[SUBSCRIBE-PRO] Applying promotion code:', promotionCodeId);
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    console.log('[SUBSCRIBE-PRO] ✅ Created Pro subscription:', subscription.id);

    // Log the operation for tracking
    await logStripeOperation({
      operationType: 'create_subscription',
      userId: req.user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      requestPayload: { tierType: 'pro', billingPeriod, hasPromoCode: !!promotionCodeId }
    });

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
      },
    });

  } catch (error) {
    console.error('[SUBSCRIBE-PRO] Error:', error);
    res.status(500).json({
      error: 'Failed to create Pro subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
