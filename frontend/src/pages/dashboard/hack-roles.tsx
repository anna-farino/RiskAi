import { useAuth } from "@/hooks/use-auth"
import { csfrHeaderObject } from "@/utils/csrf-header"
import { serverUrl } from "@/utils/server-url"
import { useQuery } from "@tanstack/react-query"


export default function HackRoles() {
  const userData = useAuth()

  const hackRoles = useQuery({
    queryKey: ['hack-roles'],
    enabled: !!userData.data?.id,
    queryFn: async () => {
      const id = userData.data?.id
      const response = await fetch(serverUrl + `/api/hack-roles/${id}`, {
        credentials: "include",
        headers: {
          ...csfrHeaderObject()
        }
      })
      if (!response.ok) throw new Error("Ooops! An error occurred!")
      return await response.json()
    }
  })

  return (
    <div className="flex flex-col gap-y-10">
      <h1>Hacked roles:</h1>
      {Array.isArray(hackRoles.data) && hackRoles.data.map((role,i) => (
        <h1 key={i}>{JSON.stringify(role)}</h1>
      ))}
    </div>
  )
}
