import { useAuth0 } from "@auth0/auth0-react";
import { useToast } from "@/hooks/use-toast";

export function useLogout() {
  const { logout: auth0Logout } = useAuth0();
  const { toast } = useToast();

  const logout = async () => {
    try {
      console.log("Logging out...")
      
      // Use Auth0 logout which will clear Auth0 session and redirect
      await auth0Logout({
        logoutParams: {
          returnTo: window.location.origin + '/auth/login'
        }
      });

      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  return { logout };
}
