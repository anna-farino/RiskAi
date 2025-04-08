import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthLayout from "@/components/layout/AuthLayout"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { serverUrl } from "@/utils/server-url"
import { useState } from "react"
import { cn } from "@/lib/utils"
import PasswordEye from "@/components/password-eye"
import GoBackToLogin from "@/components/go-back-to-login"

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

export default function ConfirmPassword() {
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
      navigate('/dashboard/home')
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
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Enter New Password</CardTitle>
          <CardDescription>
            Enter your new password below 
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2 relative">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  disabled={mutation.isPending}
                  {...form.register("password")}
                  className="pr-10" // padding for the eye icon
                />
                <PasswordEye 
                  state={showPassword} 
                  setStateFn={setShowPassword}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2 relative">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  disabled={mutation.isPending}
                  {...form.register("confirmPassword")}
                />
                <PasswordEye 
                  state={showConfirmPassword} 
                  setStateFn={setShowConfirmPassword}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                { mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Storing new password...
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </div>
            <GoBackToLogin/>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

