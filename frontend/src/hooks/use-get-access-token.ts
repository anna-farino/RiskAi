import { useAuth0 } from "@auth0/auth0-react"


export function useGetAccessTokenSilently(): () => Promise<string> {
  const { getAccessTokenSilently } = useAuth0()

  return async () => {
    return await getAccessTokenSilently({
      authorizationParams: {
        audience: 'http://localhost:5002'
      }
    })
  }
}
