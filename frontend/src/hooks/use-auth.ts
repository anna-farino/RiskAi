import { useQuery } from "@tanstack/react-query";

interface User {
  id: number;
  email: string;
  name: string;
  permissions: string[]
}

const serverUrl = (import.meta as ImportMeta & { env: { VITE_SERVER_URL_DEV: string } }).env.VITE_SERVER_URL_DEV;

export function useAuth() {
  const { data: user } = useQuery<User>({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const response = await fetch(serverUrl + '/api/auth/check', {
        credentials: 'include'
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
