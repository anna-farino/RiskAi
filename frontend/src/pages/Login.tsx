import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthLayout from "@/components/layout/AuthLayout"
import { useAuth0 } from "@auth0/auth0-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
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
  const navigate = useNavigate()
  
  console.log("searchParams", searchParams.get("email_verified"))
  console.log("searchParams2", searchParams.get("error_description"))
  console.log("[Login page] isAuthenticated", isAuthenticated)

  // Email validation schema
  const emailSchema = z.object({
    email: z.string().email("Please enter a valid email address")
  })

  function goBackHome() {
    logout()
    navigate('/auth/login')
  }

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
        setEmailError(validation.error.issues[0].message)
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
        className="bg-gradient-to-b from-[#300A45]/80 to-black/80 backdrop-blur-sm border border-[#BF00FF]/20 rounded-xl p-4 xs:p-5 sm:p-6 shadow-lg shadow-[#BF00FF]/5 w-full mx-auto overflow-hidden"
      >
        {/* Logo and Tagline Header */}
        <div className="mb-6 xs:mb-7 sm:mb-8 flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-3 xs:mb-4"
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
              <Logo size="md" interactive variant="gradient" />
            </a>
          </motion.div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xs xs:text-sm text-slate-400 italic text-center mb-4 xs:mb-5 sm:mb-6"
          >
            AI-Powered Risk Intelligence
          </motion.p>
          
          {/* Welcome Message */}
          {(
            searchParams.get("error_description") != "Please verify your email before logging in." && 
            !searchParams.get("message")?.includes("Your email was verified")
            ) &&
          <div className="flex items-center gap-2 xs:gap-3 mb-3 xs:mb-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-[#00FFFF] flex-shrink-0"
            >
              <Sparkles size={20} className="xs:w-6 xs:h-6" />
            </motion.div>
            <div className="flex-1 text-center">
              <motion.h3 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-lg xs:text-xl font-bold text-white mb-1"
              >
                Welcome to Your Intelligence Platform
              </motion.h3>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-xs xs:text-sm text-gray-300"
              >
                Comprehensive threat monitoring and analysis
              </motion.p>
            </div>
          </div>
          }
          {(
            searchParams.get("message")?.includes("Your email was verified")
      ) &&
          <div className="flex items-center gap-2 xs:gap-3 mb-3 xs:mb-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-[#00FFFF] flex-shrink-0"
            >
              <Sparkles size={20} className="xs:w-6 xs:h-6" />
            </motion.div>
            <div className="flex-1 text-center">
              <motion.h3 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-lg xs:text-xl font-bold text-white mb-1"
              >
                  Email verified!
              </motion.h3>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-xs xs:text-sm text-gray-300"
              >
                  Click the button below to log in
              </motion.p>
            </div>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-[#00FFFF] flex-shrink-0"
            >
              <Sparkles size={20} className="xs:w-6 xs:h-6" />
            </motion.div>
          </div>
          }
        </div>

        {/* Feature Highlights */}
        {(
          searchParams.get("error_description") != "Please verify your email before logging in." &&
          !searchParams.get("message")?.includes("Your email was verified")
  ) &&
        <div className="mb-6 xs:mb-7 sm:mb-8 space-y-2 xs:space-y-3">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center gap-2 xs:gap-3 p-2.5 xs:p-3 rounded-lg bg-gradient-to-r from-slate-900/40 to-slate-800/20"
          >
            <Newspaper size={18} className="text-[#BF00FF] flex-shrink-0 xs:w-5 xs:h-5" />
            <div>
              <h4 className="text-xs xs:text-sm font-medium text-white">News Radar</h4>
              <p className="text-xs text-gray-400">Monitor global news and emerging threats</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex items-center gap-2 xs:gap-3 p-2.5 xs:p-3 rounded-lg bg-gradient-to-r from-slate-900/40 to-slate-800/20"
          >
            <ShieldAlert size={18} className="text-[#00FFFF] flex-shrink-0 xs:w-5 xs:h-5" />
            <div>
              <h4 className="text-xs xs:text-sm font-medium text-white">Threat Tracker</h4>
              <p className="text-xs text-gray-400">Advanced cybersecurity intelligence</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="flex items-center gap-2 xs:gap-3 p-2.5 xs:p-3 rounded-lg bg-gradient-to-r from-slate-900/40 to-slate-800/20"
          >
            <Radar size={18} className="text-[#BF00FF] flex-shrink-0 xs:w-5 xs:h-5" />
            <div>
              <h4 className="text-xs xs:text-sm font-medium text-white">News Capsule</h4>
              <p className="text-xs text-gray-400">AI-powered analysis and reporting</p>
            </div>
          </motion.div>
        </div>}

        {/* Login Actions */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="flex flex-col gap-4"
        >
        {searchParams.get("error_description") != "Please verify your email before logging in." && 
          <Button 
            className={cn(
              "w-full text-white hover:text-white font-medium shadow-sm",
              "transition-all duration-300 bg-gradient-to-r",
              "from-[#BF00FF]/30 to-[#00FFFF]/10 hover:from-[#BF00FF]/40 hover:to-[#00FFFF]/20",
              "hover:shadow-md hover:shadow-[#BF00FF]/10",
              "h-10 xs:h-11 sm:h-12 text-sm xs:text-base rounded-lg border-none"
            )} 
            onClick={handleLogin}
          >
            <Shield className="mr-1.5 xs:mr-2 h-3.5 w-3.5 xs:h-4 xs:w-4" />
            <span className="hidden xs:inline">Access Your Intelligence Dashboard</span>
            <span className="xs:hidden">Access Dashboard</span>
          </Button>}

          {searchParams.get("error_description") === "Please verify your email before logging in." && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-3 xs:gap-4 p-3 xs:p-4 rounded-lg bg-gradient-to-r from-slate-900/60 to-slate-800/40"
            >
              <div className="text-center">
                <h1 className="text-lg xs:text-sm font-medium text-white mb-1.5 xs:mb-2">
                  Email Verification Required
                </h1>
                <p className="text-sm text-gray-400">
                  Please check your inbox and verify your email address
                </p>
              </div>
              
              <div className="flex mt-10 flex-col gap-1.5 xs:gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/50 border-[#BF00FF]/20 text-white placeholder:text-gray-500 h-9 xs:h-10 text-sm"
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
                  "h-9 xs:h-10 text-xs xs:text-sm rounded-lg border-none",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isResending ? "Sending..." : "Resend Verification"}
              </Button>
              <div 
                className={cn(
                  "flex flex-row w-full justify-center",
                  "text-sm text-gray-400 mt-10",
                  "hover:cursor-pointer hover:text-gray-100 transition-colors"
                )}
                onClick={goBackHome}
              >
                Home
              </div>
            </motion.div>
          )}

        </motion.div>
      </motion.div>
    </AuthLayout>
  );
}
