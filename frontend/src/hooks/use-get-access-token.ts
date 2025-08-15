import { useAuth0 } from "@auth0/auth0-react"


export function useGetAccessTokenSilently(): () => Promise<string> {
  const { getAccessTokenSilently } = useAuth0()

  const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE;

  return async () => {
    return await getAccessTokenSilently({
      authorizationParams: {
        audience 
      }
    })
  }
}