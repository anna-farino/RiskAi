import { useToast } from "@/hooks/use-toast";
import { useAuth0 } from "@auth0/auth0-react";


export function useLogout() {
  const { toast } = useToast();
  const { logout } = useAuth0()

  const callbackUrl = (import.meta as any).env.VITE_AUTH0_CALLBACK_URL

  async function handleLogout() {
    try {
      await logout({
        logoutParams: {
          returnTo: callbackUrl,
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
