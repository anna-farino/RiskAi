
type UserInfo = {
  email: string,
  last_login: string
}
type Args={
  organizationId: string,
  token: string
}

export default async function getUsersInfo({ organizationId, token }: Args): Promise<UserInfo[]> {
  const baseUrl = 'https://dev-t5wd7j8putzpb6ev.us.auth0.com/api/v2/users'
  const params = `fields=email,last_login&q=app_metadata.organizationId:${organizationId}` 
  const url = baseUrl + "?" + params 

  const result = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })

  if (!result.ok) {
    const errorData = await result.json()
    throw new Error(errorData.message || "Failed to fetch users" )
  }

  const users = result.json()

  return users
}

