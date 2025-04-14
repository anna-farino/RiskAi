import { CustomAlertDialog } from "@/components/custom-alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { csfrHeader } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const [ resetOpen, setResetOpen ] = useState(false)
  const [ error, setError ] = useState(false)
  const userData = useAuth()

  const twoFAmutation = useMutation({
    mutationFn: (newTwoFAvalue: boolean) => {
      //throw new Error("test") //Error for testing. To be removed soon
      return fetch(serverUrl + `/api/users/${userData.data?.id}/2fa`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          [csfrHeader().name]: csfrHeader().token 
        },
        body: JSON.stringify({
          twoFactorEnabled: newTwoFAvalue 
        })
      })
    },
    onSettled: () => userData.refetch(),
    onError: () => {
      setError(true)
      setTimeout(()=>setError(false),3000)
    }
  })

  const navigate = useNavigate();

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      if (!userData.data?.email) throw new Error()
      const response = await fetch(`${serverUrl}/api/auth/new-password-otp`, {
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
    onSuccess() {
      navigate('/dashboard/settings/otp?p=npw')
    },
    onError(error) {
      console.error(error)
    },
  })
  //console.log(userData.data)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">
          Settings
        </h1>
      </div>

      <div className="flex flex-col gap-y-10 w-full h-full">
        <div className="flex items-center justify-start gap-x-2">
          <h1>
            Two-Factor Authentication
          </h1>
          <Switch
            id="two-factor-authentication"
            checked={twoFAmutation.isPending ? twoFAmutation.variables : !!userData.data?.twoFactorEnabled}
            onClick={() => twoFAmutation.mutate(!userData.data?.twoFactorEnabled)}
          />
          {error && 
            <h1 className="text-destructive">An error occurred! Try again later</h1>
          }
        </div>
        <div className="flex items-center justify-start gap-x-4">
          <h1>
            Reset Password
          </h1>
          <CustomAlertDialog
            title="Reset Password?"
            description={`An OTP-code will be sent to your email upon clicking 'Confirm'`}
            action={sendOtpMutation.mutate}
            open={resetOpen}
            setOpen={setResetOpen}
            twGapClass="gap-8"
            twMaxWidthClass="max-w-sm"
          >
            <Button>
              Reset
            </Button>
          </CustomAlertDialog>
        </div>
      </div>
    </div>
  );
}
