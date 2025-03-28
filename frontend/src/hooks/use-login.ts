import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export type LoginData = {
  email: string;
  password: string;
}

const serverUrl = (import.meta as ImportMeta & { env: { VITE_SERVER_URL_DEV: string } }).env.VITE_SERVER_URL_DEV;

//console.log("serverUrl", serverUrl);

export function useLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: LoginData) => {
      try {
        const response = await fetch(serverUrl + '/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Accept": "application/json"
          },
          body: JSON.stringify(data),
          credentials: 'include',
        });

        // Log response details for debugging
        const responseData = await response.json().catch(e => {
          console.error("❌ [LOGIN] Failed to parse response:", e);
          throw new Error('Invalid response from server');
        });


        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to login');
        }

        return responseData;
      } catch (error) {
        console.error('❌ [LOGIN] Error:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unexpected error occurred');
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logged in successfully!",
      });
      navigate('/dashboard/home');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
