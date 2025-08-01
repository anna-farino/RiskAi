import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthLayout from "@/components/layout/AuthLayout"
import { useAuth0 } from "@auth0/auth0-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { serverUrl } from "@/utils/server-url"
import { useToast } from "@/hooks/use-toast"
import { z } from "zod"


export default function Login() {
  const { 
    loginWithRedirect, 
    isLoading,
    isAuthenticated,
    logout,
    user
  } = useAuth0()
  const [ searchParams,_ ] = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [isResending, setIsResending] = useState(false)
  
  const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE;
  
  console.log("searchParams", searchParams.get("email_verified"))
  console.log("searchParams2", searchParams.get("error_description"))
  console.log("[Login page] isAuthenticated", isAuthenticated)

  // Email validation schema
  const emailSchema = z.object({
    email: z.string().email("Please enter a valid email address")
  })


  useEffect(()=>{
    if (searchParams.get("email_verified") === "true") {
      handleLogin()
    }
  },[])

  async function handleLogin() {
    localStorage.removeItem("email_not_verified")
    await loginWithRedirect({
      authorizationParams: {
        audience
      },
    });
  };

  async function handleLogout() {
    localStorage.removeItem("email_not_verified")
    logout({ logoutParams: { returnTo: '' }})
  }

  async function resendLink() {
    try {
      setEmailError("")
      setIsResending(true)
      
      // Validate email with zod
      const validation = emailSchema.safeParse({ email })
      if (!validation.success) {
        setEmailError(validation.error.errors[0].message)
        return
      }

      const response = await fetch(`${serverUrl}/api/auth/send-verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': "application/json",
          'Accept': "application/json"
        },
        body: JSON.stringify({
          email: email
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "There was an error while trying to resend the link")
      }
      
      // Success: clear input and show toast
      setEmail("")
      toast({
        title: "Success",
        description: "Verification email sent successfully. Please check your inbox.",
      })
      
    } catch(error){
      console.error(error)
      setEmailError(error instanceof Error ? error.message : "Failed to send verification email")
    } finally {
      setIsResending(false)
    }
  }

  if (
    isLoading || 
    (isAuthenticated && user?.email_verified)
  ) return null

  return (
    <AuthLayout>
      <Card className="bg-black/70 backdrop-blur-sm border border-[#BF00FF]/20 shadow-lg w-full mx-auto overflow-hidden">
        <CardHeader className="pb-4 px-4 sm:px-6">
          <CardTitle className="text-2xl text-white text-center">Login</CardTitle>
          <CardDescription className="text-gray-300 text-center">
            Click the button below to log in or sign up 
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 sm:px-6">
          <Button 
            className={cn(
              "w-full text-white hover:text-white font-light",
              "transition-all duration-300 bg-gradient-to-r",
              "from-[#8B5CF6] to-[#06B6D4] hover:from-[#7C3AED] hover:to-[#0891B2]",
              "h-11 sm:h-12 text-sm sm:text-base rounded-md shadow-md border-none"
            )} 
            onClick={handleLogin}
          >
            Login/Signup
          </Button>
          {false && <Button 
            className={cn(
              "w-full text-white hover:text-white font-light",
              "transition-all duration-300 bg-gradient-to-r",
              "h-11 sm:h-12 text-sm sm:text-base rounded-md shadow-md border-none"
            )} 
            onClick={handleLogout}
          >
            Logout
          </Button>}
          {searchParams.get("error_description") === "Please verify your email before logging in." &&
            <CardDescription className="flex flex-col gap-4 text-gray-300 text-center text-md">
              Please verify your email (check your inbox)
              <div className="flex flex-col gap-2 mt-4">
                <Label htmlFor="email" className="text-left text-gray-300">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/50 border-[#BF00FF]/20 text-white placeholder:text-gray-500"
                />
                {emailError && (
                  <p className="text-red-400 text-sm text-left">{emailError}</p>
                )}
              </div>
              <Button 
                onClick={resendLink}
                disabled={isResending}
                className={cn(
                  "w-full text-white hover:text-white font-light",
                  "transition-all duration-300 bg-gradient-to-r",
                  "from-[#8B5CF6] to-[#06B6D4] hover:from-[#7C3AED] hover:to-[#0891B2]",
                  "h-11 sm:h-12 text-sm sm:text-base rounded-md shadow-md border-none",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isResending ? "Sending..." : "Resend Link"}
              </Button>
            </CardDescription>
          }
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
