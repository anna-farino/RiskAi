import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useFetch } from "@/hooks/use-fetch";


export function useCanAccessAuth() {
  const fetchWithTokens = useFetch();
  const [ result, setResult ] = useState(false)
  const navigate = useNavigate();

  useQuery({
    queryKey: ['redirect-dashboard'],
    queryFn: async () => {
      try {
        const response = await fetchWithTokens('/api/auth/check')
        debugger
        if (!response.ok) {
          setResult(true)
        } 
        const data = await response.json()
        if (data.authenticated) {
          navigate("/dashboard")
          return true
        }
        setResult(true)
        return true
      } catch (error) {
        throw error;
      }
    },
    retry: false
  });

  return result
}
