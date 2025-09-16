import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Globe,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface GlobalSource {
  id: string;
  url: string;
  name: string;
  isEnabled: boolean;
  isGlobal: boolean;
  includeInAutoScrape?: boolean;
  lastScraped?: string | null;
}

export default function Sources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fetchWithAuth = useFetch();

  // Phase 4: Fetch available global sources with user's enabled status
  const availableSources = useQuery<GlobalSource[]>({
    queryKey: ["/api/news-tracker/sources/available"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth('/api/news-tracker/sources/available', {
          method: "GET",
        });
        if (!response.ok) throw new Error("Failed to fetch available sources");
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    placeholderData: [],
  });

  // Phase 4: Toggle source enabled/disabled
  const toggleSource = useMutation({
    mutationFn: async ({ sourceId, isEnabled }: { sourceId: string; isEnabled: boolean }) => {
      const response = await fetchWithAuth(`/api/news-tracker/sources/${sourceId}/toggle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isEnabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle source");
      }

      return response.json();
    },
    onMutate: async ({ sourceId, isEnabled }) => {
      // Optimistic update
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/sources/available"],
      });

      const previousSources = queryClient.getQueryData<GlobalSource[]>([
        "/api/news-tracker/sources/available",
      ]);

      queryClient.setQueryData<GlobalSource[]>(
        ["/api/news-tracker/sources/available"],
        (old = []) =>
          old.map((source) =>
            source.id === sourceId ? { ...source, isEnabled } : source
          )
      );

      return { previousSources };
    },
    onError: (err, variables, context) => {
      if (context?.previousSources) {
        queryClient.setQueryData(
          ["/api/news-tracker/sources/available"],
          context.previousSources
        );
      }
      toast({
        title: "Error toggling source",
        description: "Failed to update source status. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/sources/available"] });
      toast({
        title: "Source updated",
        description: "Source status has been updated successfully.",
      });
    },
  });

  return (
    <div
      className={cn(
        "flex flex-col pb-16 sm:pb-20 w-full min-w-0",
      )}
    >

      <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-white">
                News Sources
              </h1>
              <p className="text-sm text-slate-300">
                Manage news sources and control updates
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md overflow-hidden",
          "flex flex-col",
        )}
      >
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base lg:text-lg font-medium text-white">
                Source List
              </h2>
              <div className="text-xs sm:text-sm text-slate-400 bg-slate-800/70 pl-2 pr-2 pt-1 pb-1 rounded-full">
                {availableSources.data?.filter(s => s.isEnabled).length || 0} / {availableSources.data?.length || 0} enabled
              </div>
            </div>
        {availableSources.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          ) : availableSources.data && availableSources.data.length > 0 ? (
            <div className="space-y-3">
              {availableSources.data?.map((source) => (
                <div
                  key={source.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-all",
                    source.isEnabled
                      ? "bg-slate-800/50 border-[#BF00FF]/30"
                      : "bg-slate-900/50 border-slate-700/50 opacity-75"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Globe className={cn(
                      "h-5 w-5",
                      source.isEnabled ? "text-[#BF00FF]" : "text-slate-500"
                    )} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{source.name}</span>
                        {source.isGlobal && (
                          <Badge variant="secondary" className="text-xs">
                            Global
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-400 truncate">
                        {source.url}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={source.isEnabled}
                      onCheckedChange={(checked) => {
                        toggleSource.mutate({
                          sourceId: source.id,
                          isEnabled: checked,
                        });
                      }}
                      disabled={toggleSource.isPending}
                      className="data-[state=checked]:bg-[#BF00FF]"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              No sources available. Contact an administrator to add sources to the global pool.
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}