# 🔄 Subscription Upgrade Plan: Option 2 - SetupIntent Flow

## 📋 Overview

This plan collects payment method **before** upgrading the subscription, then updates the existing subscription (keeping the same subscription ID and billing date).

**Updated to support two flows:**
1. **New users** → Select Pro plan directly (creates customer + subscription)
2. **Existing free users** → Upgrade to Pro (updates existing subscription)

### ✅ Pros
- Updates existing subscription (same ID preserved)
- Keeps original billing date
- Only one subscription exists at any time
- Clean subscription history
- Supports both new Pro signups and upgrades

### ❌ Cons
- Cannot use existing CheckoutForm component
- Need to build custom payment flow with Payment Element
- More complex frontend state management
- Need to handle SetupIntent confirmation
- More moving parts = more potential bugs

---

## 🔄 Complete Flows

### Flow A: New User Selects Pro Plan

```
Step 1: User logs in for first time, no subscription
Step 2: User clicks "Subscribe to Pro"
Step 3: Backend creates SetupIntent (no customer exists yet)
Step 4: Frontend shows Payment Element
Step 5: User enters card → Frontend confirms SetupIntent
Step 6: Frontend calls backend to create Pro subscription
Step 7: Backend creates customer + Pro subscription
Step 8: Success! User now has Pro subscription
```

### Flow B: Existing Free User Upgrades

```
Step 1: User with free subscription clicks "Upgrade"
Step 2: Backend creates SetupIntent for existing customer
Step 3: Frontend shows Payment Element
Step 4: User enters card → Frontend confirms SetupIntent
Step 5: Frontend calls backend upgrade endpoint
Step 6: Backend updates subscription from Free to Pro (same subscription ID)
Step 7: Success! Same subscription, now Pro tier
```

---

## 🔧 Backend Changes

### 1. Create New Handler: create-setup-intent.ts

**File:** `backend/handlers/stripe/create-setup-intent.ts`

```typescript
import { stripe } from 'backend/utils/stripe-config';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';

export default async function handleCreateSetupIntent(
  req: FullRequest,
  res: Response
) {
  try {
    const { email } = req.user;

    // Search for existing customer
    const customerResult = await stripe.customers.search({
      query: `email:"${email}"`
    });

    let customer;
    let isNewCustomer = false;

    if (!customerResult.data || customerResult.data.length === 0) {
      // NEW FLOW: Customer doesn't exist, create one
      console.log('[SETUP-INTENT] Creating new customer for:', email);
      customer = await stripe.customers.create({
        email: email,
        metadata: {
          userId: req.user.id,
        },
      });
      isNewCustomer = true;
    } else {
      // UPGRADE FLOW: Use existing customer
      customer = customerResult.data[0];
      console.log('[SETUP-INTENT] Found existing customer:', customer.id);
    }

    // Create SetupIntent to collect payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        purpose: isNewCustomer ? 'new_pro_subscription' : 'subscription_upgrade',
        customer_email: email,
        is_new_customer: isNewCustomer.toString(),
      },
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      isNewCustomer,
    });

  } catch (error) {
    console.error('[SETUP-INTENT] Error:', error);
    res.status(500).json({
      error: 'Failed to create setup intent',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
```

---

### 2. Create New Handler: subscribe-to-pro.ts

**File:** `backend/handlers/stripe/subscribe-to-pro.ts` *(NEW - for new users)*

```typescript
import { stripe } from 'backend/utils/stripe-config';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';

const PRO_PRICE_ID = 'price_1SIZwt4uGyk26FKnXAd3TWtW';

export default async function handleSubscribeToPro(
  req: FullRequest,
  res: Response
) {
  try {
    const { email } = req.user;
    const { paymentMethodId, customerId } = req.body;

    if (!paymentMethodId || !customerId) {
      return res.status(400).json({
        error: 'Payment method and customer ID required'
      });
    }

    console.log('[SUBSCRIBE-PRO] Creating Pro subscription for:', email);

    // Set payment method as default for customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create Pro subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: PRO_PRICE_ID,
        },
      ],
      default_payment_method: paymentMethodId,
      metadata: {
        userId: req.user.id,
        email: email,
      },
    });

    console.log('[SUBSCRIBE-PRO] ✅ Created Pro subscription:', subscription.id);

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
      },
    });

  } catch (error) {
    console.error('[SUBSCRIBE-PRO] Error:', error);
    res.status(500).json({
      error: 'Failed to create Pro subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
```

---

