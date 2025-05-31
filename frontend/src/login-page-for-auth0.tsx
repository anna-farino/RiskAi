import { useAuth0 } from "@auth0/auth0-react";
import { useQuery } from "@tanstack/react-query";
import { serverUrl } from "./utils/server-url";


export default function LoginPageForAuth0() {

  const { loginWithRedirect, logout, loginWithPopup, isAuthenticated, user, getAccessTokenSilently } = useAuth0()

  async function handleLogin() {
    await loginWithRedirect({
      authorizationParams: {
        audience: 'http://localhost:5002'
      },
      appState: {
        returnTo: 'http://localhost:5174/login',
      },
    });
  };
  async function handleLogout() {
    await logout({
      logoutParams: {
        returnTo: 'http://localhost:5174/login',
      }
    })
  }

  const data = useQuery({
    enabled: !!isAuthenticated,
    queryKey: ['test'],
    queryFn: async () => {
      console.log("Fetching stuff..")
      let accessToken= "";
      try {
        accessToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: 'http://localhost:5002',
            //scope: 'read:settings write:settings'
          }
        })
      } catch(error) {
        console.error((error as any).message.toString())
        if (false && (error as any).message.toString() === "Consent required") {
          loginWithPopup({
            authorizationParams: {
              audience: 'http://localhost:5002',
              scope: 'read:settings write:settings',
              prompt: "consent", // Explicitly request consent
            },
          });
        }
      }
      //console.log("accessToken", accessToken)
      const response = await fetch(serverUrl + '/api/auth0test', {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          Authorization: 'Bearer ' + accessToken
        }
      })
      const finalData = await response.json()
      console.log("final data", finalData)
      return finalData
    }
  })
  console.log("is authenticated:", isAuthenticated, user)



  return (
    <div className="flex flex-row w-full gap-4 p-10 bg-blue-800">
      <button
        className='border border-foreground hover:bg-foreground/10 cursor-pointer'
        onClick={handleLogin}
      >
        Login auth0
      </button>
      <button
        className='border border-foreground hover:bg-foreground/10 cursor-pointer'
        onClick={handleLogout}
      >
        Logout auth0
      </button>
      <button
        className='border border-foreground hover:bg-foreground/10 cursor-pointer'
        onClick={() => data.refetch()}
      >
        Fetch data
      </button>
      <h1>
        {data && <pre>{JSON.stringify(data.data)}</pre>}
      </h1>
    </div>
  )
}
