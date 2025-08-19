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
import { motion } from "framer-motion"
import { Newspaper, ShieldAlert, Radar, Sparkles, TrendingUp, Shield } from "lucide-react"
import { Logo } from "@/components/ui/logo"


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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-b from-[#300A45]/80 to-black/80 backdrop-blur-sm border border-[#BF00FF]/20 rounded-xl p-6 shadow-lg shadow-[#BF00FF]/5 w-full mx-auto overflow-hidden"
      >
        {/* Logo and Tagline Header */}
        <div className="mb-8 flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-4"
          >
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                window.location.reload(); 
              }} 
              title="Click to refresh page" 
              className="inline-block"
            >
              <Logo size="lg" interactive variant="gradient" />
            </a>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-sm text-slate-400 italic text-center mb-6"
          >
            AI-Powered Risk Intelligence
          </motion.p>
          
          {/* Welcome Message */}
          <div className="flex items-center gap-3 mb-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-[#00FFFF] flex-shrink-0"
            >
              <Sparkles size={24} />
            </motion.div>
            <div className="flex-1 text-center">
              <motion.h3 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-xl font-bold text-white mb-1"
              >
                Welcome to Your Intelligence Platform
              </motion.h3>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-sm text-gray-300"
              >
                Comprehensive threat monitoring and analysis
              </motion.p>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mb-8 space-y-3">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-900/40 to-slate-800/20"
          >
            <Newspaper size={20} className="text-[#BF00FF] flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-white">News Radar</h4>
              <p className="text-xs text-gray-400">Monitor global news and emerging threats</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-900/40 to-slate-800/20"
          >
            <ShieldAlert size={20} className="text-[#00FFFF] flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-white">Threat Tracker</h4>
              <p className="text-xs text-gray-400">Advanced cybersecurity intelligence</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-900/40 to-slate-800/20"
          >
            <Radar size={20} className="text-[#BF00FF] flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-white">News Capsule</h4>
              <p className="text-xs text-gray-400">AI-powered analysis and reporting</p>
            </div>
          </motion.div>
        </div>

        {/* Login Actions */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="flex flex-col gap-4"
        >
          <Button 
            className={cn(
              "w-full text-white hover:text-white font-medium shadow-sm",
              "transition-all duration-300 bg-gradient-to-r",
              "from-[#BF00FF]/30 to-[#00FFFF]/10 hover:from-[#BF00FF]/40 hover:to-[#00FFFF]/20",
              "hover:shadow-md hover:shadow-[#BF00FF]/10",
              "h-12 text-base rounded-lg border-none"
            )} 
            onClick={handleLogin}
          >
            <Shield className="mr-2 h-4 w-4" />
            Access Your Intelligence Dashboard
          </Button>

          {searchParams.get("error_description") === "Please verify your email before logging in." && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 p-4 rounded-lg bg-gradient-to-r from-slate-900/60 to-slate-800/40"
            >
              <div className="text-center">
                <h4 className="text-sm font-medium text-white mb-2">Email Verification Required</h4>
                <p className="text-xs text-gray-400">Please check your inbox and verify your email address</p>
              </div>
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-left text-gray-300 text-sm">
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
                  "w-full text-white hover:text-white font-medium shadow-sm",
                  "transition-all duration-300 bg-gradient-to-r",
                  "from-[#00FFFF]/30 to-[#BF00FF]/10 hover:from-[#00FFFF]/40 hover:to-[#BF00FF]/20",
                  "hover:shadow-md hover:shadow-[#00FFFF]/10",
                  "h-10 text-sm rounded-lg border-none",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isResending ? "Sending..." : "Resend Verification"}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AuthLayout>
  );
}
