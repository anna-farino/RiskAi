import { stripe } from 'backend/utils/stripe-config';
import { planPrice } from './get-plan-prices';
import { Response } from 'express'
import { FullRequest } from 'backend/middleware';
import dotenv from 'dotenv'
import dotenvConfig from 'backend/utils/dotenv-config';

dotenvConfig(dotenv)
const appDomain = process.env.BASE_URL

export default async function handleCreateCheckoutSession(req: FullRequest, res: Response) {
  console.log("Create checkout session")
  try {
    const { email } = req.user;
    const { billingPeriod = 'monthly' } = req.body;
    console.log("User's email: ", email)

    // Query Stripe for existing customer and subscription (Stripe as source of truth)
    const customerResult = await stripe.customers.search({
      query: `email:"${email}"`
    });
    console.log("Customer Result: ", customerResult)

    if (customerResult.data && customerResult.data.length > 0) {
      const customer = customerResult.data[0];

      // Check if customer has an active subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length > 0) {
        const existingSubscription = subscriptions.data[0];

        // Check if they're on the free plan
        const freeItem = existingSubscription.items.data.find(
          item => item.price.id === planPrice.free.monthly
        );

        if (freeItem) {
          // User should use the upgrade flow, not checkout
          console.log('[CHECKOUT] User has free subscription, redirecting to upgrade flow');
          return res.status(400).json({
            error: 'Please use the upgrade flow to upgrade from free to pro',
            useUpgradeFlow: true,
          });
        }

        // Already on Pro or another paid plan
        return res.status(400).json({
          error: 'Already have a Pro subscription'
        });
      }
    }

    // No existing subscription - create new checkout session for first-time Pro signup
    // But check if customer exists first to avoid creating duplicate customers
    let customerId: string | undefined;

    if (customerResult.data && customerResult.data.length > 0) {
      customerId = customerResult.data[0].id;
    }

    // Select price ID based on billing period
    const priceId = billingPeriod === 'yearly' ? planPrice.pro.yearly : planPrice.pro.monthly;

    const session = await stripe.checkout.sessions.create({
      ui_mode: "custom",
      customer: customerId, // Use existing customer if found
      customer_email: customerId ? undefined : email, // Only set email if no customer
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      allow_promotion_codes: true,
      phone_number_collection: {
        enabled: false
      },
      payment_method_types: ['card'], // Only allow card payments
      return_url: `${appDomain}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}`,
    });

    res.send({ clientSecret: session.client_secret });

  } catch (error) {
    const msg = "Couldn't create checkout session: " + (error instanceof Error ? error.message : String(error))
    console.error(msg)
    res.status(500).json({ message: msg })
  }
}
