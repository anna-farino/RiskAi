import { auth0_domain } from "./auth0-env";

type Args = {
  userId: string,
  newStatus: boolean
  token: string
}
export async function setMfa({ userId, newStatus, token }: Args): Promise<boolean> {
  try {
    const response = await fetch(`${auth0_domain}/api/v2/users/${userId}`, {
      method: 'PATCH',
      headers: { 
        'content-type': 'application/json',
        'accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_metadata: {
          mfa_enabled: newStatus
        }
      }),
    });
    if (!response.ok) {
      console.log("Error while updating MFA: ", response)
      throw new Error('Failed to update MFA');
    }
    return true
  } catch (error) {
    console.error('Error updating MFA:', error);
    return false
  }
};
