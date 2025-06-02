import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { Source, insertSourceSchema } from "@shared/db/schema/news-tracker/index";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Link2, Globe, Plus, RotateCw, Check, X, Clock, Settings, Play, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { cn } from "@/lib/utils";
import { DeleteAlertDialog } from "@/components/delete-alert-dialog";

// Define the JobInterval enum matching the server-side enum
enum JobInterval {
  FIFTEEN_MINUTES = 15 * 60 * 1000,
  HOURLY = 60 * 60 * 1000,
  FOUR_HOURS = 4 * 60 * 60 * 1000,
  TWICE_DAILY = 12 * 60 * 60 * 1000,
  DAILY = 24 * 60 * 60 * 1000,
  WEEKLY = 7 * 24 * 60 * 60 * 1000
}

// Convert enum to human-readable labels
const intervalLabels: Record<JobInterval, string> = {
  [JobInterval.FIFTEEN_MINUTES]: "Every 15 Minutes",
  [JobInterval.HOURLY]: "Hourly",
  [JobInterval.FOUR_HOURS]: "Every 4 Hours",
  [JobInterval.TWICE_DAILY]: "Twice Daily",
  [JobInterval.DAILY]: "Daily", 
  [JobInterval.WEEKLY]: "Weekly"
};

// Type definition for auto scrape settings
interface AutoScrapeSettings {
  enabled: boolean;
  interval: JobInterval;
  lastRun?: string;
  nextRun?: string;
}

