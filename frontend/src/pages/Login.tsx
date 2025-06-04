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
  rememberMe: z.boolean().optional(),
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
      rememberMe: false,
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    login(data)
  })

  return (
    <AuthLayout>
      <Card className="bg-black/70 backdrop-blur-sm border border-[#BF00FF]/20 shadow-lg w-full mx-auto overflow-hidden">
        <CardHeader className="pb-4 px-4 sm:px-6">
          <CardTitle className="text-2xl text-white text-center">Login</CardTitle>
          <CardDescription className="text-gray-300 text-center">
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2 relative">
                <Label htmlFor="email" className="text-white font-medium mb-1">Email</Label>
                <Input
                  id="email"
                  type="email"
                  disabled={loginIsPending}
                  {...form.register("email")}
                  className="bg-black/60 border-2 border-[#BF00FF]/30 text-white placeholder:text-gray-400 focus:border-[#00FFFF] focus:ring-[#00FFFF]/30 h-11 px-4"
                  placeholder="Enter your email"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-md border border-red-500/20 mt-1">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <Label htmlFor="password" className="text-white font-medium">Password</Label>
                  <Link
                    to="/auth/email-otp"
                    className="sm:ml-auto inline-block text-sm text-[#00FFFF] underline-offset-4 hover:opacity-80 hover:underline transition-all mt-1 sm:mt-0"
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
                    className="bg-black/60 border-2 border-[#BF00FF]/30 text-white placeholder:text-gray-400 focus:border-[#00FFFF] focus:ring-[#00FFFF]/30 h-11 px-4"
                    placeholder="Enter your password"
                  />
                  <PasswordEye
                    state={showPassword}
                    setStateFn={setShowPassword}
                    top={14}
                  />
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-md border border-red-500/20 mt-1">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              {false && <div className="flex items-center space-x-2">
                <Switch 
                  id="remember-me"
                  checked={form.watch("rememberMe")}
                  onCheckedChange={(checked) => form.setValue("rememberMe", checked)}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#BF00FF] data-[state=checked]:to-[#00FFFF]"
                  disabled={loginIsPending}
                />
                <Label 
                  htmlFor="remember-me" 
                  className="text-sm text-gray-200 hover:text-white cursor-pointer"
                  onClick={() => form.setValue("rememberMe", !form.watch("rememberMe"))}
                >
                  Remember me
                </Label>
              </div>}
              <Button 
                type="submit" 
                className="w-full text-white font-medium transition-all duration-300 bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] hover:from-[#7C3AED] hover:to-[#0891B2] h-11 sm:h-12 text-sm sm:text-base rounded-md shadow-md border-none" 
                disabled={loginIsPending}
              >
                {loginIsPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </div>
            <div className="mt-6 text-center text-sm text-gray-300">
              Don&apos;t have an account?{" "}
              <Link to="/auth/signup" className="text-[#00FFFF] font-medium underline-offset-4 hover:opacity-80 hover:underline transition-all">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
