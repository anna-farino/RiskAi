import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import AuthLayout from "@/components/layout/AuthLayout"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import PasswordEye from "@/components/password-eye"
import useLogin from "@/hooks/use-login"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[?!@#$%^&*()]/, 'Password must contain at least one special character (!?@#$%^&*())'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [ showPassword, setShowPassword ] = useState(false)
  const { mutate: login, isPending: loginIsPending } = useLogin();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    login(data)
  })

  return (
    <AuthLayout>
      <Card className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Login</CardTitle>
          <CardDescription className="text-slate-300">
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2 relative">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  disabled={loginIsPending}
                  {...form.register("email")}
                  className="bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <Link
                    to="/auth/email-otp"
                    className="ml-auto inline-block text-sm text-slate-300 underline-offset-4 hover:text-primary hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <div className="flex relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"}
                    disabled={loginIsPending}
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
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={loginIsPending}>
                {loginIsPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login Credentials"
                )}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm text-slate-300">
              Don&apos;t have an account?{" "}
              <Link to="/auth/signup" className="text-primary underline underline-offset-4 hover:text-primary/80">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
