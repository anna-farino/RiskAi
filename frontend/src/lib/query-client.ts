import { csfrHeaderObject } from "@/utils/csrf-header";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  try {
    console.log(`API Request: ${method} ${url}`, data);
    
    const res = await fetch(url, {
      method,
      headers: data ? { 
        "Content-Type": "application/json",
        ...csfrHeaderObject()
      } : {
          ...csfrHeaderObject()
        },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    
    console.log(`API Response status: ${res.status} ${res.statusText}`);
    
    await throwIfResNotOk(res);
    
    // Handle empty responses (like 204 No Content from DELETE requests)
    const contentType = res.headers.get('content-type');
    if (res.status === 204 || !contentType?.includes('application/json')) {
      console.log("API Response: Empty response (no content)");
      return null as T;
    }
    
    const responseData = await res.json();
    console.log("API Response data:", responseData);
    return responseData;
  } catch (error) {
    console.error("API Request error:", error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Prevent automatic refetch on mount if data exists
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

