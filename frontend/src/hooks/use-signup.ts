import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { serverUrl } from "@/utils/server-url";

type SignupData = {
  email: string;
  password: string;
}

export function useSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SignupData) => {
      try {
        console.log('Sending signup request:', { email: data.email }); // Log request (excluding password)

        const response = await fetch(serverUrl + '/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            name: data.email.split('@')[0], // Use email username as name temporarily
          }),
          credentials: 'include',
        });

        const responseData = await response.json();
        console.log('Signup response:', responseData); // Log response for debugging

        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to sign up');
        }

        return responseData;
      } catch (error) {
        console.error('Signup error:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unexpected error occurred');
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account created successfully! Please log in.",
      });
      navigate('/login');
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
