import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { apiRequest } from "@/lib/query-client";
import { serverUrl } from "@/utils/server-url";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { ThreatSource } from "@shared/db/schema/threat-tracker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  AlertCircle, 
  PencilLine, 
  ExternalLink,
  RefreshCw,
  Clock,
  PlayCircle,
  RotateCw,
  Check,
  X,
  Globe,
  ChevronRight,
  ChevronDown,
  Shield,
  Play,
} from "lucide-react";

// Enum for auto-scrape intervals (matching backend numeric format)
export enum JobInterval {
  HOURLY = 3600000,     // 60 * 60 * 1000
  DAILY = 86400000,     // 24 * 60 * 60 * 1000  
  WEEKLY = 604800000,   // 7 * 24 * 60 * 60 * 1000
  DISABLED = 0,         // Disabled
}

// Convert enum to human-readable labels
const intervalLabels: Record<JobInterval, string> = {
  [JobInterval.HOURLY]: "hourly",
  [JobInterval.DAILY]: "daily", 
  [JobInterval.WEEKLY]: "weekly",
  [JobInterval.DISABLED]: "disabled"
};

// Type for auto-scrape settings
type AutoScrapeSettings = {
  enabled: boolean;
  interval: JobInterval;
  lastRunAt?: string; // ISO timestamp of last job execution
};

// Form schema for source creation/editing
const sourceFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  active: z.boolean().default(true),
  includeInAutoScrape: z.boolean().default(true),
});

type SourceFormValues = z.infer<typeof sourceFormSchema>;

