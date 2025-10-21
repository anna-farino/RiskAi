type Args={
  userId: string,
  token: string
}
type Output={
  userId: string,
  status: number
}

export default async function deleteUser({ userId, token }: Args): Promise<Output> {
  const baseUrl = 'https://dev-t5wd7j8putzpb6ev.us.auth0.com/api/v2/users/'
  const params = `:${userId}` 
  const url = baseUrl + "?" + params 

  const result = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (result.status === 429) throw new Error("Rate limit hit");

  if (!result.ok) {
    const errorData = await result.json()
    throw new Error(errorData.message || "Failed to fetch users" )
  }

  return { userId, status: result.status}
}

