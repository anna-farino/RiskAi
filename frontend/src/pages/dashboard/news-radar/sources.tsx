import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Globe,
  ListChecks,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// JobInterval enum
enum JobInterval {
  FIFTEEN_MINUTES = 15 * 60 * 1000,
  HOURLY = 60 * 60 * 1000,
  FOUR_HOURS = 4 * 60 * 60 * 1000,
  TWICE_DAILY = 12 * 60 * 60 * 1000,
  DAILY = 24 * 60 * 60 * 1000,
  WEEKLY = 7 * 24 * 60 * 60 * 1000,
}

// Type definitions
interface AutoScrapeSettings {
  enabled: boolean;
  interval: JobInterval;
  lastRun?: string;
  nextRun?: string;
}

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [optimisticAutoScrapeEnabled, setOptimisticAutoScrapeEnabled] = useState<boolean | null>(null);
  const [optimisticAutoScrapeInterval, setOptimisticAutoScrapeInterval] = useState<JobInterval | null>(null);

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

  // Get auto-scrape settings
  const autoScrapeSettings = useQuery<AutoScrapeSettings>({
    queryKey: ["/api/news-tracker/settings/auto-scrape"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/news-tracker/settings/auto-scrape", {
          method: "GET",
        });
        if (!response.ok) throw new Error("Failed to fetch auto-update settings");
        const data = await response.json();
        return data || { enabled: false, interval: JobInterval.DAILY };
      } catch (error) {
        console.error(error);
        return { enabled: false, interval: JobInterval.DAILY };
      }
    },
    placeholderData: {
      enabled: false,
      interval: JobInterval.DAILY,
    },
  });

  // Sync optimistic state with server data
  useEffect(() => {
    if (autoScrapeSettings.data) {
      if (optimisticAutoScrapeEnabled === null) {
        setOptimisticAutoScrapeEnabled(autoScrapeSettings.data.enabled);
      }
      if (optimisticAutoScrapeInterval === null) {
        setOptimisticAutoScrapeInterval(autoScrapeSettings.data.interval);
      }
    }
  }, [autoScrapeSettings.data, optimisticAutoScrapeEnabled, optimisticAutoScrapeInterval]);

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

  // Update auto-scrape settings
  const updateAutoScrapeSettings = useMutation({
    mutationFn: async (settings: AutoScrapeSettings) => {
      const response = await fetchWithAuth("/api/news-tracker/settings/auto-scrape", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to update auto-scrape settings");
      }

      return response.json();
    },
    onMutate: async (newSettings) => {
      setOptimisticAutoScrapeEnabled(newSettings.enabled);
      setOptimisticAutoScrapeInterval(newSettings.interval);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/news-tracker/settings/auto-scrape"],
      });
      toast({
        title: "Settings updated",
        description: "Auto-scrape settings have been updated successfully.",
      });
    },
    onError: () => {
      setOptimisticAutoScrapeEnabled(null);
      setOptimisticAutoScrapeInterval(null);
      toast({
        title: "Error updating settings",
        description: "Failed to update auto-scrape settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get job status
  const autoScrapeStatus = useQuery({
    queryKey: ["/api/news-tracker/jobs/status"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/news-tracker/jobs/status", {
          method: "GET",
        });
        if (!response.ok) {
          console.warn("Job status API returned non-ok response:", response.status);
          return { running: false };
        }
        const data = await response.json();
        return data || { running: false };
      } catch (error) {
        console.error("Error fetching job status:", error);
        return { running: false };
      }
    },
    refetchInterval: 5000,
    initialData: { running: false },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const formatLastScraped = (date: string | null | undefined) => {
    if (!date) return "Never";
    const scraped = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - scraped.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

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

          {/* Toolbar Content */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* How To Section */}
            <div className="lg:col-span-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">How to Use Sources</span>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <p>• Configure auto-updates with intervals</p>
                  <p>• Add custom RSS feeds or news sites</p>
                  <p>• Use manual scan for immediate collection</p>
                  <p>• Filter articles with keyword management</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card
        className={cn(
          "bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden",
          "flex flex-col",
        )}
      >
        <CardHeader className="p-3 sm:p-4 lg:p-5 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-white">
              Available Sources
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {availableSources.data?.filter(s => s.isEnabled).length || 0} / {availableSources.data?.length || 0} enabled
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          {availableSources.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : availableSources.data && availableSources.data.length > 0 ? (
            <div className="space-y-3">
              {availableSources.data.map((source) => (
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
                      {source.lastScraped && (
                        <div className="text-xs text-slate-500 mt-1">
                          Last updated: {formatLastScraped(source.lastScraped)}
                        </div>
                      )}
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
        </CardContent>
      </Card>
    </div>
  );
}