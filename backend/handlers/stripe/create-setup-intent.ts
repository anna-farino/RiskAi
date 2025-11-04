import { stripe } from 'backend/utils/stripe-config';
import { findOrCreateCustomer } from 'backend/utils/stripe/find-or-create-customer';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import Stripe from 'stripe';
import { planPrice } from './get-plan-prices';

export default async function handleCreateSetupIntent(
  req: FullRequest,
  res: Response
) {
  try {
    const { email } = req.user;
    const { billingPeriod = 'monthly' } = req.body; // Default to monthly if not provided

    // Get or create customer using centralized function
    const { customer, isNew: isNewCustomer } = await findOrCreateCustomer({
      userId: req.user.id,
      email,
    });

    console.log(`[SETUP-INTENT] Using customer ${customer.id} (new: ${isNewCustomer})`);

    // Create SetupIntent to collect payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        purpose: isNewCustomer ? 'new_pro_subscription' : 'subscription_upgrade',
        customer_email: email,
        is_new_customer: isNewCustomer.toString(),
      },
    });

    // Select price ID based on billing period
    const priceId = billingPeriod === 'yearly' ? planPrice.pro.yearly : planPrice.pro.monthly;

    // Fetch Pro price details
    const price = await stripe.prices.retrieve(priceId);

    res.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      isNewCustomer,
      price: {
        amount: price.unit_amount,
        currency: price.currency,
      },
      billingPeriod,
    });

  } catch (error) {
    console.error('[SETUP-INTENT] Error:', error);
    res.status(500).json({
      error: 'Failed to create setup intent',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
