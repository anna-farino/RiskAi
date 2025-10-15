import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useAuth0 } from "@auth0/auth0-react"
import { useLogout } from "@/hooks/use-logout";
import { useRef } from "react";
import { validateTokenFormat, checkStoredTokenHealth, clearCorruptedTokens } from "@/utils/token-validation";

export function useFetch() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0()
  const { logout } = useLogout();
  const tokenFailureCount = useRef(0);
  const lastTokenFailure = useRef<number>(0);
  const isRefreshing = useRef(false);

  const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE;

  const getTokenWithRetry = async (retryCount = 0): Promise<string> => {
    const maxRetries = 2;

    // Only check for corrupted tokens if we've already had failures
    // This prevents checking during initial login flow
    if (tokenFailureCount.current > 0) {
      const tokenHealth = checkStoredTokenHealth();
      if (tokenHealth.hasTokens && tokenHealth.accessTokenHealth?.isCorrupted) {
        console.error("Corrupted tokens detected in localStorage after failures:", tokenHealth.accessTokenHealth.error);
        clearCorruptedTokens();

        // Trigger immediate logout for corrupted tokens
        setTimeout(() => {
          logout('corrupted_tokens');
        }, 100);

        throw new Error("Corrupted tokens detected and cleared");
      }
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience
        },
        // Force refresh on retry attempts
        cacheMode: retryCount > 0 ? 'off' : 'cache-only'
      });

      // Validate the token we just received
      const validation = validateTokenFormat(token);
      if (validation.isCorrupted) {
        console.error("Auth0 returned a corrupted token:", validation.error);
        throw new Error(`Corrupted token received: ${validation.error}`);
      }

      if (validation.isExpired) {
        console.log("Auth0 returned an expired token, will retry...");
        throw new Error(`Expired token received: ${validation.error}`);
      }

      // Reset failure count on successful token retrieval
      tokenFailureCount.current = 0;
      return token;
    } catch (error) {
      console.log(`Token retrieval attempt ${retryCount + 1} failed:`, error);

      // Try to refresh token if we haven't exceeded max retries
      if (retryCount < maxRetries && !isRefreshing.current) {
        isRefreshing.current = true;

        try {
          console.log("Attempting token refresh...");
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay

          const refreshedToken = await getAccessTokenSilently({
            authorizationParams: {
              audience
            },
            cacheMode: 'off' // Force fresh token
          });

          isRefreshing.current = false;
          tokenFailureCount.current = 0;
          console.log("Token refresh successful");
          return refreshedToken;
        } catch (refreshError) {
          isRefreshing.current = false;
          console.log("Token refresh failed:", refreshError);

          // If refresh failed, try one more time with standard call
          if (retryCount + 1 < maxRetries) {
            return getTokenWithRetry(retryCount + 1);
          }

          throw refreshError;
        }
      }

      throw error;
    }
  };

  return async (url: string, options: RequestInit = {}) => {
    let accessToken = "";
    try {
      accessToken = await getTokenWithRetry();
    } catch(error) {
      console.error("Failed to get Auth0 token:", (error as any).message?.toString() || error)
      console.error("Error details:", error);
      console.error("Audience used:", audience);

      // Track consecutive token failures
      const now = Date.now();
      if (now - lastTokenFailure.current < 5000) { // Within 5 seconds of last failure
        tokenFailureCount.current++;
      } else {
        tokenFailureCount.current = 1; // Reset if failures are spread out
      }
      lastTokenFailure.current = now;

      console.log(`Token failure count: ${tokenFailureCount.current}`);

      // Auto-logout if we have 3+ consecutive failures within 5 seconds
      if (tokenFailureCount.current >= 3 && isAuthenticated) {
        console.error("Multiple consecutive token failures detected. Session appears broken. Triggering logout...");
        setTimeout(() => {
          logout('session_expired');
        }, 100); // Small delay to allow current request to complete
      }

      // For invalid/corrupted tokens, trigger immediate logout after first failure
      // This handles cases where localStorage tokens are manually modified
      if ((error as any).message?.includes('invalid') ||
          (error as any).message?.includes('malformed') ||
          (error as any).message?.includes('expired')) {
        console.error("Invalid or corrupted token detected. Triggering immediate logout...");
        setTimeout(() => {
          logout('corrupted_tokens');
        }, 100);
      }

      // Return a mock 401 response instead of throwing to prevent unhandled rejection
      const errorResponse = new Response(JSON.stringify({
        error: "Authentication failed",
        details: (error as any).message || "Unknown auth error"
      }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "Content-Type": "application/json" }
      });
      return Promise.resolve(errorResponse);
    }

    // Only proceed if we have a valid token
    if (!accessToken) {
      console.error("No access token received from Auth0")
      // Return a mock 401 response instead of throwing
      return new Response(JSON.stringify({ error: "No access token" }), {
        status: 401,
        statusText: "Unauthorized", 
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check if body is FormData - if so, don't set Content-Type header
    const isFormData = options.body instanceof FormData;
    
    const defaultHeaders: any = {
      ...csfrHeaderObject(),
      Authorization: `Bearer ${accessToken}`
    };

    // Only set Content-Type if it's not FormData
    if (!isFormData && options.headers) {
      Object.assign(defaultHeaders, options.headers);
    } else if (!isFormData) {
      // For non-FormData requests, keep any provided headers
      Object.assign(defaultHeaders, options.headers || {});
    }

    return fetch(`${serverUrl}${url}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: defaultHeaders,
      body: options.body
    });
  };
}
