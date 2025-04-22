import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";

export function useAuthCheck() {
  const navigate = useNavigate();

  return useQuery({
    queryKey: ['auth-check'],
    queryFn: async () => {
      try {
        const response = await fetch(serverUrl + '/api/auth/check', {
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        });

        if (!response.ok) {
          throw new Error('Authentication failed');
        }

        return true;
      } catch (error) {
        navigate('/auth/login');
        throw error;
      }
    },
    refetchOnWindowFocus: true, 
  });
}