export default function Sources() {
  const { toast } = useToast();
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<ThreatSource | null>(null);
  const [localSources, setLocalSources] = useState<ThreatSource[]>([]);
  const [scrapeJobRunning, setScrapeJobRunning] = useState(false);
  const [scrapingSourceId, setScrapingSourceId] = useState<string | null>(null);
  const [localAutoScrapeEnabled, setLocalAutoScrapeEnabled] = useState<
    boolean | null
  >(null);
  const [localAutoScrapeInterval, setLocalAutoScrapeInterval] = useState<
    JobInterval | null
  >(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    source: ThreatSource;
    articleCount: number;
  } | null>(null);
  const [isDefaultSourcesCollapsed, setIsDefaultSourcesCollapsed] = useState(false);

  // Initialize the form
  const form = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      name: "",
      url: "",
      active: true,
      includeInAutoScrape: true,
    },
  });

  // Fetch sources
  const sources = useQuery<ThreatSource[]>({
    queryKey: [`${serverUrl}/api/threat-tracker/sources`],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/threat-tracker/sources`, {
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
    queryKey: [`${serverUrl}/api/threat-tracker/settings/auto-scrape`],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/threat-tracker/settings/auto-scrape`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        })
        if (!response.ok) throw new Error('Failed to fetch auto-update settings')

        const data = await response.json()
        return data || { enabled: false, interval: JobInterval.DAILY }
      } catch(error) {
        console.error(error)
        return { enabled: false, interval: JobInterval.DAILY }
      }
    }
  });

  // Sync local auto-scrape state with query data
  useEffect(() => {
    if (autoScrapeSettings.data) {
      if (localAutoScrapeEnabled === null) {
        setLocalAutoScrapeEnabled(autoScrapeSettings.data.enabled);
      }
      if (localAutoScrapeInterval === null) {
        setLocalAutoScrapeInterval(autoScrapeSettings.data.interval);
      }
    }
  }, [autoScrapeSettings.data, localAutoScrapeEnabled, localAutoScrapeInterval]);

  // Check scrape job status
  const checkScrapeStatus = useQuery<{ running: boolean }>({
    queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/threat-tracker/scrape/status`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        })
        if (!response.ok) {
          console.warn("Scrape status API returned non-ok response:", response.status);
          return { running: false };
        }

        const data = await response.json()
        return data || { running: false }
      } catch(error) {
        console.error("Error fetching scrape status:", error)
        return { running: false }
      }
    },
    refetchInterval: 5000, // Poll every 5 seconds
    initialData: { running: false },
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Update scrapeJobRunning state when status changes
  useEffect(() => {
    if (checkScrapeStatus.data) {
      setScrapeJobRunning(checkScrapeStatus.data.running);
    }
  }, [checkScrapeStatus.data]);

  // Create source mutation
  const createSource = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      return apiRequest("POST", `${serverUrl}/api/threat-tracker/sources`, values);
    },
    onMutate: async (newSource) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/sources`],
      });

      // Create optimistic source with temporary ID
      const optimisticSource: ThreatSource = {
        id: `temp-${Date.now()}`,
        name: newSource.name,
        url: newSource.url,
        active: newSource.active,
        includeInAutoScrape: newSource.includeInAutoScrape,
        lastScraped: null,
        userId: "current-user",
        scrapingConfig: null,
        isDefault: false, // User-created sources are never default
      };

      // Add to local state immediately
      setLocalSources((prev) => [...prev, optimisticSource]);

      // Store previous state for rollback
      const previousSources = queryClient.getQueryData([
        `${serverUrl}/api/threat-tracker/sources`,
      ]);
      return { previousSources, optimisticSource };
    },
    onSuccess: (data, _, context) => {
      // Replace optimistic source with real one
      setLocalSources((prev) =>
        prev.map((source) =>
          source.id === context?.optimisticSource.id ? data : source,
        ),
      );
      toast({
        title: "Source created",
        description: "Your source has been added successfully.",
      });
      setSourceDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/sources`] });
    },
    onError: (error) => {
      console.error("Error creating source:", error);
      toast({
        title: "Error creating source",
        description: "There was an error creating your source. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update source mutation
  const updateSource = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SourceFormValues }) => {
      return apiRequest("PUT", `${serverUrl}/api/threat-tracker/sources/${id}`, values);
    },
    onMutate: async ({ id, values }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/sources`],
      });

      // Snapshot previous value
      const previousSources = [...localSources];

      // Optimistically update source in local state
      setLocalSources((prev) =>
        prev.map((source) =>
          source.id === id
            ? { ...source, ...values }
            : source
        )
      );

      return { previousSources, updatedId: id };
    },
    onSuccess: (data, variables) => {
      // Update with actual server response if available
      if (data) {
        setLocalSources((prev) =>
          prev.map((source) =>
            source.id === variables.id ? data : source
          )
        );
      }

      // Only show toast for dialog-based updates (not quick toggles)
      if (sourceDialogOpen) {
        toast({
          title: "Source updated",
          description: "Your source has been updated successfully.",
        });
        setSourceDialogOpen(false);
        setEditingSource(null);
        form.reset();
      }

      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/sources`] });
    },
    onError: (error, _, context) => {
      // Rollback optimistic update
      if (context?.previousSources) {
        setLocalSources(context.previousSources);
      }

      console.error("Error updating source:", error);
      toast({
        title: "Error updating source",
        description: "There was an error updating your source. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete source mutation
  const deleteSource = useMutation({
    mutationFn: async ({ id, deleteArticles = false }: { id: string; deleteArticles?: boolean }) => {
      const url = deleteArticles 
        ? `${serverUrl}/api/threat-tracker/sources/${id}?deleteArticles=true`
        : `${serverUrl}/api/threat-tracker/sources/${id}`;
      return apiRequest("DELETE", url);
    },
    onMutate: async ({ id: deletedId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/sources`],
      });

      // Remove from local state immediately
      const previousSources = [...localSources];
      setLocalSources((prev) =>
        prev.filter((source) => source.id !== deletedId),
      );

      return { previousSources, deletedId };
    },
    onSuccess: () => {
      toast({
        title: "Source deleted",
        description: "Your source has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/sources`] });
    },
    onError: (error: any, _, context) => {
      // Rollback optimistic update
      if (context?.previousSources) {
        setLocalSources(context.previousSources);
      }

      console.error("Error deleting source:", error);

      // Don't show error toast for ARTICLES_EXIST - this will be handled by the confirmation dialog
      if (error?.response?.data?.error !== "ARTICLES_EXIST") {
        toast({
          title: "Error deleting source",
          description: error?.response?.data?.message || "There was an error deleting your source. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Scrape single source mutation
  const scrapeSingleSource = useMutation({
    mutationFn: async (id: string) => {
      setScrapingSourceId(id);
      return apiRequest("POST", `${serverUrl}/api/threat-tracker/scrape/source/${id}`);
    },
    onSuccess: (data) => {
      toast({
        title: "Source updated",
        description: `Found ${data.articleCount || 0} new articles.`,
      });
      setScrapingSourceId(null);
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/sources`] });
    },
    onError: (error) => {
      console.error("Error updating source:", error);
      let specialTitle: null | string = null;
      let specialDescription: null | string = null;
      const specialErrorParts = [
        "timed out"
      ]
      for (let i=0; i<specialErrorParts.length; i++) {
        if (error.message.includes(specialErrorParts[i])) {
          specialTitle = "This source is unsupported!";
          specialDescription = "The source you updated is currently unsupported and results may be limited. Check back soon as we roll out improvements for this feature!"
        }
        break
      }
      toast({
        title: specialTitle || "Error updating source",
        description: specialDescription || "There was an error updating this source. Please try again.",
        variant: specialTitle ? "default" : "destructive",
      });
      setScrapingSourceId(null);
    },
  });

  // Scrape all sources mutation
  const scrapeAllSources = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `${serverUrl}/api/threat-tracker/scrape/all`);
    },
    onSuccess: () => {
      toast({
        title: "Update started",
        description: "The system is now updating all active sources for threats.",
      });
      setScrapeJobRunning(true);
      // Start polling for status updates
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`] });
    },
    onError: (error) => {
      console.error("Error starting update:", error);
      toast({
        title: "Error starting update",
        description: "There was an error starting the update. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stop scrape job mutation
  const stopScrapeJob = useMutation({
    mutationFn: async () => {
      try {
        console.log("Attempting to stop global update...");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${serverUrl}/api/threat-tracker/scrape/stop`, {
          method: "POST",
          headers: {
            ...csfrHeaderObject(),
            "Content-Type": "application/json",
          },
          credentials: "include",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log("Stop request response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Stop request failed with:", errorText);
          throw new Error(`Failed to stop update: ${response.statusText}`);
        }

        try {
          const data = await response.json();
          console.log("Stop job succeeded with data:", data);
          return data || { success: true, message: "Update stopped" };
        } catch (e) {
          console.log("No JSON response, assuming success");
          return { success: true, message: "Update stopped" };
        }
      } catch (error) {
        console.error("Stop update error:", error);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error("Stop request timed out. The update may still be stopping.");
        }
        throw error;
      }
    },
    onMutate: () => {
      console.log("Stop mutation started");
    },
    onSuccess: (data) => {
      console.log("Stop global update succeeded:", data);
      toast({
        title: "Update stopped",
        description: "The update has been stopped successfully.",
      });
      setScrapeJobRunning(false);
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`] });
    },
    onError: (error) => {
      console.error("Error stopping update:", error);
      toast({
        title: "Error stopping update",
        description: error instanceof Error ? error.message : "There was an error stopping the update. Please try again.",
        variant: "destructive",
      });
      // Force status check after error
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`] });
    },
    onSettled: () => {
      console.log("Stop mutation settled");
      // Reset any pending states
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`] });
      }, 1000);
    },
  });

  // Update auto-scrape settings mutation
  const updateAutoScrapeSettings = useMutation({
    mutationFn: async ({ enabled, interval }: AutoScrapeSettings): Promise<AutoScrapeSettings> => {
      return apiRequest("PUT", `${serverUrl}/api/threat-tracker/settings/auto-scrape`, { enabled, interval });
    },
    onMutate: async ({ enabled, interval }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ 
        queryKey: [`${serverUrl}/api/threat-tracker/settings/auto-scrape`] 
      });

      // Snapshot the previous values for potential rollback
      const previousSettings = queryClient.getQueryData<AutoScrapeSettings>([
        `${serverUrl}/api/threat-tracker/settings/auto-scrape`
      ]);
      const previousLocalEnabled = localAutoScrapeEnabled;
      const previousLocalInterval = localAutoScrapeInterval;

      // Optimistically update the cache with new settings
      queryClient.setQueryData<AutoScrapeSettings>(
        [`${serverUrl}/api/threat-tracker/settings/auto-scrape`],
        { enabled, interval }
      );

      // Update local state for immediate UI feedback
      setLocalAutoScrapeEnabled(enabled);
      setLocalAutoScrapeInterval(interval);

      return { 
        previousSettings, 
        previousLocalEnabled, 
        previousLocalInterval 
      };
    },
    onError: (err, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousSettings) {
        queryClient.setQueryData<AutoScrapeSettings>(
          [`${serverUrl}/api/threat-tracker/settings/auto-scrape`],
          context.previousSettings
        );
      }
      
      // Rollback local state
      if (context?.previousLocalEnabled !== undefined) {
        setLocalAutoScrapeEnabled(context.previousLocalEnabled);
      }
      if (context?.previousLocalInterval !== undefined) {
        setLocalAutoScrapeInterval(context.previousLocalInterval);
      }

      console.error("Error changing auto-update settings:", err);
      toast({
        title: "Failed to save auto-update settings",
        description: "There was an error updating the settings. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables) => {
      // Update cache with actual server response
      queryClient.setQueryData<AutoScrapeSettings>(
        [`${serverUrl}/api/threat-tracker/settings/auto-scrape`],
        data
      );

      // Sync local state with server response
      setLocalAutoScrapeEnabled(data.enabled);
      setLocalAutoScrapeInterval(data.interval);

      toast({
        title: "Auto-update settings changed",
        description: data.enabled 
          ? `Auto-update has been enabled with ${intervalLabels[data.interval as JobInterval] || 'daily'} frequency.`
          : "Auto-update has been disabled.",
      });

      // Don't invalidate queries - rely on optimistic updates for better UX
    },
  });

  // Quick toggle source active status mutation (for immediate feedback)
  const toggleSourceActive = useMutation({
    mutationFn: async ({ id, active, source }: { id: string; active: boolean; source: ThreatSource }) => {
      return apiRequest("PUT", `${serverUrl}/api/threat-tracker/sources/${id}`, {
        name: source.name,
        url: source.url,
        active,
        includeInAutoScrape: source.includeInAutoScrape
      });
    },
    onMutate: async ({ id, active }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/sources`],
      });

      // Snapshot previous value
      const previousSources = [...localSources];

      // Optimistically update source active status
      setLocalSources((prev) =>
        prev.map((source) =>
          source.id === id
            ? { ...source, active }
            : source
        )
      );

      return { previousSources, toggledId: id };
    },
    onSuccess: (data, variables) => {
      // Update with actual server response
      if (data) {
        setLocalSources((prev) =>
          prev.map((source) =>
            source.id === variables.id ? data : source
          )
        );
      }
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/sources`] });
    },
    onError: (error, _, context) => {
      // Rollback optimistic update
      if (context?.previousSources) {
        setLocalSources(context.previousSources);
      }

      console.error("Error toggling source:", error);
      toast({
        title: "Error updating source",
        description: "Failed to update source status. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  function onSubmit(values: SourceFormValues) {
    if (editingSource) {
      updateSource.mutate({ id: editingSource.id, values });
    } else {
      createSource.mutate(values);
    }
  }

  // Handle edit source
  function handleEditSource(source: ThreatSource) {
    setEditingSource(source);
    form.reset({
      name: source.name,
      url: source.url,
      active: source.active,
      includeInAutoScrape: source.includeInAutoScrape,
    });
    setSourceDialogOpen(true);
  }

  // Handle new source dialog open
  function handleNewSource() {
    setEditingSource(null);
    form.reset({
      name: "",
      url: "",
      active: true,
      includeInAutoScrape: true,
    });
    setSourceDialogOpen(true);
  }

  // Handle toggle auto-scrape
  function handleToggleAutoScrape(enabled: boolean) {
    const currentInterval = localAutoScrapeInterval !== null ? localAutoScrapeInterval : autoScrapeSettings.data?.interval || JobInterval.DAILY;
    updateAutoScrapeSettings.mutate({
      enabled,
      interval: currentInterval,
    });
  }

  // Handle change auto-scrape interval
  function handleChangeAutoScrapeInterval(interval: JobInterval) {
    const currentEnabled = localAutoScrapeEnabled !== null ? localAutoScrapeEnabled : autoScrapeSettings.data?.enabled || false;
    updateAutoScrapeSettings.mutate({
      enabled: currentEnabled,
      interval,
    });
  }

  // Handle delete source with confirmation for associated articles
  async function handleDeleteSource(source: ThreatSource) {
    try {
      // Try to delete the source first to check if there are associated articles
      await deleteSource.mutateAsync({ id: source.id });
    } catch (error: any) {
      console.log("Caught error:", error);

      // Check for ARTICLES_EXIST error - the error data is attached to the error object
      const errorData = error?.data || {};
      const errorMessage = errorData?.error || error?.message;

      if (errorMessage === "ARTICLES_EXIST") {
        // Show confirmation dialog
        setDeleteConfirmation({
          source,
          articleCount: parseInt(errorData.articleCount || '0'),
        });
        return; // Don't show error toast
      }

      // For other errors, let the mutation's onError handle it
      throw error;
    }
  }

  // Handle confirmed deletion with articles
  function handleConfirmedDelete(deleteArticles: boolean) {
    if (deleteConfirmation) {
      if (deleteArticles) {
        deleteSource.mutate({ 
          id: deleteConfirmation.source.id, 
          deleteArticles: true 
        });
      }
      setDeleteConfirmation(null);
    }
  }

  // Format the last scraped date
  function formatLastScraped(date: Date | null | undefined) {
    if (!date) return "Never";

    try {
      const d = new Date(date);
      const now = new Date();
      const currentYear = now.getFullYear();
      const dateYear = d.getFullYear();
      
      // Format time without seconds (HH:MM AM/PM)
      const timeString = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Format date based on year
      let dateString;
      if (dateYear === currentYear) {
        // Current year: show M/D format
        dateString = `${d.getMonth() + 1}/${d.getDate()}`;
      } else {
        // Different year: show M/D/YYYY format
        dateString = `${d.getMonth() + 1}/${d.getDate()}/${dateYear}`;
      }
      
      return `${dateString}, ${timeString}`;
    } catch {
      return "Unknown";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">Tracking Sources</h1>
        <p className="text-muted-foreground">
          Manage sources for threat monitoring and configure auto-update settings.
        </p>
      </div>

      {/* Instructions Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-blue-600" />
            How to Use Threat Sources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">1. Configure Auto-Updates</h4>
                <p className="text-sm text-muted-foreground">
                  Enable automatic scanning to stay current with threats. Choose hourly, daily, or weekly updates.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">2. Manage Sources</h4>
                <p className="text-sm text-muted-foreground">
                  Default cybersecurity sources are provided. Add custom sources or enable/disable existing ones.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">3. Manual Updates</h4>
                <p className="text-sm text-muted-foreground">
                  Use "Update All Sources" for immediate scanning or update individual sources as needed.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">4. Monitor Keywords</h4>
                <p className="text-sm text-muted-foreground">
                  Visit the Keywords page to manage threat terms, vendors, and hardware for targeted monitoring.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-scrape settings card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Auto-Update Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic updates to stay on top of security vulnerabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="auto-scrape"
                checked={localAutoScrapeEnabled !== null ? localAutoScrapeEnabled : (autoScrapeSettings.data?.enabled || false)}
                onCheckedChange={handleToggleAutoScrape}
                disabled={updateAutoScrapeSettings.isPending}
              />
              <div className="grid gap-0.5">
                <label
                  htmlFor="auto-scrape"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {(localAutoScrapeEnabled !== null ? localAutoScrapeEnabled : (autoScrapeSettings.data?.enabled || false)) ? 'Enabled' : 'Disabled'}
                </label>
                <p className="text-xs text-muted-foreground">
                  {(localAutoScrapeEnabled !== null ? localAutoScrapeEnabled : (autoScrapeSettings.data?.enabled || false))
                    ? `Auto-scrape runs ${intervalLabels[(localAutoScrapeInterval !== null ? localAutoScrapeInterval : autoScrapeSettings.data?.interval) as JobInterval] || 'daily'}`
                    : "Enable to automatically update sources for new threats"}
                </p>
              </div>
              {updateAutoScrapeSettings.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-primary ml-2" />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant={(localAutoScrapeInterval !== null ? localAutoScrapeInterval : autoScrapeSettings.data?.interval) === JobInterval.HOURLY ? "default" : "outline"}
                size="sm"
                onClick={() => handleChangeAutoScrapeInterval(JobInterval.HOURLY)}
                disabled={!(localAutoScrapeEnabled !== null ? localAutoScrapeEnabled : autoScrapeSettings.data?.enabled) || updateAutoScrapeSettings.isPending}
              >
                {updateAutoScrapeSettings.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Hourly
              </Button>
              <Button
                variant={(localAutoScrapeInterval !== null ? localAutoScrapeInterval : autoScrapeSettings.data?.interval) === JobInterval.DAILY ? "default" : "outline"}
                size="sm"
                onClick={() => handleChangeAutoScrapeInterval(JobInterval.DAILY)}
                disabled={!(localAutoScrapeEnabled !== null ? localAutoScrapeEnabled : autoScrapeSettings.data?.enabled) || updateAutoScrapeSettings.isPending}
              >
                {updateAutoScrapeSettings.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Daily
              </Button>
              <Button
                variant={(localAutoScrapeInterval !== null ? localAutoScrapeInterval : autoScrapeSettings.data?.interval) === JobInterval.WEEKLY ? "default" : "outline"}
                size="sm"
                onClick={() => handleChangeAutoScrapeInterval(JobInterval.WEEKLY)}
                disabled={!(localAutoScrapeEnabled !== null ? localAutoScrapeEnabled : autoScrapeSettings.data?.enabled) || updateAutoScrapeSettings.isPending}
              >
                {updateAutoScrapeSettings.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Weekly
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {scrapeJobRunning ? (
              <span className="flex items-center text-primary">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Update is currently running...
              </span>
            ) : (
              <span>
                Check for new threats
              </span>
            )}
          </div>
          <Button
            onClick={() => {
              if (scrapeJobRunning || checkScrapeStatus?.data?.running) {
                stopScrapeJob.mutate();
              } else {
                scrapeAllSources.mutate();
              }
            }}
            disabled={(scrapeAllSources.isPending && !stopScrapeJob.isPending) || (stopScrapeJob.isPending && !scrapeAllSources.isPending) || localSources.length === 0}
            size="sm"
            className={
              scrapeJobRunning || checkScrapeStatus?.data?.running
                ? "bg-red-600 hover:bg-red-600/80 text-white"
                : "bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
            }
          >
            {scrapeAllSources.isPending || stopScrapeJob.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : scrapeJobRunning || checkScrapeStatus?.data?.running ? (
              <X className="mr-2 h-4 w-4" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            {scrapeJobRunning || checkScrapeStatus?.data?.running
              ? "Stop Update"
              : "Update All Sources"}
          </Button>
        </CardFooter>
      </Card>

      {/* Sources card */}
      <Card>
        <CardHeader className="flex flex-row gap-4 items-center justify-between">
          <div className="flex flex-col gap-2">
            <CardDescription className="hidden sm:block">
              Websites to monitor for security threat information. Default sources are provided for all users and cannot be deleted, but can be enabled/disabled.
            </CardDescription>
          </div>
          <Button onClick={handleNewSource} disabled={createSource.isPending} className="ml-5 mr-2 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]">
            {createSource.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Source
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col overflow-x-scroll">
          {renderSourcesTable()}
        </CardContent>
      </Card>

      {/* Add/Edit Source Dialog */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSource ? 'Edit Source' : 'Add New Source'}
            </DialogTitle>
            <DialogDescription>
              {editingSource
                ? 'Update the source details below.'
                : 'Enter the details for your new threat source.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter source name..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter the full URL of the source website
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Inactive sources won't be updated
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeInAutoScrape"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Auto-Update</FormLabel>
                        <FormDescription>
                          Include in automatic update
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setSourceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createSource.isPending || updateSource.isPending}
                >
                  {(createSource.isPending || updateSource.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingSource ? 'Update' : 'Add'} Source
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog for Sources with Articles */}
      <AlertDialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Source with Associated Articles</AlertDialogTitle>
            <AlertDialogDescription>
              The source "{deleteConfirmation?.source.name}" has {deleteConfirmation?.articleCount} associated threat articles.
              <br /><br />
              Would you like to delete the associated articles as well? If you choose "No", the source will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmedDelete(false)}>
                            Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleConfirmedDelete(false)}
              className="mr-2"
            >
              Keep Articles, Cancel Delete
            </Button>
            <AlertDialogAction
              onClick={() => handleConfirmedDelete(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Source & {deleteConfirmation?.articleCount} Articles
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // Helper function to render the sources table
  function renderSourcesTable() {
    if (sources.isLoading) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (localSources.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 border rounded-md border-dashed">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-2" />
          <h3 className="text-lg font-medium">No sources found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add sources to start monitoring for security threats
          </p>
          <Button onClick={handleNewSource} className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]">
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Button>
        </div>
      );
    }

    // Separate default and user sources, then sort by active status (active first)
    const defaultSources = localSources
      .filter(source => source.isDefault)
      .sort((a, b) => {
        // Active sources first, then inactive
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return 0;
      });

    const userSources = localSources
      .filter(source => !source.isDefault)
      .sort((a, b) => {
        // Active sources first, then inactive
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return 0;
      });

    console.log(localSources)
    console.log(defaultSources)

    return (
      <div className="space-y-6">
        {/* Default Sources Section - Compact Display */}
        {defaultSources.length > 0 && (
          <div className="mb-6">
            <Collapsible
              open={!isDefaultSourcesCollapsed}
              onOpenChange={(open) => setIsDefaultSourcesCollapsed(!open)}
            >
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 mb-3 hover:bg-muted/50 rounded-md p-1 -ml-1 w-full justify-start">
                  {isDefaultSourcesCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Shield className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Default Sources
                  </h3>
                  <Badge variant="outline" className="text-xs px-2 py-0">
                    {defaultSources.length}
                  </Badge>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted/30 rounded-lg space-y-2">
                  {defaultSources
                    .sort((a,b)=> a.name.localeCompare(b.name))
                    .map((source) => (
                    <div 
                      key={source.id} 
                      className={`flex flex-col sm:flex-row gap-y-4 sm:items-center items-start justify-between py-2 px-3 bg-background rounded border transition-opacity ${!source.active ? 'opacity-50' : ''}`}>
                      <div className="flex w-full items-center gap-3 min-w-0 flex-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${source.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div className="flex flex-col w-full min-w-0 flex-1">
                          <div className="flex w-full sm:w-fit justify-between items-center gap-2">
                            <span className="font-medium text-sm truncate">{source.name}</span>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">Default</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {source.url}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full sm:w-fit justify-between items-center gap-2 ">
                        <div className="text-xs text-muted-foreground">
                          {formatLastScraped(source.lastScraped)}
                        </div>
                          <Button
                          variant="outline"
                          size="sm"
                          onClick={() => scrapeSingleSource.mutate(source.id)}
                          disabled={scrapeSingleSource.isPending && scrapingSourceId === source.id}
                          className={`h-7 px-2 text-xs ${!source.active ? 'hover:bg-transparent' : ''}`}
                        >
                          {scrapeSingleSource.isPending && scrapingSourceId === source.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                          <RefreshCw className="h-3 w-3" />
                          )}
                          <span className="hidden sm:inline ml-1">Update</span>
                        </Button>
                        <Switch
                          checked={source.active}
                          onCheckedChange={(checked) => 
                            toggleSourceActive.mutate({
                              id: source.id,
                              active: checked,
                              source
                            })
                          }
                          disabled={toggleSourceActive.isPending}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* User Sources Section - Full Display */}
        {userSources.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Your Sources</h3>
              <Badge variant="outline" className="text-xs">
                {userSources.length} sources
              </Badge>
            </div>
            {renderUserSourcesTable(userSources)}
          </div>
        )}

        {/* Show message if only default sources exist */}
        {defaultSources.length > 0 && userSources.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p>No custom sources yet. Add your first source to get started.</p>
          </div>
        )}
      </div>
    );
  }

  // Helper function to render user sources table
  function renderUserSourcesTable(userSources: ThreatSource[]) {

    return (
      <div className="w-full">
        <div className="w-full">
          <Table className="table-fixed w-full">
            {<TableHeader className="flex flex-col w-[800px] min-[1148px]:w-full">
              <TableRow className="flex flex-row w-[800px] min-[1148px]:w-full">
                <TableHead className="w-[25%] min-w-[120px]">Name</TableHead>
                <TableHead className="w-[35%] min-w-[180px]">URL</TableHead>
                <TableHead className="w-[15%] min-w-[100px]">Status</TableHead>
                <TableHead className="w-[15%] min-w-[100px]">Last Updated</TableHead>
                <TableHead className="w-[10%] min-w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>}
            <TableBody className="flex flex-col w-[800px] min-[1148px]:w-full">
              {userSources.filter(s=>true).map((source) => (
                <TableRow 
                  key={source.id} 
                  className={`flex flex-grow w-full transition-opacity ${!source.active ? 'opacity-50' : ''}`
                }>
                  <TableCell className="font-medium w-[25%] min-w-[120px] truncate pr-2">{source.name}</TableCell>
                  <TableCell className="pr-2 w-[35%] min-w-[180px]">
                    <a 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex w-fit items-center text-primary hover:underline truncate"
                    >
                      <span className="truncate w-full">
                        {source.url.length > 30 
                          ? source.url.substring(0, 30) + '...' 
                          : source.url}
                      </span>
                      <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="pr-2 w-[15%] min-w-[100px]">
                    <div className="flex flex-col gap-1">
                      {source.active ? (
                        <Badge variant="default" className="flex items-center gap-1 bg-green-500 text-xs px-1 py-0.5 w-fit">
                          <Check className="h-2 w-2" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground text-xs px-1 py-0.5 w-fit">
                          <X className="h-2 w-2" />
                          Inactive
                        </Badge>
                      )}
                      {source.includeInAutoScrape && source.active && (
                        <Badge variant="outline" className="flex items-center gap-1 text-xs px-1 py-0.5 w-fit">
                          <RotateCw className="h-2 w-2" />
                          Auto
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs truncate pr-2 w-[15%] min-w-[100px]">
                    {formatLastScraped(source.lastScraped)}
                  </TableCell>
                  <TableCell className="text-right pr-0 w-[10%] min-w-[80px]">
                    <div className="flex justify-end gap-1 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => scrapeSingleSource.mutate(source.id)}
                        disabled={
                          !source.active || 
                          scrapingSourceId === source.id || 
                          scrapeJobRunning
                        }
                        className={`h-7 px-2 text-xs ${!source.active ? 'hover:bg-transparent' : ''}`}
                      >
                        {scrapingSourceId === source.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline ml-1">Update</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSource(source)}
                        className="h-7 w-7 p-0"
                      >
                        <PencilLine className="h-3 w-3" />
                        <span className="sr-only">Edit</span>
                      </Button>

                      {source.isDefault ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="text-muted-foreground h-7 w-7 p-0 cursor-not-allowed"
                          title="Cannot delete default sources"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="sr-only">Delete (disabled)</span>
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-7 w-7 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the source "
                                {source.name}". This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSource(source)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
}
