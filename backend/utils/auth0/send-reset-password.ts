import { auth0_client_id, auth0_domain } from "./auth0-env";

type Args = {
  token: string,
  email: string,
}
export async function sendResetPasswordLink({ token, email }: Args): Promise<boolean> {
  try {
    const response = await fetch(`${auth0_domain}/dbconnections/change_password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        "email": email,
        "client_id": auth0_client_id,
        "connection": "Username-Password-Authentication"
      }),
    });

    if (!response.ok) {
      console.error("Error: ", response)
      throw new Error('sendResetPasswordLink: Network response was not ok');
    }
    console.log("Email to reset password sent!", response);
    return true
  } catch (error) {
    console.error('Error sending reset password:', error);
    return false
  }
};
