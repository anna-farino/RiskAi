import { subscriptionTiers } from "@shared/db/schema/organizations";
import { StripeCustomer, stripeCustomers } from "@shared/db/schema/stripe";
import { subsUser } from "@shared/db/schema/subscriptions";
import { db } from "backend/db/db";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import { sendEventEmail } from "./utils/sendEventEmail";
import { htmlForEmail } from "./html-for-emails";

export async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`[WEBHOOK] Handling subscription.created: ${subscription.id}: `, subscription);

  const { userId, email, customerId } = subscription.metadata

  if (!userId || !email || !customerId) {
    throw new Error("Error: no userId or no email found in subscription.metadata")
  }

  const productsList = subscription.items.data
  const promo = subscription.discounts.length > 0

  if (productsList.length === 0) {
    console.error(`[WEBHOOK] The subscription ${subscription.id} doesn't contain any products`)
    return
  }

  const subPriceId = productsList[0].plan.id

  const existingSubResult = await db
    .select()
    .from(subsUser)
    .where(eq(subsUser.userId, userId))
    .limit(1);

  if (existingSubResult.length > 0) {
    console.log(`User ${userId} already has a subscription`);
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
    const tierRes = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.stripePriceId,subPriceId))

    if (tierRes.length === 0) {
      console.error("[WEBHOOK] no subscription tier found")
    }
    const tier = tierRes[0]
    console.log("[WEBHOOK] Tier found: ", tier)

    const subsUserRes = await db
      .insert(subsUser)
      .values({
        userId,
        tierId: tier.id,
        status: "active",
        startDate,
        endDate: null, 
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id, 
        metadata: {
          promo_code: promo,
          tier: tier.name,
          current_period: {
            start: subscription.items.data[0].current_period_start,
            end: subscription.items.data[0].current_period_end,
          },
          cancel_at_period_end: subscription.cancel_at_period_end,
        },
      })
      .returning()

    sendEventEmail({
      subsUserRes,
      subject: "Payment succeeded",
      html: htmlForEmail.subscriptionCreated
    })

    console.log(`[WEBHOOK] Created free subscription for user ${userId}:`, tier.name);

  }

  console.log(`[WEBHOOK] Subscription created: ${subscription.id}`);
}
