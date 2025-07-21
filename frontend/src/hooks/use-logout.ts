import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth0 } from "@auth0/auth0-react";


export function useLogout() {
  const { toast } = useToast();
  const { logout } = useAuth0()

  async function handleLogout() {
    try {
      await logout({
        logoutParams: {
          returnTo: 'http://localhost:5174/auth/login',
        }
      })
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
  }

  return { handleLogout };
}
