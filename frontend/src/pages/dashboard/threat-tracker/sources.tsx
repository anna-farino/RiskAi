import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  Minus,
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
  ListChecks,
} from "lucide-react";

// Enum for auto-scrape intervals (matching backend numeric format)
export enum JobInterval {
  HOURLY = 3600000, // 60 * 60 * 1000
  DAILY = 86400000, // 24 * 60 * 60 * 1000
  WEEKLY = 604800000, // 7 * 24 * 60 * 60 * 1000
  DISABLED = 0, // Disabled
}

// Convert enum to human-readable labels
const intervalLabels: Record<JobInterval, string> = {
  [JobInterval.HOURLY]: "hourly",
  [JobInterval.DAILY]: "daily",
  [JobInterval.WEEKLY]: "weekly",
  [JobInterval.DISABLED]: "disabled",
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
  includeInAutoScrape: z.boolean().default(true),
});

type SourceFormValues = z.infer<typeof sourceFormSchema>;

export default function Sources() {
  const { toast } = useToast();
  const fetchWithAuth = useFetch();
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<ThreatSource | null>(null);
  const [localSources, setLocalSources] = useState<ThreatSource[]>([]);
  const [scrapeJobRunning, setScrapeJobRunning] = useState(false);
  const [scrapingSourceId, setScrapingSourceId] = useState<string | null>(null);
  const [localAutoScrapeEnabled, setLocalAutoScrapeEnabled] = useState<
    boolean | null
  >(null);
  const [localAutoScrapeInterval, setLocalAutoScrapeInterval] =
    useState<JobInterval | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    source: ThreatSource;
    articleCount: number;
  } | null>(null);
  const [isDefaultSourcesCollapsed, setIsDefaultSourcesCollapsed] =
    useState(false);
  const [isInstructionsCollapsed, setIsInstructionsCollapsed] = useState(true);

  // Bulk operations state
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );
  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);
  const [bulkUrlsInput, setBulkUrlsInput] = useState("");
  const [bulkAddInProgress, setBulkAddInProgress] = useState(false);
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);

  // Initialize the form
  const form = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      name: "",
      url: "",
      includeInAutoScrape: true,
    },
  });

  // Fetch sources
  const sources = useQuery<ThreatSource[]>({
    queryKey: ["/api/threat-tracker/sources"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/sources", {
            method: "GET",
          });
        if (!response.ok) throw new Error("Failed to fetch sources");

        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return []; // Return empty array instead of undefined to prevent errors
      }
    },
  });

  // Sync local state with query data when it changes
  useEffect(() => {
    if (sources.data) {
      setLocalSources(sources.data);
    }
  }, [sources.data]);

  // Get auto-scrape settings
  const autoScrapeSettings = useQuery<AutoScrapeSettings>({
    queryKey: ["/api/threat-tracker/settings/auto-scrape"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/settings/auto-scrape", {
            method: "GET",
          });
        if (!response.ok)
          throw new Error("Failed to fetch auto-update settings");

        const data = await response.json();
        return data || { enabled: false, interval: JobInterval.DAILY };
      } catch (error) {
        console.error(error);
        return { enabled: false, interval: JobInterval.DAILY };
      }
    },
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
  }, [
    autoScrapeSettings.data,
    localAutoScrapeEnabled,
    localAutoScrapeInterval,
  ]);

  // Check scrape job status
  const checkScrapeStatus = useQuery<{ running: boolean }>({
    queryKey: ["/api/threat-tracker/scrape/status"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/scrape/status", {
            method: "GET",
          });
        if (!response.ok) {
          console.warn(
            "Scrape status API returned non-ok response:",
            response.status,
          );
          return { running: false };
        }

        const data = await response.json();
        return data || { running: false };
      } catch (error) {
        console.error("Error fetching scrape status:", error);
        return { running: false };
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
      const response = await fetchWithAuth('/api/threat-tracker/sources', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      return response.json();
    },
    onMutate: async (newSource) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });

      // Create optimistic source with temporary ID
      const optimisticSource: ThreatSource = {
        id: `temp-${Date.now()}`,
        name: newSource.name,
        url: newSource.url,
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
        "/api/threat-tracker/sources",
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
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });
    },
    onError: (error) => {
      console.error("Error creating source:", error);
      toast({
        title: "Error creating source",
        description:
          "There was an error creating your source. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update source mutation
  const updateSource = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: SourceFormValues;
    }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/sources/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      return response.json();
    },
    onMutate: async ({ id, values }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });

      // Snapshot previous value
      const previousSources = [...localSources];

      // Optimistically update source in local state
      setLocalSources((prev) =>
        prev.map((source) =>
          source.id === id ? { ...source, ...values } : source,
        ),
      );

      return { previousSources, updatedId: id };
    },
    onSuccess: (data, variables) => {
      // Update with actual server response if available
      if (data) {
        setLocalSources((prev) =>
          prev.map((source) => (source.id === variables.id ? data : source)),
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

      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });
    },
    onError: (error, _, context) => {
      // Rollback optimistic update
      if (context?.previousSources) {
        setLocalSources(context.previousSources);
      }

      console.error("Error updating source:", error);
      toast({
        title: "Error updating source",
        description:
          "There was an error updating your source. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete source mutation
  const deleteSource = useMutation({
    mutationFn: async ({
      id,
      deleteArticles = false,
    }: {
      id: string;
      deleteArticles?: boolean;
    }) => {
      const url = deleteArticles
        ? `/api/threat-tracker/sources/${id}?deleteArticles=true`
        : `/api/threat-tracker/sources/${id}`;
      return fetchWithAuth(url, {
        method: "DELETE",
      });
    },
    onMutate: async ({ id: deletedId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/threat-tracker/sources"],
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
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });
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
          description:
            error?.response?.data?.message ||
            "There was an error deleting your source. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Scrape single source mutation
  const scrapeSingleSource = useMutation({
    mutationFn: async (id: string) => {
      setScrapingSourceId(id);
      const response = await fetchWithAuth(`/api/threat-tracker/scrape/source/${id}`, {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Source updated",
        description: `Found ${data.articleCount || 0} new articles.`,
      });
      setScrapingSourceId(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });
    },
    onError: (error) => {
      console.error("Error updating source:", error);
      let specialTitle: null | string = null;
      let specialDescription: null | string = null;
      const specialErrorParts = ["timed out"];
      for (let i = 0; i < specialErrorParts.length; i++) {
        if (error.message.includes(specialErrorParts[i])) {
          specialTitle = "This source is unsupported!";
          specialDescription =
            "The source you updated is currently unsupported and results may be limited. Check back soon as we roll out improvements for this feature!";
        }
        break;
      }
      toast({
        title: specialTitle || "Error updating source",
        description:
          specialDescription ||
          "There was an error updating this source. Please try again.",
        variant: specialTitle ? "default" : "destructive",
      });
      setScrapingSourceId(null);
    },
  });

  // Scrape all sources mutation
  const scrapeAllSources = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth('/api/threat-tracker/scrape/all', {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Update started",
        description:
          "The system is now updating all active sources for threats.",
      });
      setScrapeJobRunning(true);
      // Start polling for status updates
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/scrape/status"],
      });
    },
    onError: (error) => {
      console.error("Error starting update:", error);
      toast({
        title: "Error starting update",
        description:
          "There was an error starting the update. Please try again.",
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

        const response = await fetchWithAuth("/api/threat-tracker/scrape/stop", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
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
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            "Stop request timed out. The update may still be stopping.",
          );
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
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/scrape/status"],
      });
    },
    onError: (error) => {
      console.error("Error stopping update:", error);
      toast({
        title: "Error stopping update",
        description:
          error instanceof Error
            ? error.message
            : "There was an error stopping the update. Please try again.",
        variant: "destructive",
      });
      // Force status check after error
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/scrape/status"],
      });
    },
    onSettled: () => {
      console.log("Stop mutation settled");
      // Reset any pending states
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["/api/threat-tracker/scrape/status"],
        });
      }, 1000);
    },
  });

  // Update auto-scrape settings mutation
  const updateAutoScrapeSettings = useMutation({
    mutationFn: async ({
      enabled,
      interval,
    }: AutoScrapeSettings): Promise<AutoScrapeSettings> => {
      const response = await fetchWithAuth('/api/threat-tracker/settings/auto-scrape', {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled, interval }),
      });
      return response.json();
    },
    onMutate: async ({ enabled, interval }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ["/api/threat-tracker/settings/auto-scrape"],
      });

      // Snapshot the previous values for potential rollback
      const previousSettings = queryClient.getQueryData<AutoScrapeSettings>([
        "/api/threat-tracker/settings/auto-scrape",
      ]);
      const previousLocalEnabled = localAutoScrapeEnabled;
      const previousLocalInterval = localAutoScrapeInterval;

      // Optimistically update the cache with new settings
      queryClient.setQueryData<AutoScrapeSettings>(
        ["/api/threat-tracker/settings/auto-scrape"],
        { enabled, interval },
      );

      // Update local state for immediate UI feedback
      setLocalAutoScrapeEnabled(enabled);
      setLocalAutoScrapeInterval(interval);

      return {
        previousSettings,
        previousLocalEnabled,
        previousLocalInterval,
      };
    },
    onError: (err, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousSettings) {
        queryClient.setQueryData<AutoScrapeSettings>(
          ["/api/threat-tracker/settings/auto-scrape"],
          context.previousSettings,
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
        description:
          "There was an error updating the settings. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables) => {
      // Update cache with actual server response
      queryClient.setQueryData<AutoScrapeSettings>(
        ["/api/threat-tracker/settings/auto-scrape"],
        data,
      );

      // Sync local state with server response
      setLocalAutoScrapeEnabled(data.enabled);
      setLocalAutoScrapeInterval(data.interval);

      toast({
        title: "Auto-update settings changed",
        description: data.enabled
          ? `Auto-update has been enabled with ${intervalLabels[data.interval as JobInterval] || "daily"} frequency.`
          : "Auto-update has been disabled.",
      });

      // Don't invalidate queries - rely on optimistic updates for better UX
    },
  });

  // Bulk add sources mutation
  const bulkAddSources = useMutation({
    mutationFn: async ({
      urls,
      options,
    }: {
      urls: string;
      options?: { concurrency?: number; timeout?: number };
    }) => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/sources/bulk-add", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls, options }),
          });

        if (!response.ok) {
          throw new Error(`Failed to bulk add sources: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error("Bulk add sources error:", error);
        throw error;
      }
    },
    onMutate: () => {
      setBulkAddInProgress(true);
    },
    onError: (error: any) => {
      setBulkAddInProgress(false);
      toast({
        title: "Bulk add failed",
        description:
          error.message || "Failed to add sources in bulk. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: async (data) => {
      setBulkAddInProgress(false);
      setBulkAddDialogOpen(false);
      setBulkUrlsInput("");

      const { summary, results } = data;

      // Add successful sources to local state immediately
      if (results.successful && results.successful.length > 0) {
        setLocalSources(prev => [...prev, ...results.successful]);
      }

      // Aggressive cache refresh to ensure UI updates
      await queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });

      // Force refetch to guarantee UI refresh
      const updatedSources = await queryClient.refetchQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });

      // Sync local state with fresh data from server
      if (updatedSources && updatedSources[0]?.data) {
        setLocalSources(updatedSources[0].data);
      }

      // Show detailed results
      if (summary.successful > 0) {
        toast({
          title: `Successfully added ${summary.successful} sources`,
          description:
            summary.failed > 0 || summary.duplicates > 0
              ? `${summary.failed} failed, ${summary.duplicates} duplicates skipped`
              : undefined,
        });
      }

      if (summary.failed > 0) {
        console.log("Failed sources:", results.failed);
      }
    },
  });

  // Bulk delete sources mutation
  const bulkDeleteSources = useMutation({
    mutationFn: async (sourceIds: string[]) => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/sources/bulk-delete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sourceIds }),
          });

        if (!response.ok) {
          throw new Error(
            `Failed to bulk delete sources: ${response.statusText}`,
          );
        }

        return await response.json();
      } catch (error) {
        console.error("Bulk delete sources error:", error);
        throw error;
      }
    },
    onMutate: async (sourceIds: string[]) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });

      // Snapshot previous data
      const previousSources = localSources;

      // Optimistically remove sources from local state
      setLocalSources((prev) =>
        prev.filter((source) => !sourceIds.includes(source.id)),
      );

      return { previousSources };
    },
    onError: (error: any, sourceIds, context) => {
      // Rollback optimistic update
      if (context?.previousSources) {
        setLocalSources(context.previousSources);
      }

      toast({
        title: "Bulk delete failed",
        description:
          error.message ||
          "Failed to delete sources in bulk. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      setSelectedSources(new Set());
      setIsBulkDeleteMode(false); // Auto-exit bulk delete mode

      const { summary, results } = data;

      if (summary.successful > 0) {
        toast({
          title: `Successfully deleted ${summary.successful} sources`,
          description:
            summary.failed > 0 || summary.notFound > 0
              ? `${summary.failed} failed, ${summary.notFound} not found`
              : undefined,
        });
      }

      if (summary.failed > 0) {
        console.log("Failed deletions:", results.failed);
      }

      // Refresh sources data
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/sources"],
      });
    },
  });

  // Helper functions for bulk operations
  const handleSelectSource = (sourceId: string, checked: boolean) => {
    const newSelected = new Set(selectedSources);
    if (checked) {
      newSelected.add(sourceId);
    } else {
      newSelected.delete(sourceId);
    }
    setSelectedSources(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allSourceIds = localSources.map((s) => s.id);
      setSelectedSources(new Set(allSourceIds));
    } else {
      setSelectedSources(new Set());
    }
  };

  const handleBulkAdd = () => {
    if (!bulkUrlsInput.trim()) {
      toast({
        title: "No URLs provided",
        description: "Please enter comma-separated URLs to add.",
        variant: "destructive",
      });
      return;
    }

    bulkAddSources.mutate({ urls: bulkUrlsInput });
  };

  const handleBulkDelete = () => {
    if (selectedSources.size === 0) {
      toast({
        title: "No sources selected",
        description: "Please select sources to delete.",
        variant: "destructive",
      });
      return;
    }

    bulkDeleteSources.mutate(Array.from(selectedSources));
  };

  const toggleBulkDeleteMode = () => {
    setIsBulkDeleteMode(!isBulkDeleteMode);
    // Clear selections when exiting bulk delete mode
    if (isBulkDeleteMode) {
      setSelectedSources(new Set());
    }
  };

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
      includeInAutoScrape: true,
    });
    setSourceDialogOpen(true);
  }

  // Handle toggle auto-scrape
  function handleToggleAutoScrape(enabled: boolean) {
    const currentInterval =
      localAutoScrapeInterval !== null
        ? localAutoScrapeInterval
        : autoScrapeSettings.data?.interval || JobInterval.DAILY;
    updateAutoScrapeSettings.mutate({
      enabled,
      interval: currentInterval,
    });
  }

  // Handle change auto-scrape interval
  function handleChangeAutoScrapeInterval(interval: JobInterval) {
    const currentEnabled =
      localAutoScrapeEnabled !== null
        ? localAutoScrapeEnabled
        : autoScrapeSettings.data?.enabled || false;
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
          articleCount: parseInt(errorData.articleCount || "0"),
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
          deleteArticles: true,
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
      const timeString = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 lg:gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Tracking Sources
          </h1>
          <p className="text-muted-foreground">
            Manage sources for threat monitoring and configure auto-update
            settings.
          </p>
        </div>


      </div>

      {/* Instructions Section */}
      <div className="mb-0">
        <Collapsible
          open={!isInstructionsCollapsed}
          onOpenChange={(open) => setIsInstructionsCollapsed(!open)}
        >
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 mb-0 bg-muted/50 hover:bg-muted/50 rounded-md p-1 -ml-1 w-full justify-start">
              {isInstructionsCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <ListChecks className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-medium text-muted-foreground">
                How to Use Threat Sources
              </h3>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 pl-6">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">
                    1. Configure Auto-Updates
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Enable automatic scanning to stay current with threats.
                    Choose hourly, daily, or weekly updates.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">
                    2. Manage Sources
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Default cybersecurity sources are provided. Add custom
                    sources or enable/disable existing ones.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">
                    3. Manual Updates
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Use "Scan All Sources Now" for immediate scanning or update
                    individual sources as needed.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">
                    4. Monitor Keywords
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Visit the Keywords page to manage threat terms, vendors, and
                    hardware for targeted monitoring.
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Auto-scrape settings card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Auto-Update Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic updates to stay on top of security
            vulnerabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="auto-scrape"
                checked={
                  localAutoScrapeEnabled !== null
                    ? localAutoScrapeEnabled
                    : autoScrapeSettings.data?.enabled || false
                }
                onCheckedChange={handleToggleAutoScrape}
                disabled={updateAutoScrapeSettings.isPending}
              />
              <div className="grid gap-0.5">
                <label
                  htmlFor="auto-scrape"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {(
                    localAutoScrapeEnabled !== null
                      ? localAutoScrapeEnabled
                      : autoScrapeSettings.data?.enabled || false
                  )
                    ? "Enabled"
                    : "Disabled"}
                </label>
                <p className="text-xs text-muted-foreground">
                  {(
                    localAutoScrapeEnabled !== null
                      ? localAutoScrapeEnabled
                      : autoScrapeSettings.data?.enabled || false
                  )
                    ? `Auto-scrape runs ${intervalLabels[(localAutoScrapeInterval !== null ? localAutoScrapeInterval : autoScrapeSettings.data?.interval) as JobInterval] || "daily"}`
                    : "Enable to automatically update sources for new threats"}
                </p>
              </div>
              {updateAutoScrapeSettings.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-primary ml-2" />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant={
                  (localAutoScrapeInterval !== null
                    ? localAutoScrapeInterval
                    : autoScrapeSettings.data?.interval) === JobInterval.HOURLY
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  handleChangeAutoScrapeInterval(JobInterval.HOURLY)
                }
                disabled={
                  !(localAutoScrapeEnabled !== null
                    ? localAutoScrapeEnabled
                    : autoScrapeSettings.data?.enabled) ||
                  updateAutoScrapeSettings.isPending
                }
              >
                {updateAutoScrapeSettings.isPending && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Hourly
              </Button>
              <Button
                variant={
                  (localAutoScrapeInterval !== null
                    ? localAutoScrapeInterval
                    : autoScrapeSettings.data?.interval) === JobInterval.DAILY
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  handleChangeAutoScrapeInterval(JobInterval.DAILY)
                }
                disabled={
                  !(localAutoScrapeEnabled !== null
                    ? localAutoScrapeEnabled
                    : autoScrapeSettings.data?.enabled) ||
                  updateAutoScrapeSettings.isPending
                }
              >
                {updateAutoScrapeSettings.isPending && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Daily
              </Button>
              <Button
                variant={
                  (localAutoScrapeInterval !== null
                    ? localAutoScrapeInterval
                    : autoScrapeSettings.data?.interval) === JobInterval.WEEKLY
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  handleChangeAutoScrapeInterval(JobInterval.WEEKLY)
                }
                disabled={
                  !(localAutoScrapeEnabled !== null
                    ? localAutoScrapeEnabled
                    : autoScrapeSettings.data?.enabled) ||
                  updateAutoScrapeSettings.isPending
                }
              >
                {updateAutoScrapeSettings.isPending && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Weekly
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            {scrapeJobRunning ? (
              <span className="flex items-center text-primary">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scan is currently running...
              </span>
            ) : null}
          </div>
        </CardFooter>
      </Card>

      {/* Sources card */}
      <Card>
        <CardHeader className="flex flex-row gap-4 items-center justify-between">
          <div className="flex flex-col gap-2">
            <CardDescription className="hidden sm:block">
              Websites to monitor for security threat information. Default
              sources are provided for all users and cannot be deleted, but can
              be enabled/disabled.
            </CardDescription>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              onClick={() => {
                if (scrapeJobRunning || checkScrapeStatus?.data?.running) {
                  stopScrapeJob.mutate();
                } else {
                  scrapeAllSources.mutate();
                }
              }}
              disabled={
                (scrapeAllSources.isPending && !stopScrapeJob.isPending) ||
                (stopScrapeJob.isPending && !scrapeAllSources.isPending) ||
                localSources.length === 0
              }
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
                ? "Stop Scan"
                : "Scan All Sources Now"}
            </Button>
          </div>
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
              {editingSource ? "Edit Source" : "Add New Source"}
            </DialogTitle>
            <DialogDescription>
              {editingSource
                ? "Update the source details below."
                : "Enter the details for your new threat source."}
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

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSourceDialogOpen(false);
                    setBulkAddDialogOpen(true);
                  }}
                  className="w-full sm:w-auto order-first sm:order-none"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Bulk Add Sources
                </Button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSourceDialogOpen(false)}
                    className="flex-1 sm:flex-none"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createSource.isPending || updateSource.isPending}
                    className="flex-1 sm:flex-none bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
                  >
                    {(createSource.isPending || updateSource.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingSource ? "Update" : "Add"} Source
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog for Sources with Articles */}
      <AlertDialog
        open={!!deleteConfirmation}
        onOpenChange={() => setDeleteConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Source with Associated Articles
            </AlertDialogTitle>
            <AlertDialogDescription>
              The source "{deleteConfirmation?.source.name}" has{" "}
              {deleteConfirmation?.articleCount} associated threat articles.
              <br />
              <br />
              Would you like to delete the associated articles as well? If you
              choose "No", the source will not be deleted.
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

      {/* Bulk Add Sources Dialog */}
      <Dialog open={bulkAddDialogOpen} onOpenChange={setBulkAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Bulk Add Sources</DialogTitle>
            <DialogDescription>
              Enter comma-separated URLs. Each URL will automatically get a
              title from the website.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="bulk-urls"
                className="text-sm font-medium mb-2 block"
              >
                URLs (comma-separated)
              </label>
              <Textarea
                id="bulk-urls"
                placeholder="https://example1.com, https://example2.com, https://example3.com"
                value={bulkUrlsInput}
                onChange={(e) => setBulkUrlsInput(e.target.value)}
                className="min-h-[120px]"
                disabled={bulkAddInProgress}
              />
              <p className="text-xs text-muted-foreground mt-2">
                URLs will be automatically normalized with https:// prefix if
                missing. Titles will be extracted from each website's metadata.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkAddDialogOpen(false)}
              disabled={bulkAddInProgress}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAdd}
              disabled={bulkAddInProgress || !bulkUrlsInput.trim()}
              className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
            >
              {bulkAddInProgress && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Sources
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <Button
            onClick={handleNewSource}
            className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Button>
        </div>
      );
    }

    // Separate default and user sources
    const defaultSources = localSources.filter((source) => source.isDefault);

    const userSources = localSources.filter((source) => !source.isDefault);

    console.log(localSources);
    console.log(defaultSources);

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
                <button className="flex items-center gap-2 mb-2 hover:bg-muted/50 rounded-md p-1 -ml-1 w-full justify-start">
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
                <div className="bg-muted/30 rounded-lg space-y-2 w-full max-w-full overflow-hidden">
                  {defaultSources
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((source) => (
                      <div
                        key={source.id}
                        className="flex flex-col gap-3 py-2 px-3 bg-background rounded-lg border w-full max-w-full"
                      >
                        <div className="flex items-center gap-3 min-w-0 w-full overflow-hidden">
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${source.includeInAutoScrape ? "bg-green-500" : "bg-gray-400"}`}
                          />
                          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 w-full">
                              <span className="font-medium text-sm truncate flex-1">
                                {source.name}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-xs px-1.5 py-0.5 flex-shrink-0"
                              >
                                Default
                              </Badge>
                            </div>
                            <div className="text-xs mt-0.5 w-full">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className=" flex items-center text-muted-foreground hover:underline text-xs min-w-0 max-w-full"
                              >
                                <span className="block max-w-full">
                                  {source.url.length > 35
                                    ? source.url.substring(0, 35) + "..."
                                    : source.url}
                                </span>
                                <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                updateSource.mutate({
                                  id: source.id,
                                  values: {
                                    name: source.name,
                                    url: source.url,
                                    includeInAutoScrape:
                                      !source.includeInAutoScrape,
                                  },
                                });
                              }}
                              disabled={updateSource.isPending}
                              className={`h-6 px-3 text-xs ${
                                source.includeInAutoScrape
                                  ? "text-white hover:opacity-80 border-[#BF00FF]"
                                  : "bg-gray-600 text-white hover:bg-gray-700 border-gray-600"
                              }`}
                              style={
                                source.includeInAutoScrape
                                  ? { backgroundColor: "#BF00FF" }
                                  : {}
                              }
                            >
                              {source.includeInAutoScrape
                                ? "Enabled"
                                : "Disabled"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                scrapeSingleSource.mutate(source.id)
                              }
                              disabled={
                                scrapeSingleSource.isPending &&
                                scrapingSourceId === source.id
                              }
                              className="h-6 px-2 text-xs"
                            >
                              {scrapeSingleSource.isPending &&
                              scrapingSourceId === source.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              <span className="hidden sm:inline ml-1">
                                Scan Now
                              </span>
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            <span className="font-medium">Last Scanned:</span>{" "}
                            {formatLastScraped(source.lastScraped)}
                          </div>
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
              {isBulkDeleteMode && (
                <Checkbox
                  checked={
                    userSources.length > 0 &&
                    userSources.every((s) => selectedSources.has(s.id))
                  }
                  onCheckedChange={handleSelectAll}
                  className="mr-1"
                />
              )}
              <h3 className="text-sm font-medium">Your Sources</h3>
              <Badge variant="outline" className="text-xs">
                {userSources.length} sources
              </Badge>

              {/* Action buttons */}
              <div className="ml-auto flex items-center gap-1">
                {/* Delete Selected Button */}
                {selectedSources.size > 0 && (
                  <Button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteSources.isPending}
                    size="sm"
                    variant="destructive"
                    className="h-8 px-3 text-xs mr-2"
                  >
                    {bulkDeleteSources.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Delete Selected
                  </Button>
                )}
                <button
                  onClick={handleNewSource}
                  className="group flex items-center justify-center w-8 h-8 rounded border border-slate-600 hover:border-[#BF00FF] hover:bg-[#BF00FF] hover:bg-opacity-10 transition-colors text-white opacity-60 hover:opacity-100 font-medium text-lg leading-none"
                  title="Add Source"
                >
                  +
                </button>
                <button
                  onClick={toggleBulkDeleteMode}
                  className={cn(
                    "group flex items-center justify-center w-8 h-8 rounded border transition-colors text-lg leading-none font-medium",
                    isBulkDeleteMode
                      ? "border-red-500 bg-red-500 bg-opacity-20 hover:bg-opacity-30 text-red-500"
                      : "border-slate-600 hover:border-[#BF00FF] hover:bg-[#BF00FF] hover:bg-opacity-10 text-white opacity-60 hover:opacity-100",
                  )}
                  title={
                    isBulkDeleteMode
                      ? "Exit Bulk Delete Mode"
                      : "Enter Bulk Delete Mode"
                  }
                >
                  −
                </button>
              </div>
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
      <div className="w-full max-w-full overflow-hidden space-y-3">
        {userSources
          .filter((s) => true)
          .map((source) => (
            <div
              key={source.id}
              className="flex flex-col gap-0 p-3 bg-background rounded-lg border w-full max-w-full"
            >
              {/* First row: Name, URL, and Edit/Delete buttons */}
              <div className="flex flex-col gap-2 w-full max-w-full overflow-hidden pb-2">
                <div className="flex items-start gap-3 min-w-0 w-full">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${source.includeInAutoScrape ? "bg-green-500" : "bg-gray-400"}`}
                  />
                  <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                    <div className="font-medium text-sm w-full">
                      {source.name}
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-muted-foreground hover:underline text-xs min-w-0 max-w-full"
                    >
                      <span className="truncate block max-w-full">
                        {source.url.length > 35
                          ? source.url.substring(0, 35) + "..."
                          : source.url}
                      </span>
                      <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>

                  {/* Right side: Auto badge and Edit/Delete buttons stacked */}
                  <div className="flex items-start gap-2 flex-shrink-0 justify-end">
                    {/* Edit/Delete buttons stacked vertically */}
                    <div className="flex flex-col gap-1 items-end ml-auto">
                      {isBulkDeleteMode ? (
                        <Checkbox
                          checked={selectedSources.has(source.id)}
                          onCheckedChange={(checked) =>
                            handleSelectSource(source.id, checked === true)
                          }
                        />
                      ) : source.isDefault ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="text-muted-foreground w-[20px] h-[20px] p-1 cursor-not-allowed"
                          title="Cannot delete default sources"
                        >
                          <PencilLine className="h-3 w-3" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive w-[20px] h-[20px] p-1"
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSource(source)}
                        className="w-[20px] h-[20px] p-1"
                      >
                        <PencilLine className="h-3 w-3" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Second row: Enable/Disable, Scan buttons, and Last Scanned */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full max-w-full">
                {/* Left side: Enable/Disable and Scan buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateSource.mutate({
                        id: source.id,
                        values: {
                          name: source.name,
                          url: source.url,
                          includeInAutoScrape: !source.includeInAutoScrape,
                        },
                      });
                    }}
                    disabled={updateSource.isPending}
                    className={`h-7 px-3 text-xs ${
                      source.includeInAutoScrape
                        ? "text-white hover:opacity-80 border-[#BF00FF]"
                        : "bg-gray-600 text-white hover:bg-gray-700 border-gray-600"
                    }`}
                    style={
                      source.includeInAutoScrape
                        ? { backgroundColor: "#BF00FF" }
                        : {}
                    }
                  >
                    {source.includeInAutoScrape ? "Enabled" : "Disabled"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scrapeSingleSource.mutate(source.id)}
                    disabled={
                      scrapingSourceId === source.id || scrapeJobRunning
                    }
                    className="h-7 px-2 text-xs flex-shrink-0"
                  >
                    {scrapingSourceId === source.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    <span className="ml-1">Scan Now</span>
                  </Button>
                </div>

                {/* Right side: Last Scanned */}
                <div className="text-xs text-muted-foreground truncate">
                  <span className="font-medium">Last Scanned:</span>{" "}
                  {formatLastScraped(source.lastScraped)}
                </div>
              </div>
            </div>
          ))}
      </div>
    );
  }
}
