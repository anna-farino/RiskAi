import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { serverUrl } from '@/utils/server-url';

interface LiveLogsPermissionState {
  available: boolean;
  hasPermission: boolean;
  loading: boolean;
  error: string | null;
}

export function useLiveLogsPermission(): LiveLogsPermissionState {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth0();
  const [state, setState] = useState<LiveLogsPermissionState>({
    available: false,
    hasPermission: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    const checkPermission = async () => {
      // Check if feature is enabled via environment variable
      if (import.meta.env.VITE_ENV !== 'development' && import.meta.env.VITE_ENV !== 'staging') {
        setState({
          available: false,
          hasPermission: false,
          loading: false,
          error: null
        });
        return;
      }

      // Wait for Auth0 to finish loading
      if (authLoading) {
        return;
      }

      // Check if user is authenticated
      if (!isAuthenticated || !user?.email) {
        setState({
          available: false,
          hasPermission: false,
          loading: false,
          error: 'Not authenticated'
        });
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        const response = await fetch(`${serverUrl}/api/live-logs-management/check-permission`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: user.email })
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
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Error checking live logs permission:', error);
        setState({
          available: false,
          hasPermission: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    checkPermission();
  }, [isAuthenticated, authLoading, user?.email]);

  return state;
<<<<<<< HEAD
}
=======
}
>>>>>>> origin/dev
