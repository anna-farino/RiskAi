import { csfrHeader } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
    children: React.ReactNode;
}
export default function ProtectedRoutesWrapper({ children }: Props) {
  const [ isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(serverUrl + '/api/auth/check', {
          credentials: 'include',
          headers: {
            [csfrHeader().name]: csfrHeader().token
          }
        });
        if (!response.ok) {
          throw new Error('Authentication failed');
        }
        setIsAuthenticated(true);
      } catch (error) {
          console.error('Error checking authentication:', error);
          navigate('/login');
      }
    }
    checkAuth();
  }, [])

  if (!isAuthenticated) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {children}
    </div>
  );
}
