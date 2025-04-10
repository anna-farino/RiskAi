import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { csfrHeader } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function Settings() {
  const userData = useAuth()
  const [ twoFA, setTwoFA ] = useState(userData.data?.twoFactorEnabled)

  useEffect(()=>{
    setTwoFA(userData.data?.twoFactorEnabled)
  },[userData.data])


  const twoFAmutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(serverUrl + `/api/users/${userData.data?.id}/2fa`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          [csfrHeader().name]: csfrHeader().token 
        },
        body: JSON.stringify({
          twoFactorEnabled: twoFA 
        })
      })
      if (!response.ok) {
        throw new Error("An error occurred while trying to update 2FA settings");
      }
      userData.refetch()
      return response
    }
  })


  function switchHandler() {
    setTwoFA(prev => !prev)
    twoFAmutation.mutate()
  }

  console.log(userData.data)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">
          Settings
        </h1>
      </div>

      <div className="flex flex-col w-full h-full">
        <div className="flex items-center justify-start space-x-2">
          <h1>
            Two-Factor Authentication
          </h1>
          <Switch
            id="two-factor-authentication"
            checked={!!twoFA}
            onCheckedChange={switchHandler}
          />
        </div>
      </div>
    </div>
  );
}
