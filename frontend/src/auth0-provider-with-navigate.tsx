import { AppState, Auth0Provider } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { createContext, useContext, useState, useEffect } from "react";

// Development bypass context
const DevAuthContext = createContext<{
  isAuthenticated: boolean;
  user: any;
  loginWithRedirect: () => void;
  logout: () => void;
  isLoading: boolean;
  getAccessTokenSilently: () => Promise<string>;
} | null>(null);

// Development bypass provider
function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user] = useState({ sub: "dev-user", email: "dev@example.com", name: "Dev User" });
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-login for development
    setTimeout(() => {
      setIsAuthenticated(true);
      setIsLoading(false);
      navigate('/dashboard');
    }, 100);
  }, [navigate]);

  const value = {
    isAuthenticated,
    user: isAuthenticated ? user : undefined,
    loginWithRedirect: () => {
      setIsAuthenticated(true);
      navigate('/dashboard');
    },
    logout: () => {
      setIsAuthenticated(false);
      navigate('/');
    },
    isLoading,
    getAccessTokenSilently: async () => "dev-token"
  };

  return (
    <DevAuthContext.Provider value={value}>
      {children}
    </DevAuthContext.Provider>
  );
}

// Hook to use either dev auth or Auth0
export function useAuth() {
  const devAuth = useContext(DevAuthContext);
  const isDev = (import.meta as any).env.VITE_DEV_BYPASS_AUTH === 'true';
  
  if (isDev && devAuth) {
    return devAuth;
  }
  
  // This will use Auth0's useAuth0 when not in dev mode
  const { useAuth0 } = require("@auth0/auth0-react");
  return useAuth0();
}

type Props = {
  children: React.ReactNode
}
export default function Auth0ProviderWithNavigate({ children }: Props) {
  const navigate = useNavigate();
  
  // Initialize CSRF token on app load
  useEffect(() => {
    const initializeCsrfToken = async () => {
      try {
        // Check if we already have a CSRF token
        const existingToken = document.cookie
          .split("; ")
          .find((entry) => entry.startsWith("csrf-token="));
        
        if (!existingToken) {
          // Import serverUrl utility
          const { serverUrl } = await import('./utils/server-url');
          
          // Fetch CSRF token from server using proper URL
          const response = await fetch(`${serverUrl}/api/csrf-token`, {
            method: 'GET',
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[CSRF] Token initialized:', data.message);
          } else {
            console.error('[CSRF] Failed to get token, status:', response.status);
          }
        } else {
          console.log('[CSRF] Token already exists');
        }
      } catch (error) {
        console.error('[CSRF] Failed to initialize token:', error);
      }
    };
    
    initializeCsrfToken();
  }, []);
  
  // Check if we should bypass auth for development
  const isDev = (import.meta as any).env.VITE_DEV_BYPASS_AUTH === 'true';
  
  if (isDev) {
    console.log('🔧 Development mode: Auth bypass enabled');
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }

  let domain = (import.meta as any).env.VITE_AUTH0_DOMAIN;
  const clientId = (import.meta as any).env.VITE_AUTH0_CLIENT_ID;
  const redirectUri = (import.meta as any).env.VITE_AUTH0_CALLBACK_URL || window.location.origin + '/auth/login';
  const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE;

  // Fix domain if it has https:// prefix
  if (domain && domain.startsWith('https://')) {
    domain = domain.replace('https://', '');
  }

  const onRedirectCallback = (appState: AppState | undefined) => {
    navigate('dashboard')
    //navigate(appState?.returnTo || window.location.origin);
  };

  if (!(domain && clientId && redirectUri && audience)) {
    console.error('Auth0 configuration missing:', { domain, clientId, redirectUri, audience });
    return null;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: audience,
      }}
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      useRefreshTokensFallback={false}
    >
      {children}
    </Auth0Provider>
  );
};
