import { useAuth } from "@/hooks/use-auth"
import { useFetch } from "@/hooks/use-fetch"
import { useQuery } from "@tanstack/react-query"


export default function HackRoles() {
  const userData = useAuth()
  const fetchWithAuth = useFetch()

  const hackRoles = useQuery({
    queryKey: ['hack-roles'],
    enabled: !!userData.data?.id,
    queryFn: async () => {
      const id = userData.data?.id
      const response = await fetchWithAuth(`/api/hack-roles/${id}`, {
        method: "GET"
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
