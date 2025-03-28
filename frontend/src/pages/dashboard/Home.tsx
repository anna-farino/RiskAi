import { useAuthCheck } from "@/hooks/use-auth-check";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const serverUrl = (import.meta as any).env.VITE_SERVER_URL_DEV;

interface Action {
  id: string;
  softwareId: string;
  vulnerabilityId: string;
  title: string;
  recommendation: string;
  severity: string;
  createdAt: string;
  software?: {
    name: string;
    vendor: string;
    version: string;
  };
}

export default function Home() {
  const { isLoading: authLoading, isError } = useAuthCheck();

  const { data: actions, isLoading, isFetching } = useQuery<Action[]>({
    queryKey: ["/api/actions"],
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 0,
    queryFn: async () => {
      const response = await fetch(`${serverUrl}/api/actions`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch actions');
      return response.json();
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "CRITICAL":
        return "text-red-500";
      case "HIGH":
        return "text-orange-500";
      case "MEDIUM":
        return "text-yellow-500";
      case "LOW":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

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
          Reccomended Actions
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading || isFetching ? (
          <div className="col-span-full flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !actions?.length ? (
          <div className="col-span-full text-center text-muted-foreground">
            No vulnerability actions found. Click the analyze button to check for potential issues.
          </div>
        ) : (
          actions.map((action) => (
            <Card key={action.id} className="hover:bg-muted/50">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {action.title}
                  </CardTitle>
                  <span className={`font-semibold ${getSeverityColor(action.severity)}`}>
                    {action.severity}
                  </span>
                </div>
                <CardDescription>
                  Created at: {new Date(action.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {action.software && (
                  <div className="mb-4 p-3 bg-background/50 rounded-lg border">
                    <p className="text-sm font-medium">Affected Software:</p>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm">{action.software.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {action.software.vendor} (v{action.software.version})
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">
                  {action.recommendation}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
