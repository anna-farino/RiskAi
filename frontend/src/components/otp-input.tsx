import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { serverUrl } from "@/utils/server-url"
import { toast } from "@/hooks/use-toast"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import GoBackToLogin from "./go-back-to-login"

const FormSchema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters long.",
  }),
})

type Props = {
  pParam: 'login' | 'pw' | 'npw' | 'signup'
}
export function InputOTPForm({ pParam }: Props) {
  const [ showLoader, setShowLoader ] = useState(false)
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: "",
    },
  })

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setShowLoader(true)
    try {
      let url: string = "";

      switch (pParam) {
        case 'login':
          url = `${serverUrl}/api/auth/verify-otp-login`;
          break;
        case 'signup':
          url = `${serverUrl}/api/auth/verify-otp-signup`;
          break;
        case 'pw':
        case 'npw':
          url = `${serverUrl}/api/auth/verify-otp-new-password`
          break;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          code: data.pin
        })
      })
      if (!response.ok) {
        throw new Error("An error occurred while validating the code")
      }
      switch (pParam) {
        case 'signup':
        case 'login':
          navigate('/dashboard/home');
          break
        case 'pw':
          navigate('/auth/new-password');
          break
        case 'npw':
          navigate('/dashboard/settings/new-password');
          break
      }
    } catch(error) {
      toast({
        title: "Error",
        description: (error as any).message ? (error as any).message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setShowLoader(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
        <FormField
          control={form.control}
          name="pin"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-300">One-Time Password</FormLabel>
              <FormControl>
                <InputOTP maxLength={6} {...field}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="bg-slate-800/70 border-slate-700/50 text-white" />
                    <InputOTPSlot index={1} className="bg-slate-800/70 border-slate-700/50 text-white" />
                    <InputOTPSlot index={2} className="bg-slate-800/70 border-slate-700/50 text-white" />
                    <InputOTPSlot index={3} className="bg-slate-800/70 border-slate-700/50 text-white" />
                    <InputOTPSlot index={4} className="bg-slate-800/70 border-slate-700/50 text-white" />
                    <InputOTPSlot index={5} className="bg-slate-800/70 border-slate-700/50 text-white" />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormDescription>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button disabled={showLoader} type="submit" className="gap-x-2 min-w-[140px] bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] border-0">
          {showLoader && <Loader2 className="animate-spin"/>}
          {showLoader ? "Verifying..." : "Submit"}
        </Button>
        {pParam !== 'npw' && <GoBackToLogin text="left"/>}
      </form>
    </Form>
  )
}
