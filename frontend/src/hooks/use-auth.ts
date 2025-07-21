import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/db/schema/user"
import { useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useFetch } from "@/hooks/use-fetch";

export type Role = 'admin' | 'user'
export type UserWithPerm = User & { permissions: string[] } & { role: Role }

export function useAuth() {
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0()
  const fetchWithTokens = useFetch()

  return useQuery<UserWithPerm>({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const response = await fetchWithTokens('/api/auth/check');

      if (!response.ok) {
        navigate("/auth/login")
        return null
      }
      const data = await response.json();
      //console.log("useAuth data", data)
      const user = data.user.length > 0 ? data.user[0] : null;
      return user;
    },
  });
}