### 3. Create New Handler: upgrade-subscription.ts

**File:** `backend/handlers/stripe/upgrade-subscription.ts` *(for existing free users)*

```typescript
import { stripe } from 'backend/utils/stripe-config';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';

const FREE_PRICE_ID = 'price_1SIai04uGyk26FKnKrY7JcZ5';
const PRO_PRICE_ID = 'price_1SIZwt4uGyk26FKnXAd3TWtW';

export default async function handleUpgradeSubscription(
  req: FullRequest,
  res: Response
) {
  try {
    const { email } = req.user;
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method required' });
    }

    // Find customer
    const customerResult = await stripe.customers.search({
      query: `email:"${email}"`
    });

    if (!customerResult.data || customerResult.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerResult.data[0];

    // Find active free subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const subscription = subscriptions.data[0];

    // Verify it's a free subscription
    const freeItem = subscription.items.data.find(
      item => item.price.id === FREE_PRICE_ID
    );

    if (!freeItem) {
      return res.status(400).json({
        error: 'Subscription is not on free plan'
      });
    }

    console.log('[UPGRADE] Upgrading subscription:', subscription.id);

    // Set the payment method as default for the customer
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update subscription: remove free item, add pro item
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      {
        items: [
          {
            id: freeItem.id,
            deleted: true,
          },
          {
            price: PRO_PRICE_ID,
          },
        ],
        proration_behavior: 'create_prorations',
        default_payment_method: paymentMethodId,
      }
    );

    console.log('[UPGRADE] ✅ Upgraded to Pro:', subscription.id);

    res.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        current_period_end: updatedSubscription.current_period_end,
      },
    });

  } catch (error) {
    console.error('[UPGRADE] Error:', error);
    res.status(500).json({
      error: 'Failed to upgrade subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
```

---

### 4. Modify checkout-session.ts (Remove upgrade logic)

**File:** `backend/handlers/stripe/checkout-session.ts`

```typescript
// REMOVE the upgrade logic (lines 43-69):
if (freeItem) {
  // Old upgrade code...
}

// REPLACE with:
if (freeItem) {
  // User should use the upgrade flow, not checkout
  return res.status(400).json({
    error: 'Please use the upgrade flow to upgrade from free to pro',
    useUpgradeFlow: true,
  });
}
```

---

### 5. Add Routes

**File:** `backend/router/index.ts`

```typescript
import handleCreateSetupIntent from 'backend/handlers/stripe/create-setup-intent';
import handleSubscribeToPro from 'backend/handlers/stripe/subscribe-to-pro';
import handleUpgradeSubscription from 'backend/handlers/stripe/upgrade-subscription';

// ... in PROTECTED ROUTES section:
router.post("/create-setup-intent", handleCreateSetupIntent)
router.post("/subscribe-to-pro", handleSubscribeToPro)         // NEW
router.post("/upgrade-subscription", handleUpgradeSubscription)
```

---

## 💻 Frontend Changes

### 1. Create New Component: ProSubscriptionForm.tsx

**File:** `frontend/src/components/ProSubscriptionForm.tsx`

```typescript
import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from './ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useFetch } from '@/hooks/use-fetch';

interface ProSubscriptionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  isUpgrade: boolean; // true if upgrading from free, false if new Pro signup
  customerId?: string; // passed from setup intent
}

export default function ProSubscriptionForm({
  onSuccess,
  onCancel,
  isUpgrade,
  customerId,
}: ProSubscriptionFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchWithAuth = useFetch();
  const userData = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Confirm SetupIntent (saves payment method)
      const { error: setupError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (setupError) {
        setError(setupError.message || 'Payment setup failed');
        setIsLoading(false);
        return;
      }

      // 2. Call appropriate backend endpoint
      const endpoint = isUpgrade ? '/api/upgrade-subscription' : '/api/subscribe-to-pro';

      const body = isUpgrade
        ? { paymentMethodId: setupIntent.payment_method }
        : {
            paymentMethodId: setupIntent.payment_method,
            customerId: customerId
          };

      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Operation failed');
      }

      console.log(isUpgrade ? '✅ Subscription upgraded' : '✅ Pro subscription created');
      onSuccess();

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-2">
          {isUpgrade ? 'Upgrade to Pro' : 'Subscribe to Pro'}
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          {isUpgrade
            ? 'Enter your card details to upgrade your subscription'
            : 'Enter your card details to start your Pro subscription'}
        </p>
      </div>

      <PaymentElement />

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !stripe || !elements}
          className="flex-1"
        >
          {isLoading
            ? 'Processing...'
            : isUpgrade
              ? 'Upgrade to Pro'
              : 'Subscribe to Pro'}
        </Button>
      </div>
    </form>
  );
}
```

