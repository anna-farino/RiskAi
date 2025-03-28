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
            <h1> Welcome Home! </h1>
        }
      </div>
    </div>
  );
}
