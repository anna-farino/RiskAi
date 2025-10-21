import { loadStripe } from '@stripe/stripe-js';

export const stripe = loadStripe((import.meta as any).env.VITE_STRIPE_PK);
