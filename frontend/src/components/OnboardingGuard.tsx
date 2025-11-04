import { ReactNode, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFetch } from '@/hooks/use-fetch';
import { useLogout } from '@/hooks/use-logout';
import { useMutation } from '@tanstack/react-query';
import PricingView from '@/pages/dashboard/pricing-view';
import { Spinner } from '@/components/ui/spinner';
import { Elements } from '@stripe/react-stripe-js';
import { stripe } from '@/utils/stripe';
import ProSubscriptionForm from '@/components/ProSubscriptionForm';

interface OnboardingGuardProps {
  children: ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data: userData, refetch: refetchUser } = useAuth();
  const fetchWithAuth = useFetch();
  const { logout } = useLogout();

  const [setupIntent, setSetupIntent] = useState<string | null>(null);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [priceAmount, setPriceAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('usd');
  const [showPlanChangeSpinner, setShowPlanChangeSpinner] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [freePlanSpinner, setFreePlanSpinner] = useState(false)
  const [dontShowPrices,setDontShowPrices] = useState<boolean>(
    JSON.parse(localStorage.getItem('dontShowInitPrices') || 'false')
  )

  // Check if user needs onboarding
  const needsOnboarding = userData && !userData.onBoarded;

  // Mutation to complete onboarding
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth('/api/auth/onboarding', {
        method: 'POST',
      });
      if (!response.ok) throw new Error("Failed to complete onboarding");
      return response.json();
    },
    onSuccess: async () => {
      console.log("[ONBOARDING] Completed successfully, refetching user data...");
      await refetchUser();
      console.log("[ONBOARDING] User data refetched");
    },
    onError: (error) => {
      console.error("[ONBOARDING] Error:", error);
    },
  });

  // Mutation to subscribe to free plan
  const subscribeFreeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth('/api/subscriptions/free-sub', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error("Failed to create subscription");
      return response.json();
    },
    onSuccess: async () => {
      console.log("[ONBOARDING] Free subscription created");

      // Show spinner while completing onboarding
      setShowPlanChangeSpinner(true);
      setFreePlanSpinner(false)

      try {
        // Mark onboarding as complete (this also refetches user data)
        await completeOnboardingMutation.mutateAsync();

        // Keep spinner visible for at least 1.5s for visual feedback
        await new Promise(resolve => setTimeout(resolve, 1500));
      } finally {
        setShowPlanChangeSpinner(false);
      }
    },
    onError: (error) => {
      console.error("[ONBOARDING] Free subscription error:", error);
      setShowPlanChangeSpinner(false);
      setFreePlanSpinner(false)
    },
  });

  // Function to initiate Pro subscription
  async function initiateProSubscription(billingPeriod: 'monthly' | 'yearly') {
    setIsLoadingPayment(true);

    try {
      const result = await fetchWithAuth(`/api/subscriptions/create-setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ billingPeriod })
      });
      const data = await result.json();

      setSetupIntent(data.clientSecret);
      setCustomerId(data.customerId);
      setPriceAmount(data.price.amount);
      setCurrency(data.price.currency);
      setShowSubscriptionForm(true);
    } finally {
      setIsLoadingPayment(false);
    }
  }

  // Handle subscription form success
  async function handleSubscriptionSuccess() {
    setShowSubscriptionForm(false);
    setSetupIntent(null);
    setCustomerId(undefined);

    // Show spinner while completing onboarding
    setShowPlanChangeSpinner(true);

    try {
      // Mark onboarding as complete (this also refetches user data)
      await completeOnboardingMutation.mutateAsync();

      // Keep spinner visible for at least 1.5s for visual feedback
      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
      setShowPlanChangeSpinner(false);
    }
  }

  // Handle subscription form cancel
  function handleSubscriptionCancel() {
    setShowSubscriptionForm(false);
    setSetupIntent(null);
    setCustomerId(undefined);
  }

  // Handle plan selection
  async function handlePlanSelect(plan: 'free' | 'pro', selectedBillingPeriod: 'monthly' | 'yearly') {
    // Store the billing period selection
    setBillingPeriod(selectedBillingPeriod);

    if (plan === 'free') {
      setFreePlanSpinner(true)
      await subscribeFreeMutation.mutateAsync();
    } else if (plan === 'pro') {
      await initiateProSubscription(selectedBillingPeriod);
    }
  }

  // If user doesn't need onboarding, render children
  if (!needsOnboarding || dontShowPrices) {
    return <>{children}</>;
  }

  function skipInitialPrices() {
    localStorage.setItem('dontShowInitPrices','true')
    setDontShowPrices(true)
  }

  // Show onboarding pricing view (no go back button, with logout)
  return (
    <>
      <PricingView
        freePlanSpinner={freePlanSpinner}
        currentPlan="none"
        onPlanSelect={handlePlanSelect}
        onGoBack={skipInitialPrices}
        showGoBack={userData.subFree}
        hasPromoCode={false}
        onLogout={logout}
      />

      {/* Show loading spinner while payment is initializing */}
      {isLoadingPayment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="flex flex-col items-center gap-4">
            <Spinner className="h-12 w-12 text-[#BF00FF]" />
            <p className="text-white text-sm">Loading payment form...</p>
          </div>
        </div>
      )}

      {/* Show spinner after plan change */}
      {showPlanChangeSpinner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="flex flex-col items-center gap-4">
            <Spinner className="h-12 w-12 text-[#BF00FF]" />
            <p className="text-white text-sm">Setting up your account...</p>
          </div>
        </div>
      )}

      {/* Show subscription form modal */}
      {showSubscriptionForm && setupIntent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="bg-slate-900 p-6 rounded-lg max-w-md w-full mx-4 min-h-[600px] flex flex-col">
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
                customerId={customerId}
                priceAmount={priceAmount}
                currency={currency}
                billingPeriod={billingPeriod}
              />
            </Elements>
          </div>
        </div>
      )}
    </>
  );
}
