import { auth0_client_id, auth0_client_secret, auth0_domain } from "./auth0-env";

export async function getToken(): Promise<string> {
  let token: string;
  try {
      const response = await fetch(`${auth0_domain}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          "client_id": auth0_client_id,
          "client_secret": auth0_client_secret,
          "audience": `${auth0_domain}/api/v2/`,
          "grant_type":"client_credentials"
        }),
      });

      if (!response.ok) {
        console.log("getToken response not ok", response)
          throw new Error('Get token: Network response was not ok');
      }
      const data = await response.json();
      token = data.access_token

      if (!token) throw new Error("No token retrieved!")
      else console.log("Auth0 token successfully retrieved");
  } catch (error) {
      console.error('Error fetching token:', error);
  }
  return token
};
