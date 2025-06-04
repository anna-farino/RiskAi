import { csfrHeaderObject } from "@/utils/csrf-header";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData;
    try {
      // Try to parse JSON error response first
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await res.json();
      } else {
        errorData = { message: await res.text() || res.statusText };
      }
    } catch {
      errorData = { message: res.statusText };
    }
    
    // Create error with parsed data attached
    const error = new Error(`${res.status}: ${errorData.message || errorData.error || res.statusText}`);
    (error as any).data = errorData;
    (error as any).status = res.status;
    throw error;
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
    
    // Check if response has content before parsing JSON
    const contentLength = res.headers.get('content-length');
    const contentType = res.headers.get('content-type');
    
    if (res.status === 204 || contentLength === '0' || !contentType?.includes('application/json')) {
      console.log("API Response: Empty response (no content)");
      return {} as T;
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

