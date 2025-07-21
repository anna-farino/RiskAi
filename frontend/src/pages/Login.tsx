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
import { useAuth0 } from "@auth0/auth0-react"
import { cn } from "@/lib/utils"


export default function Login() {
  const { 
    loginWithRedirect, 
  } = useAuth0()

  async function handleLogin() {
    await loginWithRedirect({
      authorizationParams: {
        audience: 'http://localhost:5002'
      },
      appState: {
        returnTo: 'http://localhost:5174/login',
      },
    });
  };

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
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
