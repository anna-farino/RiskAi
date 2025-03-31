import { csfrHeader } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/db/schema/user"

type UserWithPerm = User & { permissions: string[] }

export function useAuth() {
  const { data: user } = useQuery<UserWithPerm>({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const response = await fetch(serverUrl + '/api/auth/check', {
        credentials: 'include',
        headers: {
          [csfrHeader().name]: csfrHeader().token
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      const data = await response.json();
      const user = data.user.length > 0 ? data.user[0] : null;
      return user;
    },
    //staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  return { user };
}
