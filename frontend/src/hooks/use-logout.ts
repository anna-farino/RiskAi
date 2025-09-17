import { useAuth0 } from "@auth0/auth0-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { useRef } from "react";

export type LogoutReason = 'manual' | 'session_expired' | 'corrupted_tokens' | 'silent';

function getToastConfig(reason: LogoutReason) {
  switch (reason) {
    case 'manual':
      return {
        title: "Success",
        description: "Logged out successfully",
      };
    case 'session_expired':
      return {
        title: "Session Expired",
        description: "Your session has expired. Please sign in again.",
        variant: "destructive" as const,
      };
    case 'corrupted_tokens':
      return {
        title: "Authentication Error",
        description: "Authentication error detected. Please sign in again.",
        variant: "destructive" as const,
      };
    default:
      return {
        title: "Logged Out",
        description: "You have been logged out.",
      };
  }
}

export function useLogout() {
  const { logout: auth0Logout } = useAuth0();
  const { toast } = useToast();
  const lastLogoutTime = useRef<number>(0);
  const isLoggingOut = useRef<boolean>(false);

  const logout = async (reason: LogoutReason = 'manual') => {
    const now = Date.now();

    // Prevent multiple logout calls within 1000ms (debouncing)
    if (now - lastLogoutTime.current < 1000 || isLoggingOut.current) {
      console.log(`Logout debounced (reason: ${reason}). Last logout was ${now - lastLogoutTime.current}ms ago`);
      return;
    }

    lastLogoutTime.current = now;
    isLoggingOut.current = true;

    try {
      console.log(`Logging out with reason: ${reason}`);

      // Clear all cached queries to prevent stale data
      queryClient.clear();

      // Clear any application-specific storage
      try {
        localStorage.removeItem('auth-user');
        localStorage.removeItem('auth-state');
        sessionStorage.clear();
      } catch (storageError) {
        console.warn("Failed to clear local storage:", storageError);
      }

      // Use Auth0 logout which will clear Auth0 session and redirect
      await auth0Logout({
        logoutParams: {
          returnTo: window.location.origin + '/auth/login'
        }
      });

      // Show contextual toast based on logout reason
      if (reason !== 'silent') {
        const toastConfig = getToastConfig(reason);
        toast(toastConfig);
      }
    } catch (error) {
      console.error("Logout error:", error);

      // If Auth0 logout fails, still clear local state and force redirect
      console.log("Auth0 logout failed, forcing manual cleanup and redirect...");

      // Clear all cached queries
      queryClient.clear();

      // Clear local storage
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageError) {
        console.warn("Failed to clear storage during fallback logout:", storageError);
      }

      // Force redirect to login page
      window.location.href = '/auth/login';

      // Show error toast only if not silent
      if (reason !== 'silent') {
        toast({
          title: "Session Cleared",
          description: "Authentication session has been cleared. Please sign in again.",
          variant: "destructive",
        });
      }
    } finally {
      isLoggingOut.current = false;
    }
  };

  return { logout };
}