---

### 2. Modify Settings.tsx

**File:** `frontend/src/pages/dashboard/Settings.tsx`

```typescript
import { Elements } from '@stripe/react-stripe-js';
import ProSubscriptionForm from '@/components/ProSubscriptionForm';

export default function Settings() {
  // ... existing state ...
  const [setupIntent, setSetupIntent] = useState<string | null>(null);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [isUpgradeFlow, setIsUpgradeFlow] = useState(false);
  const [customerId, setCustomerId] = useState<string | undefined>();

  // Called when user clicks "Subscribe to Pro" (new users) OR "Upgrade" (free users)
  async function initiateProSubscription(isUpgrade: boolean) {
    setIsUpgradeFlow(isUpgrade);

    const result = await fetchWithAuth(`/api/create-setup-intent`, {
      method: 'POST'
    });
    const data = await result.json();

    setSetupIntent(data.clientSecret);
    setCustomerId(data.customerId);
    setShowSubscriptionForm(true);
  }

  function handleSubscriptionSuccess() {
    setShowSubscriptionForm(false);
    setSetupIntent(null);
    setCustomerId(undefined);
    userData.refetch();
    setUpgradeOpen(false);
  }

  function handleSubscriptionCancel() {
    setShowSubscriptionForm(false);
    setSetupIntent(null);
    setCustomerId(undefined);
    setUpgradeOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ... existing UI ... */}

      {/* NEW: Show Subscribe button when user has no subscription */}
      {userData.data?.subscription === 'none' && (
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Label className="text-base font-medium text-white">
              Pro Subscription
            </Label>
            <p className="text-sm text-slate-400 mt-1">
              Get premium features with Pro plan
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => initiateProSubscription(false)}  // NEW USER FLOW
          >
            Subscribe to Pro
          </Button>
        </div>
      )}

      {/* Show current plan and upgrade button when subscription is "free" */}
      {userData.data?.subscription === "free" && (
        <>
          <div className="flex items-center justify-between">
            <Label>Current Plan: Free</Label>
          </div>

          <CustomAlertDialog
            title="Upgrade Subscription?"
            description="Upgrade to unlock premium features."
            action={() => initiateProSubscription(true)}  // UPGRADE FLOW
            open={upgradeOpen}
            setOpen={setUpgradeOpen}
          >
            <Button variant="outline" size="sm">
              Upgrade to Pro
            </Button>
          </CustomAlertDialog>
        </>
      )}

      {/* Show subscription form modal */}
      {showSubscriptionForm && setupIntent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 p-6 rounded-lg max-w-md w-full">
            <Elements
              stripe={stripe}
              options={{
                clientSecret: setupIntent,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#BF00FF',
                    colorBackground: '#0f172a',
                    colorText: '#ffffff',
                    colorDanger: '#ef4444',
                    fontFamily: 'system-ui, sans-serif',
                    spacingUnit: '4px',
                    borderRadius: '6px',
                  },
                  rules: {
                    '.Input': {
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                    },
                    '.Input:focus': {
                      border: '1px solid #BF00FF',
                      boxShadow: '0 0 0 1px #BF00FF',
                    },
                    '.Label': {
                      color: '#94a3b8',
                    },
                  },
                },
              }}
            >
              <ProSubscriptionForm
                onSuccess={handleSubscriptionSuccess}
                onCancel={handleSubscriptionCancel}
                isUpgrade={isUpgradeFlow}
                customerId={customerId}
              />
            </Elements>
          </div>
        </div>
      )}

      {/* REMOVE: Old CheckoutForm */}
      {/* {clientSecret && (
        <CheckoutProvider ... >
          <CheckoutForm />
        </CheckoutProvider>
      )} */}
    </div>
  );
}
```

---

## 📊 File Changes Summary

