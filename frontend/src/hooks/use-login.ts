import { useMutation } from "@tanstack/react-query"
import { toast } from "./use-toast";
import { useNavigate } from "react-router-dom";
import { serverUrl } from "@/utils/server-url";
import { useFetch } from "@/hooks/use-fetch";

export type LoginData = {
  email: string;
  password: string;
}

export default function useLogin() {
  const fetchWithTokens = useFetch();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (loginData: LoginData) => {
      const response = await fetchWithTokens(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: loginData.email,
          password: loginData.password
        })
      })
      if (!response.ok) throw new Error("An error occurred while attempting to log in.")
      return await response.json()
    },
    onSuccess: (data) => {
      console.log("Data returned: ", data)
      if (data.twoFactorEnabled) {
        navigate('/auth/otp?p=login');
      } else {
        toast({
          title: "Success",
          description: "Logged in successfully!",
        });
        navigate('/dashboard');
      }
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
