import { auth0_domain } from "../auth0-env";

type Args = {
  email: string,
  password: string
  token: string
}
export async function createUser({ email, password, token }: Args): Promise<boolean> {
  const response = await fetch(`${auth0_domain}/api/v2/users`, {
    method: 'POST',
    headers: { 
      'content-type': 'application/json',
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      email,
      password,
      connection: "Username-Password-Authentication"
    }),
  });
  if (!response.ok) {
    const errorData = await response.json()
    console.log("Error while creating user: ", errorData)
    return false
  }
  return true
};
