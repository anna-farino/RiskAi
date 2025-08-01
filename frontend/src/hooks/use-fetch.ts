import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
import { useAuth0 } from "@auth0/auth0-react"

export function useFetch() {
  const { getAccessTokenSilently } = useAuth0()

  const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE;

  return async (url: string, options: RequestInit = {}) => {
    let accessToken= "";
    try {
      accessToken = await getAccessTokenSilently({
        authorizationParams: {
          audience
        }
      })
    } catch(error) {
      console.error((error as any).message.toString())
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
