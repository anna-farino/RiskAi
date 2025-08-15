import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/db/schema/user"
import { useNavigate } from "react-router";
import { useFetch } from "@/hooks/use-fetch";

export type Role = 'admin' | 'user'
export type UserWithPerm = User & { permissions: string[] } & { role: Role }

export function useAuth() {
  const navigate = useNavigate();
  const fetchWithTokens = useFetch()

  return useQuery<UserWithPerm>({
    queryKey: ['auth-user'],
    queryFn: async () => {
      try {
        const response = await fetchWithTokens('/api/auth/check');

        if (!response.ok) {
          console.error("Auth check failed with status:", response.status);
          navigate("/auth/login")
          return null
        }
        const data = await response.json();
        //console.log("useAuth data", data)
        const user = data.user.length > 0 ? data.user[0] : null;
        return user;
      } catch (error) {
        console.error("Auth check error:", error);
        navigate("/auth/login")
        return null;
      }
    },
    retry: false, // Don't retry auth checks
  });
}

