import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthLayout from "@/components/layout/AuthLayout"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { serverUrl } from "@/utils/server-url"
import GoBackToLogin from "@/components/go-back-to-login"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});
type LoginFormData = z.infer<typeof loginSchema>;

export default function EmailOtp() {
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async (loginData: LoginFormData) => {
      const response = await fetch(`${serverUrl}/api/auth/new-password-otp`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: loginData.email
        })
      })
      if (!response.ok) throw new Error("No response")
    },
    onSuccess() {
      navigate('/auth/otp?p=pw')
    },
    onError(error) {
      console.error(error)
    },
  })

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
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
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your email below 
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  disabled={mutation.isPending}
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                { mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking Email...
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

