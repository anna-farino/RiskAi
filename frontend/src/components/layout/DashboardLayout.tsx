import { Outlet, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { RisqHeader } from './RisqHeader';
import { MainNavigation } from './MainNavigation';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useRef } from 'react';
import { useLogout } from '@/hooks/use-logout';
import { checkStoredTokenHealth, clearCorruptedTokens } from '@/utils/token-validation';

export default function DashboardLayout() {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const { data: userData, isLoading: userDataLoading, error: userDataError } = useAuth();
  const { logout } = useLogout();
  const userDataFailureCount = useRef(0);
  const lastUserDataCheck = useRef<number>(0);

  // Monitor authentication state for broken sessions
  useEffect(() => {
    // Only check when we think we're authenticated
    if (!isAuthenticated || isLoading) return;

    const now = Date.now();

    // IMMEDIATE TOKEN HEALTH CHECK (but only after initial loading is done)
    if (!userDataLoading) {
      const tokenHealth = checkStoredTokenHealth();
      console.log("Token health check:", tokenHealth);

      // 1. Check for corrupted tokens (but be more lenient)
      if (tokenHealth.hasTokens && tokenHealth.accessTokenHealth?.isCorrupted) {
        console.error("LOGOUT: Corrupted tokens detected in localStorage:", tokenHealth.accessTokenHealth.error);
        clearCorruptedTokens();
        logout('corrupted_tokens');
        return;
      }

      // 2. Check for missing tokens when authenticated (only after userData fails multiple times)
      if (!tokenHealth.hasTokens && isAuthenticated && !userData && !userDataLoading && userDataFailureCount.current >= 3) {
        console.error("LOGOUT: No Auth0 tokens found but still authenticated via cookies. Triggering logout...");
        logout('corrupted_tokens');
        return;
      }

      // 3. Don't check for expired tokens here - let Auth0 handle expiration
      // Expired tokens should be refreshed automatically by Auth0
    }

    // 2. If userData fails to load and we're not in initial loading state
    if (!userDataLoading && !userData && isAuthenticated) {
      // Track consecutive userData failures
      if (now - lastUserDataCheck.current < 10000) { // Within 10 seconds of last check
        userDataFailureCount.current++;
      } else {
        userDataFailureCount.current = 1; // Reset if checks are spread out
      }
      lastUserDataCheck.current = now;

      console.log(`UserData failure count: ${userDataFailureCount.current}`);

      // If userData consistently fails to load, likely invalid token situation
      // Increased threshold to 3 to allow for initial login flow delays
      if (userDataFailureCount.current >= 3) {
        console.error("UserData failed to load despite authenticated state. Session appears broken. Triggering logout...");
        logout('session_expired');
      }
    } else if (userData) {
      // Reset counter if userData loads successfully
      userDataFailureCount.current = 0;
    }
  }, [isAuthenticated, isLoading, userData, userDataLoading, logout]);

  // Show loading while Auth0 is determining authentication state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF00FF] mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated or email not verified
  if (!isAuthenticated || !user?.email_verified) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="min-h-screen bg-black">
      <RisqHeader />

      <div className="flex pt-[100px] lg:pt-[110px] xl:pt-[120px]">
        {/* Sidebar Navigation - hidden on mobile */}
        <aside className="hidden lg:block w-64 min-h-[calc(100vh-110px)] lg:min-h-[calc(100vh-120px)] border-r border-[#BF00FF]/20 bg-black/80 backdrop-blur-sm fixed">
          <MainNavigation className="py-4 px-2" />
        </aside>

        {/* Main Content Area - with sidebar margin on desktop */}
        <main className="flex-1 lg:ml-64 px-4 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
