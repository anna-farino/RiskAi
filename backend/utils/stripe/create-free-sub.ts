import { stripe } from "backend/utils/stripe-config";
import { logStripeOperation } from "backend/services/stripe-operation-tracker";
import { findOrCreateCustomer } from "./find-or-create-customer";
import Stripe from "stripe";

type Args = {
  userId: string;
  email: string;
};

export default async function createFreeSub({ userId, email }: Args): Promise<void> {
  console.log("Creating free subscription...")

  // Get or create customer using centralized function
  const { customer } = await findOrCreateCustomer({ userId, email });

  const subResult = await stripe.subscriptions.list({
    customer: customer.id
  })

  if (!subResult.data || !Array.isArray(subResult.data)) {
    throw new Error("No subscription data available")
  }

  let subscription: Stripe.Subscription

  if (subResult.data.length===0) {
    subscription = await stripe.subscriptions.create({
      customer: customer.id,
      metadata: {
        userId,
        email,
        customerId: customer.id
      },
      items: [
        {
          price: 'price_1SIai04uGyk26FKnKrY7JcZ5'
        }
      ]
    })

    // Log the operation for tracking
    await logStripeOperation({
      operationType: 'create_subscription',
      userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      requestPayload: { tierType: 'free', email }
    });
  } else {
    subscription = subResult.data[0]
  }
}
