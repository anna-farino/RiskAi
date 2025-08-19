import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Shield,
  Clock,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
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
  isDefault?: boolean;
  includeInAutoScrape?: boolean;
  lastScraped?: string | null;
}

export default function ThreatSources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fetchWithAuth = useFetch();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [optimisticAutoScrapeEnabled, setOptimisticAutoScrapeEnabled] = useState<boolean | null>(null);
  const [optimisticAutoScrapeInterval, setOptimisticAutoScrapeInterval] = useState<JobInterval | null>(null);

  // Phase 4: Fetch available global sources with user's enabled status
  const availableSources = useQuery<GlobalSource[]>({
    queryKey: ["/api/threat-tracker/sources/available"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth('/api/threat-tracker/sources/available', {
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
    queryKey: ["/api/threat-tracker/settings/auto-scrape"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/settings/auto-scrape", {
          method: "GET",
        });
        if (!response.ok) throw new Error("Failed to fetch auto-scrape settings");
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
      const response = await fetchWithAuth(`/api/threat-tracker/sources/${sourceId}/toggle`, {
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
        queryKey: ["/api/threat-tracker/sources/available"],
      });

      const previousSources = queryClient.getQueryData<GlobalSource[]>([
        "/api/threat-tracker/sources/available",
      ]);

      queryClient.setQueryData<GlobalSource[]>(
        ["/api/threat-tracker/sources/available"],
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
          ["/api/threat-tracker/sources/available"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/threat-tracker/sources/available"] });
      toast({
        title: "Source updated",
        description: "Source status has been updated successfully.",
      });
    },
  });

  // Update auto-scrape settings
  const updateAutoScrapeSettings = useMutation({
    mutationFn: async (settings: AutoScrapeSettings) => {
      const response = await fetchWithAuth("/api/threat-tracker/settings/auto-scrape", {
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
        queryKey: ["/api/threat-tracker/settings/auto-scrape"],
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
    queryKey: ["/api/threat-tracker/jobs/status"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/jobs/status", {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Threat Sources</h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">
            Enable or disable cybersecurity threat intelligence sources
          </p>
        </div>
      </div>

      {/* Auto-Scrape Settings Card */}
      <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-white">
              Auto-Scan Settings
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="text-slate-400 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-scrape" className="text-base font-medium text-white">
                Auto-Scan {autoScrapeStatus.data?.running && "(Running)"}
              </Label>
              <p className="text-sm text-slate-400">
                Automatically scan for security threats from enabled sources
              </p>
            </div>
            <Switch
              id="auto-scrape"
              checked={optimisticAutoScrapeEnabled ?? autoScrapeSettings.data?.enabled ?? false}
              onCheckedChange={(checked) => {
                const currentInterval = optimisticAutoScrapeInterval ?? 
                  autoScrapeSettings.data?.interval ?? JobInterval.DAILY;
                updateAutoScrapeSettings.mutate({
                  enabled: checked,
                  interval: currentInterval,
                });
              }}
              className="data-[state=checked]:bg-[#BF00FF]"
            />
          </div>

          <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <CollapsibleContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {Object.entries({
                  [JobInterval.HOURLY]: "Hourly",
                  [JobInterval.FOUR_HOURS]: "Every 4 Hours",
                  [JobInterval.DAILY]: "Daily",
                }).map(([interval, label]) => (
                  <Button
                    key={interval}
                    variant={(optimisticAutoScrapeInterval ?? autoScrapeSettings.data?.interval) === Number(interval) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const currentEnabled = optimisticAutoScrapeEnabled ?? autoScrapeSettings.data?.enabled ?? false;
                      updateAutoScrapeSettings.mutate({
                        enabled: currentEnabled,
                        interval: Number(interval) as JobInterval,
                      });
                    }}
                    disabled={!(optimisticAutoScrapeEnabled ?? autoScrapeSettings.data?.enabled) || updateAutoScrapeSettings.isPending}
                    className="text-white"
                  >
                    {updateAutoScrapeSettings.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {label}
                  </Button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Available Sources */}
      <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-white">
              Available Threat Intelligence Sources
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
                    <Shield className={cn(
                      "h-5 w-5",
                      source.isEnabled ? "text-[#BF00FF]" : "text-slate-500"
                    )} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{source.name}</span>
                        {source.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
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
                          Last scanned: {formatLastScraped(source.lastScraped)}
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
              No threat sources available. Contact an administrator to add sources to the global pool.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}