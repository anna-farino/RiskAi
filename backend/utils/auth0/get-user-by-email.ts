import { auth0_domain } from "./auth0-env";

type Args = {
  token: string
  email: string
}
export async function getUserByEmail({ token, email }: Args): Promise<Record<string,string> | null> {
  console.log("Getting user by email")
  let userInfo: Record<string,string> | null = null;
  try {
      const response = await fetch(`${auth0_domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
          console.error("getUserByEmail: response not ok =>", response)
          throw new Error('Get user by email: Network response was not ok');
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        userInfo = data[0]
      }
      console.log("User successfully retrieved: ", userInfo);
  } catch (error) {
      console.error('Error fetching userInfo:', error);
  }
  return userInfo
};
