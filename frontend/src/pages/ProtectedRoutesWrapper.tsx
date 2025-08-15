import { useFetch } from "@/hooks/use-fetch";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";

type Props = {
    children: React.ReactNode;
}
export default function ProtectedRoutesWrapper({ children }: Props) {
  const [ isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const fetchWithAuth = useFetch();
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetchWithAuth('/api/auth/check');
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
  }, [fetchWithAuth, navigate])

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  return (
    <div>
      {children}
    </div>
  );
}
