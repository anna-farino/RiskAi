import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthLayout from "@/components/layout/AuthLayout"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSignup } from "@/hooks/use-signup"
import { Loader2 } from "lucide-react"
import { RisqSpinner } from "@/components/ui/loading"
import PasswordEye from "@/components/password-eye"
import { useState } from "react"

const signupSchema = z
  .object({
    email: z.string().email("Please enter a valid email"),
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

type SignupFormData = z.infer<typeof signupSchema>;

export default function Signup() {
  const [ showPassword, setShowPassword ] = useState(false)
  const [ showConfirmPassword, setShowConfirmPassword ] = useState(false)
  const { mutate: signup, isPending } = useSignup();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    signup(data);
  });

  return (
    <AuthLayout>
      <Card className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Create an account</CardTitle>
          <CardDescription className="text-slate-300">
            Enter your details below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  disabled={isPending}
                  {...form.register("email")}
                  className="bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="flex relative">
                  <Input 
                    id="password" 
                    type={ showPassword ? "text" : "password"}
                    disabled={isPending}
                    {...form.register("password")}
                    className="bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                  />
                  <PasswordEye
                    state={showPassword}
                    setStateFn={setShowPassword}
                    top={9}
                  />
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="flex relative">
                  <Input 
                    id="confirmPassword" 
                    type={ showConfirmPassword ? "text" : "password"}
                    disabled={isPending}
                    {...form.register("confirmPassword")}
                  />
                  <PasswordEye
                    state={showConfirmPassword}
                    setStateFn={setShowConfirmPassword}
                    top={9}
                  />
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={isPending}>
              {isPending ? (
                <>
                  <RisqSpinner size="sm" className="mr-2" />
                  Creating account...
                </>
              ) : (
                "Sign Up"
              )}
            </Button>
            <div className="mt-4 text-center text-sm text-slate-300">
              Already have an account?{" "}
              <Link to="/auth/login" className="text-primary underline underline-offset-4 hover:text-primary/80">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
