import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useAuth0 } from "@auth0/auth0-react"

export function useFetch() {
  const { getAccessTokenSilently } = useAuth0()

  const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE;

  return async (url: string, options: RequestInit = {}) => {
    let accessToken = "";
    try {
      console.log("Attempting to get access token with audience:", audience);
      accessToken = await getAccessTokenSilently({
        authorizationParams: {
          audience
        }
      })
      console.log("Successfully got access token, length:", accessToken.length);
    } catch(error) {
      console.error("Failed to get Auth0 token:", (error as any).message.toString())
      console.error("Error details:", error);
      console.error("Audience used:", audience);
      // Return a mock 401 response instead of throwing
      return new Response(JSON.stringify({ error: "Authentication failed", details: (error as any).message }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "Content-Type": "application/json" }
      });
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

    const defaultHeaders = {
      ...csfrHeaderObject(),
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    };

    return fetch(`${serverUrl}${url}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: defaultHeaders,
      body: options.body
    });
  };
}
