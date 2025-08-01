import { csfrHeader, csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/use-fetch";
import LoadingScreen from "@/components/LoadingScreen";

type Props = {
    children: React.ReactNode;
}
export default function ProtectedRoutesWrapper({ children }: Props) {
  const fetchWithTokens = useFetch();
  const [ isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetchWithTokens('/api/auth/check', {
          method: 'GET'
        });
        if (!response.ok) {
          throw new Error('Authentication failed');
        }
        const data = await response.json()
        setIsAuthenticated(true);
      } catch (error) {
          console.error('Error checking authentication:', error);
          navigate('/auth/login');
      }
    }
    checkAuth();
  }, [])

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  return (
    <div>
      {children}
    </div>
  );
}
