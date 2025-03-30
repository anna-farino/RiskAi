import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { csfrHeader } from "@/utils/csrf-header";

export function useAuthCheck() {
  const navigate = useNavigate();

  return useQuery({
    queryKey: ['auth-check'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/check', {
          credentials: 'include',
          headers: {
            [csfrHeader().name]: csfrHeader().token
          }
        });

        if (!response.ok) {
          throw new Error('Authentication failed');
        }

        return true;
      } catch (error) {
        navigate('/login');
        throw error;
      }
    },
    retry: false, 
    refetchOnWindowFocus: true, 
  });
}
