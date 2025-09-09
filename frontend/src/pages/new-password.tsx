import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { serverUrl } from "@/utils/server-url"
import { useState } from "react"
import PasswordEye from "@/components/password-eye"
import GoBackToLogin from "@/components/go-back-to-login"
import { toast } from "@/hooks/use-toast"

const loginSchema = z.
  object({
    password: z.string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/\d/, 'Password must contain at least one number')
      .regex(/[?!@#$%^&*()]/, 'Password must contain at least one special character (!?@#$%^&*())'),
    confirmPassword: z.string().min(1, "Password is required")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"], 
  });
type LoginFormData = z.infer<typeof loginSchema>;

type Props = {
  twHeight?: 'h-full' | 'min-h-screen',
  redirect?: 'home' | 'settings'
}
export default function ConfirmPassword({ 
  twHeight='min-h-screen',
  redirect='home'
}: Props) {
  const [ showPassword, setShowPassword ] = useState(false)
  const [ showConfirmPassword, setShowConfirmPassword ] = useState(false)
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async (loginData: LoginFormData) => {
      const response = await fetch(`${serverUrl}/api/auth/store-new-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newPassword: loginData.password,
        })
      })
      if (!response.ok) throw new Error("No response")
    },
    onSuccess() {
      switch (redirect) {
        case 'home':
          navigate('/dashboard/home')
          break
        case 'settings':
          toast({
            title: "Success!",
            description: "Password updated successfully"
          })
          navigate('/dashboard/settings')
      }
    },
    onError(error) {
      console.error(error)
    },
  })

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    console.log("submitting form")
    mutation.mutate(data)
  });

  return (
    <div className="min-h-screen w-full bg-black flex flex-col">
      <div className="flex-1 flex justify-center pt-16 pb-12 px-6 sm:px-8 lg:px-0">
        <div className="w-full max-w-lg space-y-8">
          {/* Page Title */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] bg-clip-text text-transparent">
              Password Reset
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Create a secure new password for your account
            </p>
          </div>

          {/* Password Reset Widget Card */}
          <Card className="bg-black/40 backdrop-blur border border-[#BF00FF]/20 rounded-md p-8 hover:border-[#BF00FF]/40 transition-all duration-300 shadow-2xl">
            <CardHeader className="p-0 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md">
                  <svg className="h-6 w-6 text-[#BF00FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.243-6.243C11.978 9.628 12.736 9.5 13.5 9.5a6.002 6.002 0 016.5 1.5z" />
                  </svg>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-semibold text-white">
                  New Password
                </CardTitle>
              </div>
              <CardDescription className="text-gray-400 text-base leading-relaxed">
                Enter your new password below. Make sure it's strong and secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <form onSubmit={onSubmit}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-3 relative">
                    <Label htmlFor="password" className="text-white font-medium">Password</Label>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      disabled={mutation.isPending}
                      {...form.register("password")}
                      className="pr-10 bg-black/60 border-2 border-[#BF00FF]/30 text-white placeholder:text-gray-400 focus:border-[#00FFFF] focus:ring-[#00FFFF]/30 h-11"
                      placeholder="Enter your new password"
                    />
                    <PasswordEye 
                      state={showPassword} 
                      setStateFn={setShowPassword}
                    />
                    {form.formState.errors.password && (
                      <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-md border border-red-500/20">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-3 relative">
                    <Label htmlFor="confirmPassword" className="text-white font-medium">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      disabled={mutation.isPending}
                      {...form.register("confirmPassword")}
                      className="pr-10 bg-black/60 border-2 border-[#BF00FF]/30 text-white placeholder:text-gray-400 focus:border-[#00FFFF] focus:ring-[#00FFFF]/30 h-11"
                      placeholder="Confirm your new password"
                    />
                    <PasswordEye 
                      state={showConfirmPassword} 
                      setStateFn={setShowConfirmPassword}
                    />
                    {form.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-md border border-red-500/20">
                        {form.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-[#BF00FF] hover:bg-[#BF00FF]/80 hover:text-[#00FFFF] text-white font-semibold h-12 rounded-md transition-all duration-300" 
                    disabled={mutation.isPending}
                  >
                    { mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating password...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </div>
                {redirect==='home' && (
                  <div className="mt-6">
                    <GoBackToLogin/>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

