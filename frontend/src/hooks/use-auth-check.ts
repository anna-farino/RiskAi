import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

export function useAuthCheck() {
  const navigate = useNavigate();
  console.log("useAuthCheck")

  return useQuery({
    queryKey: ['auth-check'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/check', {
          credentials: 'include' // Important for cookies
        });

        if (!response.ok) {
          throw new Error('Authentication failed');
        }

        return true;
      } catch (error) {
        // If authentication fails, redirect to login
        navigate('/login');
        throw error;
      }
    },
    retry: false, // Don't retry on failure
    refetchOnWindowFocus: true, // Check auth status when window regains focus
  });
}
