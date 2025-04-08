import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { serverUrl } from "@/utils/server-url";


export function useLogout() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const logout = async () => {
    try {
      console.log("Logging out...")
      const response = await fetch(serverUrl + '/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json()
      console.log(data)
      if (data.noToken) navigate('/auth/login')

      if (!response.ok) {
        throw new Error('Logout failed');
      }
      navigate('/auth/login');

      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  return { logout };
}
