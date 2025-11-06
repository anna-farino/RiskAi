import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useFetch } from "@/hooks/use-fetch";
import { CustomAlertDialog } from "@/components/custom-alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import ProSubscriptionForm from "@/components/ProSubscriptionForm";
import { Elements } from "@stripe/react-stripe-js";
import { stripe } from "@/utils/stripe";
import PricingView from "@/pages/dashboard/pricing-view";
import { toast } from "@/hooks/use-toast";

type DowngradeType = 
  'pro_to_free' |
  'pro_yearly_to_pro_monthly' 

export function SettingsSubscription() {
  const userData = useAuth();
  const fetchWithAuth = useFetch();

  // Subscription state
  const [showPricingView, setShowPricingView] = useState(false);
  const [setupIntent, setSetupIntent] = useState<string | null>(null);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [isChangeOfPlan, setIsChangeOfPlan] = useState(false);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [priceAmount, setPriceAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('usd');
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [showPlanChangeSpinner, setShowPlanChangeSpinner] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isTogglingNoSubMode, setIsTogglingNoSubMode] = useState(false);
  const [downgradeType, setDowngradeType] = useState<null | DowngradeType>(null);
  const [planButtonSpinner, setPlanButtonSpinner] = useState<'free' | 'pro' | null>(null);

  // Called when user clicks "Subscribe to Pro" (new users) OR "Upgrade" (free users)
  async function initiateProSubscription(isChange: boolean, billingPeriod: 'monthly' | 'yearly') {
    setIsChangeOfPlan(isChange);
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

  function planTierLevel(plan: 'free' | 'pro') {
    switch (plan) {
      case 'free':
        return 0
      case 'pro':
        return 1
    }
  }

  async function handlePlanSelect(plan: 'free' | 'pro', selectedBillingPeriod: 'monthly' | 'yearly') {
    console.log("handlePlanSelect ", plan)
    if (!userData.data) {
      console.log("USER DATA FROM SETTINGS: ", userData.data)
      const description = "User data not defined"
      toast({
        title: "Cannot change plan",
        description,
        variant: "destructive"
      })
      throw new Error(description)
    }
    const userPlanIsDefined = typeof userData.data.tierLevel === "number"
    if (!userPlanIsDefined) {
      console.log("USER DATA FROM SETTINGS: ", userData.data)
      const description = "User tier lever is not defined"
      toast({
        title: "Cannot change plan",
        description,
        variant: "destructive"
      })
      throw new Error(description)
    }

    //setPlanButtonSpinner(plan)

    if (userData.data.tierLevel > planTierLevel(plan)) {
      try {
        const res = await fetchWithAuth('/api/subscriptions/check-can-downgrade', {
          method: 'POST',
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: userData.data.id
          })
        })
        if (!res.ok) {
          toast({
            title: "User cannot downgrade",
            description: "Too many TechStack keywords. Delete some keywords to continue",
            variant: "destructive"
          })
          return
        }
      } catch(error) {
        console.error(error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "An error occurred"
        })
      } finally {
        setPlanButtonSpinner(null)
      }
    }

    // Store the billing period selection
    setBillingPeriod(selectedBillingPeriod);

    const fromProToFree = plan === 'free' && userData.data?.subscription.includes('pro')
    const fromProYearlyToProMonthly = 
      plan === 'pro' && 
      billingPeriod === 'monthly' && 
      userData.data?.subscriptionBillingPeriod === 'yearly'

    console.log("fromProYearlyToProMonthly: ", fromProYearlyToProMonthly)
    console.log("plan", plan)
    console.log("billingPeriod", billingPeriod)
    console.log("subs billingPeriod", userData.data.subscriptionBillingPeriod )

    if (fromProToFree) {
      setDowngradeType('pro_to_free')
      setShowDowngradeDialog(true);

    } else if (fromProYearlyToProMonthly) {
      setDowngradeType('pro_yearly_to_pro_monthly')
      setShowDowngradeDialog(true);

    } else if (plan === 'free') {
      // No plan → Free: Direct creation (spinner handled in mutation.onSuccess)
      setPlanButtonSpinner('free')
      await subscribeMutation.mutateAsync();
    } else if (plan === 'pro') {
      // Upgrade to Pro
      setPlanButtonSpinner('pro')
      const isChange = userData.data?.subscription != null && (userData.data?.subscription !== 'none' || false);

      // Keep pricing view open, show payment modal on top
      await initiateProSubscription(isChange, selectedBillingPeriod);
    }
  }

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
        setPlanButtonSpinner(null)
        setShowPricingView(false);
        userData.refetch();
      }, 3000);
    },
    onError: (error) => {
      console.error(error)
    },
  })

  const downgradeMutation = useMutation({
    mutationFn: async (dType: DowngradeType | null) => {
      if (!dType) {
        throw new Error("No downgrade type provided")
      }
      const response = await fetchWithAuth('/api/subscriptions/downgrade-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ downgradeType })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || "Failed to downgrade subscription")
      }
      return response.json()
    },
    onSuccess: () => {
      setShowDowngradeDialog(false);
      toast({
        title: "Downgrade Scheduled",
        description: "You'll keep Pro access until the end of your billing period, then automatically switch to Free.",
      })
      // Show spinner for 3 seconds before closing and refetching
      setShowPlanChangeSpinner(true);
      setTimeout(() => {
        setShowPlanChangeSpinner(false);
        setShowPricingView(false);
        setPlanButtonSpinner(null)
        userData.refetch();
      }, 3000);
    },
    onError: (error) => {
      console.error(error)
      setPlanButtonSpinner(null)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to schedule downgrade",
        variant: "destructive"
      })
    },
  })

  const cancelScheduledDowngradeMutation = useMutation({
    mutationFn: async (downgradeType: DowngradeType) => {
      const response = await fetchWithAuth('/api/subscriptions/cancel-scheduled-downgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) throw new Error("Failed to cancel scheduled downgrade")
      return response.json()
    },
    onSuccess: (_, variables) => {
      if (variables==='pro_to_free') {
        toast({
          title: "Downgrade Cancelled",
          description: "Your Pro subscription will continue to auto-renew.",
        })
      } else if (variables==='pro_yearly_to_pro_monthly') {
        toast({
          title: "Change Cancelled",
          description: "Your Pro subscription will continue to auto-renew yearly.",
        })
      }
      userData.refetch();
    },
    onError: (error) => {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to cancel scheduled downgrade",
        variant: "destructive"
      })
    },
  })

  // Toggle no-subscription mode for sub_free users
  const toggleNoSubModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetchWithAuth('/api/subscriptions/toggle-no-sub-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to toggle no-subscription mode")
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: data.noSubModeEnabled ? "Unlimited Access Enabled" : "Normal Mode Restored",
        description: data.message,
      })
      userData.refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle mode",
        variant: "destructive"
      })
      console.error(error)
    },
  })

  async function handleToggleNoSubMode(checked: boolean) {
    setIsTogglingNoSubMode(true)
    try {
      await toggleNoSubModeMutation.mutateAsync(checked)
    } finally {
      setIsTogglingNoSubMode(false)
    }
  }

  const downgradeDialogCopy: Record<DowngradeType, { title: string, description: string }> = {
    'pro_to_free': {
      title: "Schedule Downgrade to Free Plan?",
      description: "You'll keep full Pro access until the end of your current billing period, then automatically downgrade to Free. You can cancel this anytime before then. Your data will be preserved."
    },
    'pro_yearly_to_pro_monthly': {
      title: "Schedule Change to Monthly Pro Plan?",
      description: "You'll keep full access to your Yearly Pro Plan until the end of your current billing period, then automatically switch to the Montly Pro Plan. You can cancel this change anytime before then."
    }
  }

  return (
    <>
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
                  {userData.data?.subscriptionBillingPeriod 
                    ? userData.data?.subscriptionBillingPeriod[0].toUpperCase() + 
                      userData.data?.subscriptionBillingPeriod.slice(1) 
                    : ""
                  }
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
                    "rounded-md text-center "
                  )}
                  title={'Promotional discount applied'}
                >
                  <span className="text-sm font-medium text-green-400">🎉 Promo Applied</span>
                </div>
              )}
            </div>

            <div className={cn("flex flex-col")}>
              {(userData.data?.subscription.includes('pro') && userData.data?.subscriptionEnd) &&
                <div className={cn("flex flex-row justify-between")}>
                  {userData.data.accountStatus==='pending_deletion'
                    ? <h1>Account Ends </h1>
                    : userData.data.scheduledDowngrade?.willDowngrade
                      ? <h1>End of Pro Plan</h1>
                      : userData.data.subMetadata?.scheduled_change_from_yearly_to_monthly
                        ? <h1>Switch to Montly Plan</h1>
                        : <h1>Next Payment </h1>
                  }
                  <h1>{
                    (userData.data.hasPromoCode && 
                     userData.data.subscriptionBillingPeriod === 'monthly' &&
                     userData.data.subscription != 'pro_test'
                    )
                    ? new Date(new Date(userData.data.subMetadata!.current_period!.start * 1000).setMonth(
                        new Date(userData.data.subMetadata!.current_period!.start * 1000).getMonth() + 3
                      ))
                      .toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : new Date(userData.data.subscriptionEnd * 1000)
                        .toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                  }</h1>
                </div>
              }
              {/* For debugging only */
                <div className="hidden">
                  <h1>Start: {new Date(
                    (userData.data?.subMetadata?.current_period?.start || 0) * 1000)
                      .toLocaleDateString(
                        'en-US', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        }
                      )}
                  </h1>
                  <h1>End: {new Date(
                    (userData.data?.subMetadata?.current_period?.end || 0) * 1000)
                      .toLocaleDateString(
                        'en-US', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        }
                    )}
                  </h1>
                </div>
              }

              {/* Scheduled Downgrade Warning */}
              {(userData.data?.scheduledDowngrade?.willDowngrade ||
                userData.data?.subMetadata?.scheduled_change_from_yearly_to_monthly) 
                && (
                  <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-orange-400">
                          {userData.data?.scheduledDowngrade?.willDowngrade
                            ? <span>Downgrade to Free</span>
                            : <span>Change to Monthly</span>
                          }
                        </p>
                        {userData.data?.scheduledDowngrade?.willDowngrade
                          ? <p className="text-xs text-slate-400 mt-1">
                              Your Pro plan will downgrade on{' '}
                            {new Date(userData.data.scheduledDowngrade?.downgradeAt || 1 * 1000)
                              .toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            . You'll keep Pro access until then.
                            </p>
                          : <p className="text-xs text-slate-400 mt-1">
                              Your plan will become a monthly plan on{' '}
                            {new Date((userData.data.subMetadata?.downgrade_at || 1) * 1000)
                              .toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            .
                            </p>
                        }
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelScheduledDowngradeMutation.mutate(downgradeType!)}
                        disabled={cancelScheduledDowngradeMutation.isPending}
                        className="shrink-0"
                      >
                        {cancelScheduledDowngradeMutation.isPending ? "Cancelling..." : "Cancel Downgrade"}
                      </Button>
                    </div>
                  </div>
              )}

              {
                <div className={cn("flex flex-row text-sm text-muted-foreground mt-2")}>
                  <h1>Auto-renews: &nbsp;</h1>
                  <h1>{
                    String(
                      userData.data?.subscriptionStatus==='active' &&
                      !userData.data?.subscriptionCancelEnd &&
                      !userData.data?.scheduledDowngrade?.willDowngrade
                    )
                  }</h1>
                </div>
              }
            </div>

            {/* Change Plan Button */}
            {userData.data?.accountStatus!=='pending_deletion' &&
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-base font-medium text-white">Manage Subscription</Label>
                  <p className="text-sm text-slate-400 mt-1">View available plans and upgrade options</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPlanButtonSpinner(null)
                    setShowPricingView(true)
                  }}
                >
                  Change Plan
                </Button>
              </div>
            }

            {/* No-Subscription Mode Toggle (only for sub_free users) */}
            {(userData.data?.subFree && (import.meta as any).env.VITE_ENV != 'production') && (
              <div className="pt-6 mt-6 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-base font-medium text-white">No-Subscription Mode</Label>
                    <p className="text-sm text-slate-400 mt-1">
                      {userData.data?.noSubModeEnabled
                        ? "Unlimited access enabled - all features and sources unlocked"
                        : "Toggle to bypass subscription limits and access all features"
                      }
                    </p>
                    <p className="text-xs text-slate-400 mt-2 mb-2 flex items-center gap-1">
                      (Only for internal users in the staging environment)
                    </p>
                    {userData.data?.noSubModeEnabled && (
                      <p className="text-xs text-[#00FFFF] mt-2 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-[#00FFFF] rounded-full animate-pulse"></span>
                        Active: 1000 keywords, all sources
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={userData.data?.noSubModeEnabled || false}
                    onCheckedChange={handleToggleNoSubMode}
                    disabled={isTogglingNoSubMode}
                    className="data-[state=checked]:bg-[#BF00FF]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show pricing view */}
      {showPricingView && (
        <PricingView
          currentPlan={userData.data?.subscription || 'none'}
          billingPeriod={billingPeriod}
          planBillingPeriod={userData.data?.subscriptionBillingPeriod}
          onPlanSelect={handlePlanSelect}
          onGoBack={() => setShowPricingView(false)}
          hasPromoCode={userData.data?.hasPromoCode}
          promoDescription={userData.data?.promoInfo?.description}
          showGoBack={true}
          planButtonSpinner={planButtonSpinner}
        />
      )}

      {/* Downgrade confirmation dialog */}
      {showDowngradeDialog && (
        <CustomAlertDialog
          cancelAction={() => setPlanButtonSpinner(null)}
          title={downgradeDialogCopy[downgradeType || 'pro_to_free'].title}
          description={downgradeDialogCopy[downgradeType || 'pro_to_free'].description}
          action={()=>{
            const plan = downgradeType === 'pro_to_free' 
              ? 'free'
              : 'pro'
            setPlanButtonSpinner(plan)
            downgradeMutation.mutate(downgradeType || null)
          }}
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
                isChangeOfPlan={isChangeOfPlan}
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
