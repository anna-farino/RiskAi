import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useFetch } from "@/hooks/use-fetch";
import { CustomAlertDialog } from "@/components/custom-alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Shield, Trash2, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export function SettingsAccountSecurity() {
  const userData = useAuth();
  const fetchWithAuth = useFetch();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState(false);

  // Delete account states
  const [deleteStep, setDeleteStep] = useState<'closed' | 'warning' | 'confirm'>('closed');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [undoOpen, setUndoOpen] = useState(false);

  const accountStatus = userData.data?.accountStatus || 'active';
  const isPendingDeletion = accountStatus === 'pending_deletion';

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
      setTimeout(() => setError(false), 3000)
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
    onSuccess() { },
    onError(error) {
      console.error(error)
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth(`/api/users/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmEmail: confirmEmail
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete account')
      }
      return await response.json()
    },
    onSuccess(data) {
      if (data.immediate) {
        // Free user - redirect to login
        toast({
          title: "Account Deleted",
          description: data.message,
          variant: "default",
        })
        setTimeout(() => {
          navigate('/login')
        }, 1000)
      } else {
        // Paid user - scheduled deletion
        toast({
          title: "Account Deletion Scheduled",
          description: data.message,
          variant: "default",
        })
        setDeleteStep('closed')
        setConfirmEmail('')
        userData.refetch()
      }
    },
    onError(error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const undoAccountDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth(`/api/users/account/undo-deletion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to undo account deletion')
      }
      return await response.json()
    },
    onSuccess(data) {
      toast({
        title: "Deletion Cancelled",
        description: data.message,
        variant: "default",
      })
      setUndoOpen(false)
      userData.refetch()
    },
    onError(error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  return (
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
              checked={localStorage.getItem('mfa')==='true'}
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

          {/* Delete Account Section */}
          <div className="pt-4 border-t border-slate-700/50">
            {isPendingDeletion ? (
              // Pending Deletion State - Show Undo Button
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-md">
                    <Clock className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-base font-medium text-white">Account Deletion Scheduled</Label>
                    <p className="text-sm text-slate-400 mt-1">
                      Your account will be deleted at the end of your billing period. You can undo this before then.
                    </p>
                  </div>
                </div>
                <CustomAlertDialog
                  title="Cancel Account Deletion?"
                  description="Are you sure you want to cancel the scheduled account deletion? Your subscription will continue normally."
                  action={undoAccountDeletionMutation.mutate}
                  open={undoOpen}
                  setOpen={setUndoOpen}
                  twGapClass="gap-8"
                  twMaxWidthClass="max-w-sm"
                  confirmTitle="Yes, Cancel Deletion"
                  forceMount={true}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                    disabled={undoAccountDeletionMutation.isPending}
                  >
                    {undoAccountDeletionMutation.isPending ? 'Processing...' : 'Undo Account Deletion'}
                  </Button>
                </CustomAlertDialog>
              </div>
            ) : (
              // Active State - Show Delete Button
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-500/20 rounded-md">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-base font-medium text-white">Delete Account</Label>
                    <p className="text-sm text-slate-400 mt-1">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                </div>

                {/* Multi-step Delete Modal */}
                <AlertDialog
                  open={deleteStep === 'warning'}
                  onOpenChange={(open) => {
                    if (!open) {
                      setDeleteStep('closed')
                      setConfirmEmail('')
                    }
                  }}
                >
                  <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <Trash2 className="h-6 w-6 text-red-500" />
                        <AlertDialogTitle className="text-white">Delete Account?</AlertDialogTitle>
                      </div>
                      <AlertDialogDescription className="text-slate-300">
                        Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => {
                          setDeleteStep('closed')
                          setConfirmEmail('')
                        }}
                        className="hover:bg-background text-white hover:text-white hover:border-white"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault()
                          setDeleteStep('confirm')
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white hover:text-white hover:border-white"
                      >
                        Yes, Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog
                  open={deleteStep === 'confirm'}
                  onOpenChange={(open) => {
                    if (!open) {
                      setDeleteStep('closed')
                      setConfirmEmail('')
                    }
                  }}
                >
                  <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <Trash2 className="h-6 w-6 text-red-500" />
                        <AlertDialogTitle className="text-white">Confirm Account Deletion</AlertDialogTitle>
                      </div>
                      <AlertDialogDescription className="text-slate-300">
                        Please type your email address to confirm:
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Input
                        type="email"
                        placeholder={userData.data?.email || 'your@email.com'}
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => {
                          setDeleteStep('closed')
                          setConfirmEmail('')
                        }}
                        disabled={deleteAccountMutation.isPending}
                        className="hover:border-white hover:text-white hover:bg-background"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault()
                          deleteAccountMutation.mutate()
                        }}
                        disabled={
                          deleteAccountMutation.isPending ||
                          confirmEmail !== userData.data?.email
                        }
                        className="bg-red-500 hover:bg-red-600 text-white hover:text-white hover:border-white"
                      >
                        {deleteAccountMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteStep('warning')}
                  className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30"
                >
                  Delete Account
                </Button>
              </>
            )}
          </div>

          {error &&
            <div className="text-destructive text-sm bg-red-500/10 border border-red-500/20 p-3 rounded">
              An error occurred! Try again later
            </div>
          }
        </div>
      </div>
    </div>
  );
}
