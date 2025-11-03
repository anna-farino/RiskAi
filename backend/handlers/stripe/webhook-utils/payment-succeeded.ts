import { subsUser } from "@shared/db/schema/subscriptions";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { sendEventEmail } from "./utils/sendEventEmail";
import { htmlForEmail } from "./html-for-emails";

export async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`[WEBHOOK] Handling payment.succeeded for invoice: ${invoice.id}`);

  // Check if this invoice is subscription-related
  const isSubscriptionInvoice = invoice.billing_reason?.includes('subscription');

  if (!isSubscriptionInvoice) {
    console.log(`[WEBHOOK] Invoice ${invoice.id} is not for a subscription`);
    return;
  }

  // Get subscription ID from customer - we'll use the stripeCustomerId to find the subscription
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  if (!customerId) {
    console.log(`[WEBHOOK] No customer ID found for invoice ${invoice.id}`);
    return;
  }

  // Update subscription status to active using customer ID
  const currentPeriod = {
    start: new Date((invoice.period_start || 0) * 1000).toISOString(),
    end: new Date((invoice.period_end || 0) * 1000).toISOString(),
  };

  const subsUserRes = await db
    .update(subsUser)
    .set({
      status: 'active',
      metadata: {
        current_period: currentPeriod,
        last_payment: {
          date: new Date().toISOString(),
          amount: invoice.amount_paid,
          invoice_id: invoice.id,
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(subsUser.stripeCustomerId, customerId))
    .returning()

  sendEventEmail({
    subsUserRes,
    subject: "Payment succeeded",
    html: htmlForEmail.paymentSucceeded
  })

  console.log(`[WEBHOOK] Payment succeeded for customer: ${customerId}`);
}