| File | Type | Description |
|------|------|-------------|
| `backend/handlers/stripe/create-setup-intent.ts` | 🆕 New | Creates SetupIntent, handles both new customers and existing |
| `backend/handlers/stripe/subscribe-to-pro.ts` | 🆕 New | Creates Pro subscription for new users |
| `backend/handlers/stripe/upgrade-subscription.ts` | 🆕 New | Upgrades existing free subscription to Pro |
| `backend/handlers/stripe/checkout-session.ts` | ✏️ Modify | Remove upgrade logic, redirect to upgrade flow |
| `backend/router/index.ts` | ✏️ Modify | Add 3 new routes |
| `frontend/src/components/ProSubscriptionForm.tsx` | 🆕 New | Unified payment form for both new signups and upgrades |
| `frontend/src/pages/dashboard/Settings.tsx` | ✏️ Modify | Add "Subscribe to Pro" button and unified flow |
| `frontend/src/components/CheckoutForm.tsx` | 🗑️ Can Remove | No longer needed |

---

## ⚠️ Important Considerations

### 🔍 Testing Checklist

**For New User Flow:**
- [ ] Test with valid card (4242 4242 4242 4242)
- [ ] Test with declined card (4000 0000 0000 0002)
- [ ] Verify customer is created in Stripe
- [ ] Verify Pro subscription is created
- [ ] Test canceling mid-flow

**For Upgrade Flow:**
- [ ] Test upgrading from active free subscription
- [ ] Verify subscription ID stays the same
- [ ] Verify billing date doesn't change
- [ ] Test with card requiring 3D Secure (4000 0027 6000 3184)
- [ ] Test canceling mid-flow

**General:**
- [ ] Error handling for network errors
- [ ] Proper loading states
- [ ] Modal closes on success/cancel
- [ ] User can't click twice (race conditions)

---

### 🐛 Potential Issues

1. **Race conditions:** User might click subscribe/upgrade multiple times
2. **Payment failure:** SetupIntent confirms but subscription creation fails
3. **Network issues:** Connection drops between steps
4. **State management:** Modal doesn't close properly on success/error
5. **Webhook delays:** Subscription status not immediately reflected in your DB

---

### 🔒 Security Notes

- ✅ All routes protected with auth middleware
- ✅ Verify customer email matches authenticated user
- ✅ Validate paymentMethodId exists and belongs to customer
- ⚠️ Rate limit the subscription endpoints to prevent abuse
- ⚠️ Add idempotency keys for subscription creation

---

## 🎯 Key Differences from Original Option 2

### What Changed:

1. **New user flow added** - Users can now subscribe to Pro directly without free tier
2. **Single unified component** - `ProSubscriptionForm` handles both new signups and upgrades
3. **Customer creation logic** - Backend creates customer if doesn't exist
4. **New endpoint** - `subscribe-to-pro` for new Pro subscriptions
5. **Settings UI updated** - Shows "Subscribe to Pro" for users with no subscription

### What Stayed the Same:

- Same SetupIntent approach for payment collection
- Same subscription update logic for upgrades
- Same payment form styling and UX
- Same error handling patterns

---

## ✅ Next Steps If Approved

1. ✅ Create `create-setup-intent.ts` (handles both flows)
2. ✅ Create `subscribe-to-pro.ts` (new user flow)
3. ✅ Create `upgrade-subscription.ts` (upgrade flow)
4. ✅ Modify `checkout-session.ts` (reject upgrades)
5. ✅ Add routes to `router/index.ts`
6. ✅ Create `ProSubscriptionForm.tsx` component
7. ✅ Modify `Settings.tsx` (add Subscribe button + unified flow)
8. ✅ Test both flows thoroughly
9. ✅ Add proper error handling and loading states
10. ✅ Deploy and monitor

---

## 🔄 Flow Diagrams

### New User → Pro Subscription

```
[No Subscription]
       ↓
  Click "Subscribe to Pro"
       ↓
  Backend: Create customer + SetupIntent
       ↓
  Frontend: Show payment form
       ↓
  User enters card
       ↓
  Confirm SetupIntent
       ↓
  Call /api/subscribe-to-pro
       ↓
  Backend: Create Pro subscription
       ↓
  [Pro Subscription Active]
```

### Free User → Upgrade to Pro

```
[Free Subscription]
       ↓
  Click "Upgrade"
       ↓
  Backend: Create SetupIntent (existing customer)
       ↓
  Frontend: Show payment form
       ↓
  User enters card
       ↓
  Confirm SetupIntent
       ↓
  Call /api/upgrade-subscription
       ↓
  Backend: Update subscription (same ID)
       ↓
  [Pro Subscription Active - Same ID]
```

---

## 📝 Notes

- This approach maintains consistency between new signups and upgrades
- Both flows use the same UI component with slight text variations
- Backend properly handles both scenarios in `create-setup-intent.ts`
- Free tier is optional - users can go straight to Pro if they want
- Existing free users still get seamless upgrade experience
