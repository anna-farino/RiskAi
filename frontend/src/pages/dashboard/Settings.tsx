import { CustomAlertDialog } from "@/components/custom-alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { useFetch } from "@/hooks/use-fetch";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Shield, CreditCard } from "lucide-react";
import ProSubscriptionForm from "@/components/ProSubscriptionForm";
import { Elements } from "@stripe/react-stripe-js";
import { stripe } from "@/utils/stripe";
import PricingView from "./PricingView";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [ resetOpen, setResetOpen ] = useState(false)
  const [ showPricingView, setShowPricingView ] = useState(false)
  const [ setupIntent, setSetupIntent ] = useState<string | null>(null)
  const [ showSubscriptionForm, setShowSubscriptionForm ] = useState(false)
  const [ isUpgradeFlow, setIsUpgradeFlow ] = useState(false)
  const [ customerId, setCustomerId ] = useState<string | undefined>()
  const [ priceAmount, setPriceAmount ] = useState<number>(0)
  const [ currency, setCurrency ] = useState<string>('usd')
  const [ error, setError ] = useState(false)
  const [ isLoadingPayment, setIsLoadingPayment ] = useState(false)
  const [ showDowngradeDialog, setShowDowngradeDialog ] = useState(false)
  const [ showPlanChangeSpinner, setShowPlanChangeSpinner ] = useState(false)
  const userData = useAuth()
  const fetchWithAuth = useFetch();

  // Called when user clicks "Subscribe to Pro" (new users) OR "Upgrade" (free users)
  async function initiateProSubscription(isUpgrade: boolean) {
    setIsUpgradeFlow(isUpgrade);
    setIsLoadingPayment(true);

    try {
      const result = await fetchWithAuth(`/api/create-setup-intent`, {
        method: 'POST'
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

  function handleSubscriptionSuccess() {
    setShowSubscriptionForm(false);
    setSetupIntent(null);
    setCustomerId(undefined);

    // Show spinner for 3 seconds before closing and refetching
    setShowPlanChangeSpinner(true);
    setTimeout(() => {
      setShowPlanChangeSpinner(false);
      setShowPricingView(false);
      userData.refetch();
    }, 3000);
  }

  function handleSubscriptionCancel() {
    setShowSubscriptionForm(false);
    setSetupIntent(null);
    setCustomerId(undefined);
    // Keep PricingView open, only close the payment modal
  }

  async function handlePlanSelect(plan: 'free' | 'pro') {
    if (plan === 'free' && userData.data?.subscription === 'pro') {
      // Pro → Free: Show confirmation dialog
      setShowDowngradeDialog(true);
    } else if (plan === 'free') {
      // No plan → Free: Direct creation (spinner handled in mutation.onSuccess)
      await subscribeMutation.mutateAsync();
    } else if (plan === 'pro') {
      // Upgrade to Pro
      const isUpgrade = userData.data?.subscription === 'free';

      // Keep pricing view open, show payment modal on top
      await initiateProSubscription(isUpgrade);
    }
  }
  
  const twoFAmutation = useMutation({
    mutationFn: (newTwoFAvalue: boolean) => {
      return fetchWithAuth(`/api/users/${userData.data?.id}/2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          twoFactorEnabled: newTwoFAvalue 
        })
      })
    },
    onSettled: () => {
      userData.refetch()
    },
    onError: () => {
      setError(true)
      setTimeout(()=>setError(false),3000)
    }
  })

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      if (!userData.data?.email) throw new Error()
      const response = await fetchWithAuth(`/api/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userData.data?.email
        })
      })
      if (!response.ok) throw new Error("No response")
    },
    onSuccess() {},
    onError(error) {
      console.error(error)
    },
  })

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth('/api/subscriptions/free-sub', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) throw new Error("Failed to create subscription")
      return response.json()
    },
    onSuccess: () => {
      // Show spinner for 3 seconds before closing and refetching
      setShowPlanChangeSpinner(true);
      setTimeout(() => {
        setShowPlanChangeSpinner(false);
        setShowPricingView(false);
        userData.refetch();
      }, 3000);
    },
    onError: (error) => {
      console.error(error)
      setError(true)
      setTimeout(() => setError(false), 3000)
    },
  })

  const downgradeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth('/api/downgrade-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) throw new Error("Failed to downgrade subscription")
      return response.json()
    },
    onSuccess: () => {
      setShowDowngradeDialog(false);

      // Show spinner for 3 seconds before closing and refetching
      setShowPlanChangeSpinner(true);
      setTimeout(() => {
        setShowPlanChangeSpinner(false);
        setShowPricingView(false);
        userData.refetch();
      }, 3000);
    },
    onError: (error) => {
      console.error(error)
      setError(true)
      setTimeout(() => setError(false), 3000)
    },
  })


  return (
    <div className="flex flex-col gap-4 mb-[120px]">
      {/* Settings Header - Similar to News Capsule */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md transition-all duration-300 mx-4 lg:mx-0">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                <Shield className="h-6 w-6 text-[#BF00FF]" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-white">Platform Settings</span>
                <span className="text-sm text-slate-400">Configure your account, security, and intelligence preferences</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                <span>Account Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>{!!userData.data?.twoFactorEnabled ? 'MFA Enabled' : 'MFA Disabled'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Layout for Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mx-4 lg:mx-0">
        
        {/* Account & Security Section */}
        <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md transition-all duration-300">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                <Shield className="h-6 w-6 text-[#BF00FF]" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-white">Account & Security</span>
                <span className="text-sm text-slate-400">Manage your account protection and privacy settings</span>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-base font-medium text-white">Two-Factor Authentication</Label>
                  <p className="text-sm text-slate-400 mt-1">Extra security layer for your account</p>
                </div>
                <Switch
                  id="two-factor-authentication"
                  disabled={twoFAmutation.isPending}
                  checked={userData.isFetching ? !(userData.data?.twoFactorEnabled) : !!userData.data?.twoFactorEnabled}
                  onClick={() => twoFAmutation.mutate(!userData.data?.twoFactorEnabled)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-base font-medium text-white">Reset Password</Label>
                  <p className="text-sm text-slate-400 mt-1">Change your account password</p>
                </div>
                <CustomAlertDialog
                  title="Reset Password?"
                  description={`An OTP-code will be sent to your email upon clicking 'Confirm'`}
                  action={sendOtpMutation.mutate}
                  open={resetOpen}
                  setOpen={setResetOpen}
                  twGapClass="gap-8"
                  twMaxWidthClass="max-w-sm"
                >
                  <Button variant="outline" size="sm">
                    Reset
                  </Button>
                </CustomAlertDialog>
              </div>
              {error && 
                <div className="text-destructive text-sm bg-red-500/10 border border-red-500/20 p-3 rounded">
                  An error occurred! Try again later
                </div>
              }
            </div>
          </div>
        </div>

        {/* Subscription Plan Section */}
        {false && (
          <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                  <CreditCard className="h-6 w-6 text-[#00FFFF]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-semibold text-white">Subscription Plan</span>
                  <span className="text-sm text-slate-400">Manage your subscription and billing</span>
                </div>
              </div>

              <div className="space-y-6">
                {/* Current Plan Display */}
                <div className="flex flex-row items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-base font-medium text-white">Current Plan</Label>
                    <p className="text-sm text-slate-400 mt-1">
                      {userData.data?.subscription === 'none' && 'No plan chosen'}
                      {userData.data?.subscription === 'free' && 'Free'}
                      {userData.data?.subscription === 'pro' && 'Pro'}
                    </p>
                  </div>
                  {userData.data?.subscription !== 'none' && (
                    <div className="px-3 py-1 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                      <span className="text-sm font-medium text-white">
                        {userData.data?.subscription === 'free' ? 'Free' : 'Pro'}
                      </span>
                    </div>
                  )}
                  {userData.data?.hasPromoCode && (
                    <div
                      className={cn(
                        "ml-2 px-3 py-1 bg-gradient-to-r from-green-500/20 to-[#BF00FF]/20",
                        "rounded-md text-center cursor-help"
                      )}
                      title={'Promotional discount applied'}
                    >
                      <span className="text-sm font-medium text-green-400">🎉 Promo Applied</span>
                    </div>
                  )}
                </div>

                {/* Change Plan Button */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-base font-medium text-white">Manage Subscription</Label>
                    <p className="text-sm text-slate-400 mt-1">View available plans and upgrade options</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPricingView(true)}
                  >
                    Change Plan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show pricing view */}
        {showPricingView && (
          <PricingView
            currentPlan={userData.data?.subscription || 'none'}
            onPlanSelect={handlePlanSelect}
            onGoBack={() => setShowPricingView(false)}
            hasPromoCode={userData.data?.hasPromoCode}
            promoDescription={userData.data?.promoInfo?.description}
          />
        )}

        {/* Downgrade confirmation dialog */}
        {showDowngradeDialog && (
          <CustomAlertDialog
            title="Downgrade to Free Plan?"
            description="You will lose access to Pro features including 15 sources, 50 keywords, and Light/Dark themes. Your data will be preserved."
            action={downgradeMutation.mutate}
            open={showDowngradeDialog}
            setOpen={setShowDowngradeDialog}
            twGapClass="gap-8"
            twMaxWidthClass="max-w-md"
          >
            <div />
          </CustomAlertDialog>
        )}

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
              <p className="text-white text-sm">Updating your plan...</p>
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
                  isUpgrade={isUpgradeFlow}
                  customerId={customerId}
                  priceAmount={priceAmount}
                  currency={currency}
                />
              </Elements>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
