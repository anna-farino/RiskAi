import { stripe } from 'backend/utils/stripe-config';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';

const PRO_PRICE_ID = 'price_1SIZwt4uGyk26FKnXAd3TWtW';

export default async function handleSubscribeToPro(
  req: FullRequest,
  res: Response
) {
  try {
    const { email } = req.user;
    const { paymentMethodId, customerId, promotionCodeId } = req.body;

    if (!paymentMethodId || !customerId) {
      return res.status(400).json({
        error: 'Payment method and customer ID required'
      });
    }

    console.log('[SUBSCRIBE-PRO] Creating Pro subscription for:', email);

    // Set payment method as default for customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create Pro subscription
    const subscriptionParams: any = {
      customer: customerId,
      items: [
        {
          price: PRO_PRICE_ID,
        },
      ],
      default_payment_method: paymentMethodId,
      metadata: {
        userId: req.user.id,
        email: email,
      },
    };

    // Add promotion code if provided
    if (promotionCodeId) {
      subscriptionParams.discounts = [{ promotion_code: promotionCodeId }];
      console.log('[SUBSCRIBE-PRO] Applying promotion code:', promotionCodeId);
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    console.log('[SUBSCRIBE-PRO] ✅ Created Pro subscription:', subscription.id);

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
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
