import { stripe } from "backend/utils/stripe-config";
import { logStripeOperation } from "backend/services/stripe-operation-tracker";
import Stripe from "stripe";

type Args = {
  userId: string;
  email: string;
};

export default async function createFreeSub({ userId, email }: Args): Promise<void> {
  console.log("Creating free subscription...")

  const customerResult = await stripe.customers.search({
    query: `email:"${email}"`
  })

  if (!customerResult.data || !Array.isArray(customerResult.data)) {
    throw new Error("No customer data found")
  }

  let customer: Stripe.Customer; 

  if (customerResult.data.length===0) {
      customer = await stripe.customers.create({
        email
      })
  } else {
    customer = customerResult.data[0]
  }

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
