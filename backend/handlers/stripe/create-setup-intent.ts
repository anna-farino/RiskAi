import { stripe } from 'backend/utils/stripe-config';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';

const PRO_PRICE_ID = 'price_1SIZwt4uGyk26FKnXAd3TWtW';

export default async function handleCreateSetupIntent(
  req: FullRequest,
  res: Response
) {
  try {
    const { email } = req.user;

    // Search for existing customer
    const customerResult = await stripe.customers.search({
      query: `email:"${email}"`
    });

    let customer;
    let isNewCustomer = false;

    if (!customerResult.data || customerResult.data.length === 0) {
      // NEW FLOW: Customer doesn't exist, create one
      console.log('[SETUP-INTENT] Creating new customer for:', email);
      customer = await stripe.customers.create({
        email: email,
        metadata: {
          userId: req.user.id,
        },
      });
      isNewCustomer = true;
    } else {
      // UPGRADE FLOW: Use existing customer
      customer = customerResult.data[0];
      console.log('[SETUP-INTENT] Found existing customer:', customer.id);
    }

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

    // Fetch Pro price details
    const price = await stripe.prices.retrieve(PRO_PRICE_ID);

    res.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      isNewCustomer,
      price: {
        amount: price.unit_amount,
        currency: price.currency,
      },
    });

  } catch (error) {
    console.error('[SETUP-INTENT] Error:', error);
    res.status(500).json({
      error: 'Failed to create setup intent',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