export default function Sources() {
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null);
  
  // Local state for optimistic UI updates
  const [localSources, setLocalSources] = useState<Source[]>([]);
  // Track pending operations for visual feedback
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  
  // Get job status
  const autoScrapeStatus = useQuery({
    queryKey: ["/api/news-tracker/jobs/status"],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/jobs/status`, {
          method: 'GET',
          credentials: 'include',
          headers: csfrHeaderObject()
        });
        if (!response.ok) throw new Error('Failed to fetch job status');
        const data = await response.json();
        return data;
      } catch(error) {
        console.error("Error fetching job status:", error);
        return { running: false };
      }
    },
    refetchInterval: 5000, // Poll every 5 seconds
    // Add initial data to prevent undefined state
    initialData: { running: false }
  });
  
  const form = useForm({
    resolver: zodResolver(insertSourceSchema),
    defaultValues: {
      url: "",
      name: "",
    },
  });

  const sources = useQuery<Source[]>({
    queryKey: ["/api/news-tracker/sources"],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/sources`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        })
        if (!response.ok) throw new Error('Failed to fetch sources')
        
        const data = await response.json()
        return data || []
      } catch(error) {
        console.error(error)
        return [] // Return empty array instead of undefined to prevent errors
      }
    }
  });
  
  // Sync local state with query data when it changes
  useEffect(() => {
    if (sources.data) {
      setLocalSources(sources.data);
    }
  }, [sources.data]);
  
  // Get auto-scrape settings
  const autoScrapeSettings = useQuery<AutoScrapeSettings>({
    queryKey: ["/api/news-tracker/settings/auto-scrape"],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/settings/auto-scrape`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        })
        if (!response.ok) throw new Error('Failed to fetch auto-scrape settings')
        
        const data = await response.json()
        return data || { enabled: false, interval: JobInterval.DAILY }
      } catch(error) {
        console.error(error)
        // Return default settings instead of undefined to prevent errors
        return { enabled: false, interval: JobInterval.DAILY }
      }
    },
    placeholderData: { 
      enabled: false, 
      interval: JobInterval.DAILY 
    }
  });

  const addSource = useMutation({
    mutationFn: async (data: { url: string; name: string }) => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/sources`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...csfrHeaderObject()
          },
          body: JSON.stringify(data),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to add source: ${response.statusText}`);
        }
        
        // Parse JSON response
        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error("Add source error:", error);
        throw error;
      }
    },
    onMutate: async (newSource) => {
      // Create a temporary optimistic source with unique ID for tracking
      const tempId = `temp-${Date.now()}`;
      const tempSource = {
        id: tempId,
        url: newSource.url,
        name: newSource.name,
        active: false,
        includeInAutoScrape: false,
        scrapingConfig: {},
        lastScraped: null,
        userId: null
      } as Source;
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/sources"] });
      
      // Snapshot the previous states for potential rollback
      const previousSources = queryClient.getQueryData<Source[]>(["/api/news-tracker/sources"]);
      const previousLocalSources = [...localSources];
      
      // Update local state immediately for UI feedback
      setLocalSources(prev => [tempSource, ...prev]);
      
      // Add to pendingItems to show loading indicators
      setPendingItems(prev => new Set(prev).add(tempId));
      
      // Update React Query cache 
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], (oldData = []) => 
        [tempSource, ...oldData]
      );
      
      return { previousSources, previousLocalSources, tempId };
    },
    onError: (err, newSource, context) => {
      if (context) {
        // Revert both local state and React Query cache
        setLocalSources(context.previousLocalSources);
        queryClient.setQueryData(["/api/news-tracker/sources"], context.previousSources);
        
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.tempId);
          return updated;
        });
      }
      
      toast({
        title: "Error adding source",
        description: "Failed to add source. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      if (context?.tempId) {
        // Update local state with actual server data
        setLocalSources(prev => 
          prev.map(source => 
            source.id === context.tempId ? (data as Source) : source
          )
        );
        
        // Update React Query cache with server data
        queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], prev => 
          prev?.map(source => 
            source.id === context.tempId ? (data as Source) : source
          ) || []
        );
        
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.tempId);
          return updated;
        });
      }
      
      form.reset();
      toast({
        title: "Source added successfully",
      });
    },
  });

  const scrapeSource = useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/sources/${id}/scrape`, {
          method: "POST",
          headers: csfrHeaderObject(),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to scrape source: ${response.statusText}`);
        }
        
        // Try to parse JSON but handle empty responses
        try {
          const data = await response.json();
          return data;
        } catch (e) {
          // If parsing fails, just return success
          return { success: true, id };
        }
      } catch (error) {
        console.error("Scrape source error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/sources"] });
      
      // Snapshot the previous value
      const previousSources = queryClient.getQueryData<Source[]>(["/api/news-tracker/sources"]);
      
      // Optimistically update the source
      // We can't easily update the status directly as it may be part of scrapingConfig
      // But we can set a temporary visual indication by updating another property
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], (oldData = []) => 
        oldData.map(source => 
          source.id === id 
            ? { ...source, active: true } 
            : source
        )
      );
      
      return { previousSources };
    },
    onError: (err, id, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], context?.previousSources);
      toast({
        title: "Error scraping source",
        description: "Failed to scrape source. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Don't invalidate the sources - we already updated them optimistically
      // For articles we do need to update since the content has changed
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/articles"] });
      toast({
        title: "Source scraped successfully",
      });
    },
  });

  const stopScraping = useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/sources/${id}/stop`, {
          method: "POST",
          headers: csfrHeaderObject(),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to stop scraping: ${response.statusText}`);
        }
        
        // Try to parse JSON but handle empty responses
        try {
          const data = await response.json();
          return data;
        } catch (e) {
          // If parsing fails, just return success
          return { success: true, id };
        }
      } catch (error) {
        console.error("Stop scraping error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/sources"] });
      
      // Snapshot the previous value
      const previousSources = queryClient.getQueryData<Source[]>(["/api/news-tracker/sources"]);
      
      // Optimistically update the source
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], (oldData = []) => 
        oldData.map(source => 
          source.id === id 
            ? { ...source, active: true } // Use active property as a visual indicator
            : source
        )
      );
      
      return { previousSources };
    },
    onError: (err, id, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], context?.previousSources);
      toast({
        title: "Error stopping scrape",
        description: "Failed to stop scraping. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Don't invalidate - rely on the optimistic update
      toast({
        title: "Scraping stopped successfully",
      });
    },
  });
  
  // Toggle auto-scrape inclusion for a source
  const toggleAutoScrape = useMutation({
    mutationFn: async ({ id, include }: { id: string, include: boolean }) => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/sources/${id}/auto-scrape`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...csfrHeaderObject()
          },
          body: JSON.stringify({ includeInAutoScrape: include }),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update auto-scrape setting: ${response.statusText}`);
        }
        
        // Try to parse JSON but handle empty responses
        try {
          const data = await response.json();
          return data;
        } catch (e) {
          // If parsing fails, just return success with the data we know
          return { id, includeInAutoScrape: include, success: true };
        }
      } catch (error) {
        console.error("Toggle auto-scrape error:", error);
        throw error;
      }
    },
    onMutate: async ({ id, include }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/sources"] });
      
      // Get snapshot of current data
      const previousSources = queryClient.getQueryData<Source[]>(["/api/news-tracker/sources"]);
      const previousLocalSources = [...localSources];
      
      // Add to pendingItems to show loading indicator
      setPendingItems(prev => new Set(prev).add(id));
      
      // Optimistically update local state for UI feedback
      setLocalSources(prev => 
        prev.map(source => 
          source.id === id 
            ? { ...source, includeInAutoScrape: include }
            : source
        )
      );
      
      // Optimistically update React Query cache
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], (old = []) => 
        old.map(source => 
          source.id === id 
            ? { ...source, includeInAutoScrape: include }
            : source
        )
      );
      
      return { previousSources, previousLocalSources, id };
    },
    onError: (err, variables, context) => {
      if (context) {
        // Revert both local state and React Query cache on error
        setLocalSources(context.previousLocalSources);
        queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], context.previousSources);
        
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.id);
          return updated;
        });
      }
      
      toast({
        title: "Failed to update auto-scrape setting",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables) => {
      // Remove from pending items
      setPendingItems(prev => {
        const updated = new Set(prev);
        updated.delete(variables.id);
        return updated;
      });
      
      // Don't refetch - the optimistic update already handled the UI change
      toast({
        title: "Auto-scrape settings updated",
      });
    },
  });
  
  // Delete a source
  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      try {
        // Use fetch directly to handle empty responses properly
        const response = await fetch(`${serverUrl}/api/news-tracker/sources/${id}`, {
          method: "DELETE",
          headers: csfrHeaderObject(),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete source: ${response.statusText}`);
        }
        
        // Don't try to parse JSON - some DELETE endpoints return empty responses
        return { success: true, id };
      } catch (error) {
        console.error("Delete source error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/sources"] });
      
      // Snapshot the previous values
      const previousSources = queryClient.getQueryData<Source[]>(["/api/news-tracker/sources"]);
      const previousLocalSources = [...localSources];
      
      // Add to pendingItems to show loading indicator
      setPendingItems(prev => new Set(prev).add(id));
      
      // Optimistically update the local state for immediate UI feedback
      setLocalSources(prev => prev.filter(source => source.id !== id));
      
      // Update React Query cache optimistically
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], (oldData = []) => 
        oldData.filter(source => source.id !== id)
      );
      
      return { previousSources, previousLocalSources, id };
    },
    onError: (error: Error, id, context) => {
      if (context) {
        // If the mutation fails, restore both local state and React Query cache
        setLocalSources(context.previousLocalSources);
        queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], context.previousSources);
        
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(id);
          return updated;
        });
      }
      
      toast({
        title: "Error deleting source",
        description: error.message || "Failed to delete source. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, id) => {
      // Remove from pending items
      setPendingItems(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
      
      // Don't invalidate - optimistic delete already removed the item
      toast({
        title: "Source deleted successfully",
      });
      
      // Close the delete dialog
      setDeleteDialogOpen(false);
      setSourceToDelete(null);
    },
  });
  
  // Run global scrape job manually
  // Add the stop global scrape mutation
  const stopGlobalScrape = useMutation({
    mutationFn: async () => {
      try {
        // Add a debugging log before making the request
        console.log("Attempting to stop global scrape job...");
        
        const response = await fetch(`${serverUrl}/api/news-tracker/jobs/stop`, {
          method: "POST",
          headers: {
            ...csfrHeaderObject(),
            "Content-Type": "application/json"
          },
          credentials: "include"
        });
        
        console.log("Stop request response status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error(`Failed to stop global scrape: ${response.statusText}`);
        }
        
        // Try to parse JSON but handle empty responses
        try {
          const data = await response.json();
          console.log("Stop job succeeded with data:", data);
          return data;
        } catch (e) {
          console.log("Empty response, returning success object");
          return { success: true };
        }
      } catch (error) {
        console.error("Stop global scrape error:", error);
        throw error;
      }
    },
    onError: (err) => {
      console.error("Stop global scrape mutation error handler:", err);
      toast({
        title: "Error stopping global scrape",
        description: "Failed to stop scraping. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      console.log("Stop global scrape succeeded:", data);
      toast({
        title: "Global scrape job stopped",
        description: "All scraping operations have been stopped"
      });
      // Force update job status
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/jobs/status"] });
    },
  });

  const runGlobalScrape = useMutation({
    mutationFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/jobs/scrape`, {
          method: "POST",
          headers: csfrHeaderObject(),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to start global scrape: ${response.statusText}`);
        }
        
        // Try to parse JSON but handle empty responses
        try {
          const data = await response.json();
          return data;
        } catch (e) {
          // If parsing fails, just return success
          return { success: true };
        }
      } catch (error) {
        console.error("Run global scrape error:", error);
        throw error;
      }
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/sources"] });
      
      // Snapshot the previous state
      const previousSources = queryClient.getQueryData<Source[]>(["/api/news-tracker/sources"]);
      
      // Optimistically update all eligible sources
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], (oldData = []) => 
        oldData.map(source => 
          source.includeInAutoScrape 
            ? { ...source, active: true } // Use active property as a visual indicator
            : source
        )
      );
      
      return { previousSources };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData<Source[]>(["/api/news-tracker/sources"], context?.previousSources);
      toast({
        title: "Error starting global scrape",
        description: "Failed to start scraping. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Don't refetch immediately - we'll poll instead
      toast({
        title: "Global scrape job started",
        description: "All eligible sources are being scraped"
      });
      // Poll job status
      const checkInterval = setInterval(async () => {
        try {
          const response = await fetch(`${serverUrl}/api/news-tracker/jobs/status`);
          const data = await response.json();
          if (!data.running) {
            clearInterval(checkInterval);
            toast({
              title: "Global scrape job completed",
            });
            // Invalidate only articles since they've changed
            queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/articles"] });
            // Don't invalidate sources - their status was already updated optimistically
          }
        } catch (error) {
          clearInterval(checkInterval);
        }
      }, 5000);
    },
  });
  
  // Update auto-scrape settings
  const updateAutoScrapeSettings = useMutation({
    mutationFn: async ({ enabled, interval }: { enabled: boolean, interval: JobInterval }) => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/settings/auto-scrape`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...csfrHeaderObject()
          },
          body: JSON.stringify({ enabled, interval }),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update auto-scrape settings: ${response.statusText}`);
        }
        
        // Try to parse JSON but handle empty responses
        try {
          const data = await response.json();
          return data;
        } catch (e) {
          // If parsing fails, just return success with the data we know
          return { enabled, interval, success: true };
        }
      } catch (error) {
        console.error("Update auto-scrape settings error:", error);
        throw error;
      }
    },
    onMutate: async ({ enabled, interval }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/settings/auto-scrape"] });
      const previousSettings = queryClient.getQueryData<AutoScrapeSettings>(["/api/news-tracker/settings/auto-scrape"]);
      
      queryClient.setQueryData<AutoScrapeSettings>(["/api/news-tracker/settings/auto-scrape"], {
        enabled,
        interval: interval || (previousSettings && 'interval' in previousSettings ? previousSettings.interval : JobInterval.DAILY)
      });
      
      return { previousSettings };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData<AutoScrapeSettings>(["/api/news-tracker/settings/auto-scrape"], context?.previousSettings);
      toast({
        title: "Failed to update settings",
        variant: "destructive"
      });
    },
    onSuccess: () => {
      // Don't invalidate - rely on optimistic updates
      toast({
        title: "Auto-scrape schedule updated",
      });
      setIsSettingsOpen(false);
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    addSource.mutate(data);
  });

  return (
    <div className={cn(
      "flex flex-col pb-20"
    )}>
      {/* Delete confirmation dialog */}
      <DeleteAlertDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        action={() => {
          if (sourceToDelete) {
            deleteSource.mutate(sourceToDelete);
            setSourceToDelete(null);
          }
        }}
      >
        <span></span>
      </DeleteAlertDialog>

      <div className="flex flex-col gap-5 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1 sm:gap-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">Sources</h1>
            <p className="text-sm sm:text-base text-slate-300">Manage news sources and control web scraping operations</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50 hover:text-white h-9 px-2 sm:px-3"
                >
                  <Settings className="sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Auto-Scrape Settings</span>
                  <span className="sm:hidden ml-0.5">Settings</span>
                </Button>
              </PopoverTrigger>
              {<PopoverContent className="w-80 bg-slate-900 border-slate-700 text-white">
                <div className="space-y-4">
                  <h4 className="font-medium text-white">Auto-Scrape Configuration</h4>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-scrape-enabled" className="text-slate-300">Enable Auto-Scrape</Label>
                    <Switch 
                      id="auto-scrape-enabled" 
                      checked={!!autoScrapeSettings.data?.enabled}
                      disabled={updateAutoScrapeSettings.isPending}
                      onCheckedChange={(checked) => {
                        updateAutoScrapeSettings.mutate({
                          enabled: checked,
                          interval: autoScrapeSettings.data?.interval ?? JobInterval.DAILY
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-select" className="text-slate-300">Schedule Frequency</Label>
                    <Select
                      disabled={!autoScrapeSettings.data?.enabled}
                      value={(autoScrapeSettings.data?.interval || JobInterval.DAILY).toString()}
                      onValueChange={(value) => {
                        updateAutoScrapeSettings.mutate({
                          enabled: !!autoScrapeSettings.data?.enabled,
                          interval: parseInt(value) as JobInterval
                        });
                      }}
                    >
                      <SelectTrigger id="schedule-select" className="bg-slate-800/70 border-slate-700 text-white">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-white">
                        {Object.entries(intervalLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-2 text-xs text-slate-400">
                    Auto-scrape will only process sources marked as included in the table below.
                  </div>
                </div>
              </PopoverContent>}
            </Popover>
            
            {autoScrapeStatus?.data?.running ? (
              <Button 
                onClick={() => stopGlobalScrape.mutate()}
                disabled={stopGlobalScrape.isPending}
                size="sm"
                className="bg-red-600 hover:bg-red-600/80 text-white hover:text-[#00FFFF] h-9 px-2 sm:px-3"
              >
                {stopGlobalScrape.isPending ? (
                  <Loader2 className="sm:mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <X className="sm:mr-2 h-4 w-4" />
                )}
                <span className="hidden sm:inline">Stop Auto-Scrape</span>
                <span className="sm:hidden">Stop</span>
              </Button>
            ) : (
              <Button 
                onClick={() => runGlobalScrape.mutate()}
                disabled={runGlobalScrape.isPending}
                size="sm"
                className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] h-9 px-2 sm:px-3"
              >
                {runGlobalScrape.isPending ? (
                  <Loader2 className="sm:mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="sm:mr-2 h-4 w-4" />
                )}
                <span className="hidden sm:inline">Run Auto-Scrape Now</span>
                <span className="sm:hidden">Run Now</span>
              </Button>
            )}
          </div>
        </div>
        
        {/* Scheduled status indicator */}
        {autoScrapeSettings.data?.enabled && autoScrapeSettings.data?.interval && (
          <div className="flex flex-wrap items-center p-3 bg-primary/10 rounded-lg text-xs sm:text-sm border border-primary/20">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary mr-1.5 sm:mr-2 flex-shrink-0" />
            <span className="text-white">
              Auto-scrape is scheduled to run <span className="text-primary font-medium whitespace-nowrap">
                {intervalLabels[autoScrapeSettings.data.interval as JobInterval]}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className="xl:col-span-2 bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 sm:p-6">
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base sm:text-lg font-medium text-white">Add News Source</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-1 sm:mb-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 sm:mb-1.5 block">Source Name</label>
                <Input
                  placeholder="E.g., Tech News Daily"
                  {...form.register("name")}
                  className="h-9 sm:h-10 bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 sm:mb-1.5 block">Source URL</label>
                <Input
                  placeholder="https://example.com"
                  {...form.register("url")}
                  className="h-9 sm:h-10 bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={addSource.isPending}
                className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] h-9 sm:h-10 px-3 sm:px-4"
              >
                {addSource.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Source
              </Button>
            </div>
          </form>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-medium text-white mb-3">Quick Tips</h2>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2 text-slate-300">
                <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>Add reliable news sources with well-structured content for best results.</span>
              </li>
              <li className="flex gap-2 text-slate-300">
                <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>Configure auto-scrape settings to automatically collect new content on a schedule.</span>
              </li>
            </ul>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm text-white">
                <span className="font-medium">{sources.data?.length || 0}</span> sources available
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(
        "bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden",
        "flex flex-col"
      )}>
        <div className="p-5 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Source List</h2>
            <div className="text-sm text-slate-400">
              {sources.data?.length || 0} sources configured
            </div>
          </div>
        </div>

        {sources.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : sources.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-800/70 flex items-center justify-center mb-4">
              <Globe className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No sources added</h3>
            <Button 
              className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
              onClick={() => sources.refetch()}
            >
                Fetch Sources
            </Button>
            <p className="text-slate-400 max-w-md">
              Add your first news source above to start scraping articles
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto md:overflow-x-visible lg:overflow-x-visible -mx-4 sm:mx-0 px-4 sm:px-0">
            <Table className="min-w-[650px] md:min-w-[460px] lg:min-w-0 w-full">
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-slate-800/70">
                  <TableHead className="text-slate-300 md:w-auto lg:w-auto w-[25%]">Source</TableHead>
                  <TableHead className="text-slate-300 md:w-auto lg:w-auto w-[30%] md:max-w-[160px] lg:max-w-[200px] xl:max-w-none">URL</TableHead>
                  <TableHead className="text-slate-300 md:w-auto lg:w-auto w-[20%] md:min-w-[85px] lg:min-w-[100px]">
                    <span className="hidden sm:inline md:hidden lg:inline">Auto-Scrape</span>
                    <span className="sm:hidden md:inline lg:hidden">Auto</span>
                    <span className="md:hidden">Auto</span>
                  </TableHead>
                  <TableHead className="text-right text-slate-300 md:w-auto lg:w-auto w-[25%] md:min-w-[95px] lg:min-w-[115px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localSources.map((source) => (
                  <TableRow 
                    key={source.id} 
                    className={cn(
                      "border-slate-700/50 hover:bg-slate-800/70 transition-opacity duration-200",
                      pendingItems.has(source.id) && "opacity-60"
                    )}
                  >
                    <TableCell className="md:min-w-0 lg:min-w-0 min-w-[100px] font-medium text-white">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {pendingItems.has(source.id) 
                            ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary animate-spin" />
                            : <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                          }
                        </div>
                        <span className="truncate max-w-[80px] sm:max-w-full md:max-w-[115px] lg:max-w-[150px] xl:max-w-none">{source.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="md:min-w-0 lg:min-w-0 min-w-[120px]">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Link2 className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500 flex-shrink-0" />
                        <a 
                          href={source.url} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-300 hover:text-primary transition-colors truncate max-w-[80px] sm:max-w-[120px] md:max-w-[150px] lg:max-w-[180px] xl:max-w-[250px]"
                        >
                          {source.url.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="md:min-w-0 lg:min-w-0 min-w-[80px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Switch
                          id={`auto-scrape-${source.id}`}
                          checked={source.includeInAutoScrape || false}
                          onCheckedChange={(checked) => 
                            toggleAutoScrape.mutate({ id: source.id, include: checked })
                          }
                          disabled={toggleAutoScrape.isPending}
                        />
                        <Label htmlFor={`auto-scrape-${source.id}`} className="text-slate-300 text-xs sm:text-sm">
                          <span className="hidden sm:inline">{source.includeInAutoScrape ? "Included" : "Excluded"}</span>
                          <span className="sm:hidden">{source.includeInAutoScrape ? "On" : "Off"}</span>
                        </Label>
                      </div>
                    </TableCell>
                    <TableCell className="text-right p-2 sm:p-4 md:min-w-0 lg:min-w-0 min-w-[130px]">
                      <div className="flex justify-end gap-1 sm:gap-2 md:flex-wrap lg:flex-wrap xl:flex-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => scrapeSource.mutate(source.id)}
                          disabled={scrapeSource.isPending}
                          className="border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/70 hover:text-white h-7 px-2 sm:h-8 sm:px-3"
                        >
                          {scrapeSource.isPending ? (
                            <Loader2 className="sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <RotateCw className="sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                          <span className="hidden sm:inline">Scrape</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => stopScraping.mutate(source.id)}
                          disabled={stopScraping.isPending}
                          className="border-red-900/50 bg-red-950/20 text-red-400 hover:bg-red-900/30 hover:text-red-300 h-7 px-2 sm:h-8 sm:px-3"
                        >
                          {stopScraping.isPending ? (
                            <Loader2 className="sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <X className="sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                          <span className="hidden sm:inline">Stop</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSourceToDelete(source.id);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteSource.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          {deleteSource.isPending ? (
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
