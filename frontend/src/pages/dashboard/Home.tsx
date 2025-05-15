import { useAuth } from "@/hooks/use-auth";
import { useAuthCheck } from "@/hooks/use-auth-check";
import { serverUrl } from "@/utils/server-url";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isLoading: authLoading, isError } = useAuthCheck();
  const user = useAuth()

  const testArticles = useQuery({
    queryKey: ['test'],
    queryFn: async () => {
      const response = await fetch(serverUrl + '/api/test-articles', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user: user.data?.id 
        })
      })
      const data = await response.json()
      return data
    },
    enabled: !!user.data?.id
  })

  console.log(user.data?.id)


  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return null;
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">
          Home
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {authLoading ? (
          <div className="col-span-full flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) :  
          <>
            <h1> Welcome Home! </h1>
            {testArticles.data && testArticles.data.articles &&
              testArticles.data.articles.map((article: any)=>(
                <h1>{article.userId}</h1>
              ))
            }
          </>
        }
      </div>
    </div>
  );
}
