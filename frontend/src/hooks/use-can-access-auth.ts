import { useQuery } from "@tanstack/react-query";
import { csfrHeader } from "@/utils/csrf-header";
import { useNavigate } from "react-router-dom";
import { serverUrl } from "@/utils/server-url";
import { useState } from "react";


export function useCanAccessAuth() {
  const [ result, setResult ] = useState(false)
  const navigate = useNavigate();

  useQuery({
    queryKey: ['redirect-dashboard'],
    queryFn: async () => {
      try {
        const response = await fetch(serverUrl + '/api/auth/check', {
          credentials: 'include',
          headers: {
            [csfrHeader().name]: csfrHeader().token
          }
        });
        if (!response.ok) {
          setResult(true)
        } 
        const data = await response.json()
        if (data.authenticated) {
          navigate("/dashboard/home")
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
