import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/db/schema/user"

export type Role = 'admin' | 'user'
export type UserWithPerm = User & { permissions: string[] } & { role: Role }

export function useAuth() {
  return useQuery<UserWithPerm>({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const response = await fetch(serverUrl + '/api/auth/check', {
        credentials: 'include',
        headers: {
          ...csfrHeaderObject()
        }
      });

      if (!response.ok) {
        return null
      }
      const data = await response.json();
      //console.log("useAuth data", data)
      const user = data.user.length > 0 ? data.user[0] : null;
      return user;
    },
    retry: false,
  });
}
