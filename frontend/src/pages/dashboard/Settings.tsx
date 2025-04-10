import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { csfrHeader } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export default function Settings() {
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

  //console.log(userData.data)

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
            checked={twoFAmutation.isPending ? twoFAmutation.variables : !!userData.data?.twoFactorEnabled}
            onClick={() => twoFAmutation.mutate(!userData.data?.twoFactorEnabled)}
          />
          {error && 
            <h1 className="text-destructive">An error occurred! Try again later</h1>
          }
        </div>
      </div>
    </div>
  );
}
