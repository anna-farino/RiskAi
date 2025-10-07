import { auth0_domain } from "./auth0-env";

type Args = {
  userId: string,
  token: string
}
export async function readMfa({ userId, token }: Args): Promise<boolean | 'not_found'> {
  const queryParams = 'fields=user_metadata&include_fields=true'
  try {
    const response = await fetch(`${auth0_domain}/api/v2/users/${userId}?${queryParams}`, {
      method: 'GET',
      headers: { 
        'accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    if (!response.ok) {
      console.log("Error while updating MFA: ", response)
      throw new Error('Failed to update MFA');
    }
    const data = await response.json() // as { mfa_enabled: boolean }
    console.log("Response: ", data)
    const mfaStatus = data.user_metadata.mfa_enabled
    console.log("mfaStatus", mfaStatus)
    return mfaStatus
  } catch (error) {
    console.error('Error updating MFA:', error);
    return 'not_found'
  }
};
