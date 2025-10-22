import { subscriptionTiers } from "@shared/db/schema/organizations";
import { StripeCustomer, stripeCustomers } from "@shared/db/schema/stripe";
import { subsUser } from "@shared/db/schema/subscriptions";
import { db } from "backend/db/db";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";

export async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`[WEBHOOK] Handling subscription.created: ${subscription.id}`);

  const { userId, email, customerId } = subscription.metadata

  if (!userId || !email || !customerId) {
    throw new Error("Error: no userId or no email found in subscription.metadata")
  }

  const freeTierResult = await db
    .select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.name, "free"))
    .limit(1);

  if (freeTierResult.length === 0) {
    throw new Error("Free tier not found in subscription_tiers table");
  }

  const freeTier = freeTierResult[0];

  const existingSubResult = await db
    .select()
    .from(subsUser)
    .where(eq(subsUser.userId, userId))
    .limit(1);

  if (existingSubResult.length > 0) {

    console.log(`User ${userId} already has a subscription`);

    const existingSub = existingSubResult[0]
    if (existingSub.tierId===freeTier.id) {
      console.log(`User ${userId} already has a subscription and a stripe customerID`);
    }
  } else {
    
    let stripeCustomer: StripeCustomer;

    const stripeCustomerResult = await db
      .select()
      .from(stripeCustomers)
      .where(and(
        eq(stripeCustomers.userId,userId),
        eq(stripeCustomers.stripeCustomerId, customerId),
      ))

    if (stripeCustomerResult.length > 0) {

      stripeCustomer = stripeCustomerResult[0]

    } else {

      await db.insert(stripeCustomers).values({
        userId,
        organizationId: null,
        stripeCustomerId: customerId,
        email,
        metadata: {},
        isDeleted: false,
      });

      console.log(`Created stripe_customers record for user ${userId}`);
    }
    
    const startDate = new Date();
    await db.insert(subsUser).values({
      userId,
      tierId: freeTier.id,
      status: "active",
      startDate,
      endDate: null, 
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id, 
      metadata: {
        tier: "free",
        created_via: "createFreeSub",
      },
    });

    console.log(`Created free subscription for user ${userId}`);

  }

  console.log(`[WEBHOOK] Subscription created: ${subscription.id}`);
}
