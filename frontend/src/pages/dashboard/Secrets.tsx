import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { csfrHeaderObject } from "@/utils/csrf-header"
import { serverUrl } from "@/utils/server-url"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Secret } from "jsonwebtoken"
import { useForm } from "react-hook-form"


export default function Secrets() {

  const form = useForm()

  const secrets = useQuery({
    queryKey: ['secrets'],
    queryFn: async () => {
      const response = await fetch(serverUrl + '/api/secrets', {
        method: 'GET',
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject()
        },
      })
      return response.json()
    }
  })
  const encryptedSecrets = useQuery({
    queryKey: ['encryptedSecrets'],
    queryFn: async () => {
      const response = await fetch(serverUrl + '/api/e-secrets', {
        method: 'GET',
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject()
        },
      })
      return response.json()
    }
  })

  const insertSecrets = useMutation({
    mutationFn: (newSecret) => {
      return fetch(serverUrl + '/api/secrets', {
        method: 'POST',
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject()
        },
        body: JSON.stringify({
          secret: newSecret 
        })
      })
    },
    onSuccess() {
      secrets.refetch()
      encryptedSecrets.refetch()
    },
  })

  const deleteSecrets = useMutation({
    mutationFn: () => {
      return fetch(serverUrl + '/api/secrets', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject()
        }
      })
    },
    onSuccess() {
      secrets.refetch()
      encryptedSecrets.refetch()
    }
  })

  const handleSubmit = form.handleSubmit((data) => {
    insertSecrets.mutate(data.secret)
    form.reset()
  })

  console.log(secrets.data)
  return (
    <div className="flex flex-col w-full h-full gap-y-10">
      <h1 className="text-xl font-semibold">Secrets!</h1>
      <form 
        onSubmit={handleSubmit}
        className="flex flex-col gap-y-4"
      >
        <Input
          className="max-w-[400px]"
          {...form.register("secret")}
        />
        <Button type="submit" className="max-w-40">
          Confirm
        </Button>
        <Button 
          type="button"
          variant="destructive"
          className="max-w-40"
          onClick={()=>deleteSecrets.mutate()}
        >
          Delete all
        </Button>
      </form>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          {encryptedSecrets.data?.secrets && encryptedSecrets.data.secrets.map((s: any, i: number) => (
            <h1 key={s.ciphertext}>{i+1}. {s.ciphertext}</h1>
          ))}
        </div>
        <div className="flex flex-col">
          {secrets.data?.secrets && secrets.data.secrets.map((s: any, i: number) => (
            <h1 key={s}>{i+1}. {s}</h1>
          ))}
        </div>
      </div>
    </div>
  )
}
