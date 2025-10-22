import { subsUser } from "@shared/db/schema/subscriptions";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[WEBHOOK] Handling payment.failed for invoice: ${invoice.id}`);

  // Check if this invoice is subscription-related
  const isSubscriptionInvoice = invoice.billing_reason?.includes('subscription');

  if (!isSubscriptionInvoice) {
    console.log(`[WEBHOOK] Invoice ${invoice.id} is not for a subscription`);
    return;
  }

  // Get customer ID
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  if (!customerId) {
    console.log(`[WEBHOOK] No customer ID found for invoice ${invoice.id}`);
    return;
  }

  // Update subscription status to past_due
  await db
    .update(subsUser)
    .set({
      status: 'past_due',
      metadata: {
        payment_failed: {
          date: new Date().toISOString(),
          invoice_id: invoice.id,
          attempt_count: invoice.attempt_count,
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(subsUser.stripeCustomerId, customerId));

  console.log(`[WEBHOOK] Payment failed for customer: ${customerId}`);
  // TODO: Send email notification to user about failed payment
}
