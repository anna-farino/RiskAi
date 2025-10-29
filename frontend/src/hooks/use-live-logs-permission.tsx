import { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { serverUrl } from '@/utils/server-url';

interface LiveLogsPermissionState {
  available: boolean;
  hasPermission: boolean;
  loading: boolean;
  error: string | null;
}

export function useLiveLogsPermission(): LiveLogsPermissionState {
  const { isAuthenticated, isLoading: authLoading, getAccessTokenSilently } = useAuth0();
  const [state, setState] = useState<LiveLogsPermissionState>({
    available: false,
    hasPermission: false,
    loading: true,
    error: null
  });
  
  const hasCheckedRef = useRef(false); // Prevent duplicate checks

  useEffect(() => {
    // Prevent duplicate permission checks
    if (hasCheckedRef.current) {
      return;
    }

    const checkPermission = async () => {
      console.log("VITE_ENV=", (import.meta as any).env.VITE_ENV)
      // Check if feature is enabled via environment variable
      if ((import.meta as any).env.VITE_ENV !== 'development' && (import.meta as any).env.VITE_ENV !== 'staging') {
        setState({
          available: false,
          hasPermission: false,
          loading: false,
          error: null
        });
        hasCheckedRef.current = true;
        return;
      }

      // Wait for Auth0 to finish loading
      if (authLoading) {
        return;
      }

      // Check if user is authenticated
      if (!isAuthenticated) {
        setState({
          available: false,
          hasPermission: false,
          loading: false,
          error: 'Not authenticated'
        });
        hasCheckedRef.current = true;
        return;
      }

      try {
        hasCheckedRef.current = true; // Mark as checked before making request
        setState(prev => ({ ...prev, loading: true, error: null }));

        // Get JWT token
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: (import.meta as any).env.VITE_AUTH0_AUDIENCE
          }
        });

        // Send permission check request with JWT token
        // The backend will extract userId from the token
        const response = await fetch(`${serverUrl}/api/live-logs-management/check-permission`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({}) // No need to send email/userId - extracted from JWT
        });

        if (response.ok) {
          const data = await response.json();
          setState({
            available: true,
            hasPermission: data.hasPermission,
            loading: false,
            error: null
          });
        } else if (response.status === 404) {
          // Service not available (probably production environment)
          setState({
            available: false,
            hasPermission: false,
            loading: false,
            error: null
          });
        } else if (response.status === 401 || response.status === 403) {
          // Not authorized
          setState({
            available: true,
            hasPermission: false,
            loading: false,
            error: null
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('[useLiveLogsPermission] Error checking permission:', error);
        setState({
          available: false,
          hasPermission: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    checkPermission();
  }, [isAuthenticated, authLoading, getAccessTokenSilently]);

  return state;
}
