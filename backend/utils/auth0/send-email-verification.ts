import { auth0_client_id, auth0_domain } from "./auth0-env";

type Args = {
  token: string,
  userId: string,
}
export async function sendEmailVerification({ token, userId }: Args) {
  try {
    const response = await fetch(`${auth0_domain}/api/v2/jobs/verification-email`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        "user_id": userId,
        "client_id": auth0_client_id,
      }),
    });

    if (!response.ok) {
        throw new Error('sendEmailVerification: Network response was not ok');
    }
    const data = await response.json();
    console.log("Email verification sent!", data);
  } catch (error) {
    console.error('Error sending reset password:', error);
  }
};
