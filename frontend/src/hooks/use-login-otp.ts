import { useMutation } from "@tanstack/react-query"
import { LoginData } from "./use-login"
import { toast } from "./use-toast";
import { useNavigate } from "react-router-dom";
import { serverUrl } from "@/utils/server-url";

export default function useLoginOtp() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (loginData: LoginData) => {
      const response = await fetch(`${serverUrl}/api/auth/login-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email: loginData.email,
          password: loginData.password
        })
      })
      const { error } = await response.json()
      if (!response.ok) throw new Error(error)
    },
    onSuccess: () => {
      navigate('/otp');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  })
}
