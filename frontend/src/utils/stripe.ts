import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = (import.meta as any).env.VITE_STRIPE_PK;

if (!stripePublishableKey) {
  console.error('[STRIPE] VITE_STRIPE_PK environment variable is not set');
}

export const stripe = loadStripe(stripePublishableKey).catch((error) => {
  console.error('[STRIPE] Failed to load Stripe.js:', error);
  console.error('[STRIPE] This may be due to:');
  console.error('[STRIPE]   - Content Security Policy blocking js.stripe.com');
  console.error('[STRIPE]   - Network connectivity issues');
  console.error('[STRIPE]   - Invalid publishable key');
  throw error;
});
