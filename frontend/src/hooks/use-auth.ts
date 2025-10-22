import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { User } from "@shared/db/schema/user"
import { useFetch } from "@/hooks/use-fetch";
import { useLogout } from "@/hooks/use-logout";

export type Role = 'admin' | 'user'
export type UserWithPerm = User
  & { permissions: string[] }
  & { role: Role }
  & { subscription: string }
  & { hasPromoCode?: boolean }
  & { promoInfo?: { description?: string } }

export function useAuth() {
  const { isAuthenticated, user: auth0User } = useAuth0();
  const fetchWithTokens = useFetch();
  const { logout } = useLogout();

  return useQuery<UserWithPerm | null>({
    queryKey: ['auth-user', auth0User?.sub],
    queryFn: async () => {
      // Only fetch user data if authenticated via Auth0
      if (!isAuthenticated || !auth0User?.email_verified) {
        return null;
      }

      try {
        const response = await fetchWithTokens('/api/auth/check');

        if (!response.ok) {
          console.error("User data fetch failed with status:", response.status);

          // If user is not authorized (not in whitelist), log them out immediately
          if (response.status === 401) {
            logout('not_authorized');
          }

          return null;
        }

        const data = await response.json();
        const user = data.user.length > 0 ? data.user[0] : null;
        return user;
      } catch (error) {
        console.error("User data fetch error:", error);
        // Don't navigate - let Auth0 handle authentication state
        return null;
      }
    },
    retry: false, // Don't retry user data fetches
    enabled: isAuthenticated && !!auth0User?.email_verified, // Only run when authenticated
  });
}

