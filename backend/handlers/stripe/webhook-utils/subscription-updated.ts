import { subsUser } from "@shared/db/schema/subscriptions";
import { SubscriptionTier, subscriptionTiers } from "@shared/db/schema/organizations";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { stripe } from "backend/utils/stripe-config";

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`[WEBHOOK] Handling subscription.updated: ${subscription.id}`);

  console.log(`[WEBHOOK] Retrieved subscription: `, subscription);

  // Get the price ID from subscription items
  const priceId = subscription?.items?.data[0]?.price.id;

  if (!priceId) {
    console.warn(`[WEBHOOK] No price ID found in subscription ${subscription.id}`);
  } else {
    console.log(`[WEBHOOK] Subscription has price ID: ${priceId}`);
  }

  // Look up the tier by Stripe price ID
  let tierId: string | undefined;
  let tier: SubscriptionTier;
  if (priceId) {
    const tierRes = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.stripePriceId, priceId))
      .limit(1);

    if (tierRes.length > 0) {
      console.log(`[WEBHOOK] Found tierRes: `, JSON.stringify(tierRes));
      tierId = tierRes[0].id;
      tier = tierRes[0]
      console.log(`[WEBHOOK] Found tier: ${tier[0]?.name} (${tierId})`);
    } else {
      console.warn(`[WEBHOOK] No tier found for price ID: ${priceId}`);
    }
  }

  // Update subscription status, metadata, and tier
  const currentPeriod = {
    start: new Date(subscription.start_date * 1000).toISOString(),
  };

  const promo = subscription.discounts.length > 0

  console.log('[WEBHOOK] Promo code detected on subscription? ', promo);

  const updateData: any = {
    status: subscription.status as any,
    metadata: {
      tier: tier.name,
      promo_code: promo,
      current_period: currentPeriod,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    updatedAt: new Date(),
  };

  console.log("Update data after subscription update: ", updateData)

  // Only update tierId if we found a matching tier
  if (tierId) {
    updateData.tierId = tierId;
  }

  await db
    .update(subsUser)
    .set(updateData)
    .where(eq(subsUser.stripeSubscriptionId, subscription.id));

  console.log(`[WEBHOOK] Subscription updated: ${subscription.id}, status: ${subscription.status}${tierId ? `, tier updated to: ${tierId}` : ''}${promo ? `, promo applied` : ''}`);
}
