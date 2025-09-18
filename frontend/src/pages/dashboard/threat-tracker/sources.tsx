import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Shield,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className={cn("flex flex-col pb-16 sm:pb-20 w-full min-w-0")}>
      <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-white">
                Threat Sources
              </h1>
              <p className="text-sm text-slate-300">
                Manage sources for threat monitoring and auto-update settings
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Sources card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#BF00FF]" />
              Sources
            </CardTitle>
            <CardDescription>
              Websites to monitor for security threat information.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
      {/* Available Sources */}
      <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-white">
              Available Threat Intelligence Sources
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {availableSources.data?.filter((s) => s.isEnabled).length || 0} /{" "}
              {availableSources.data?.length || 0} enabled
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
                      : "bg-slate-900/50 border-slate-700/50 opacity-75",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Shield
                      className={cn(
                        "h-5 w-5",
                        source.isEnabled ? "text-[#BF00FF]" : "text-slate-500",
                      )}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {source.name}
                        </span>
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
              No threat sources available. Contact an administrator to add
              sources to the global pool.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}