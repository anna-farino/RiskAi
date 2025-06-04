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
} from "lucide-react";

// Enum for auto-scrape intervals
export enum JobInterval {
  HOURLY = "HOURLY",
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  DISABLED = "DISABLED",
}

// Type for auto-scrape settings
type AutoScrapeSettings = {
  enabled: boolean;
  interval: JobInterval;
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

  // Fetch sources with refetch on window focus for navigation remounting
  const sources = useQuery<ThreatSource[]>({
    queryKey: [`${serverUrl}/api/threat-tracker/sources`],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${serverUrl}/api/threat-tracker/sources`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              ...csfrHeaderObject(),
            },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch sources");

        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return []; // Return empty array instead of undefined to prevent errors
      }
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when returning to page
    refetchOnMount: true, // Always refetch on component mount
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
        const response = await fetch(
          `${serverUrl}/api/threat-tracker/settings/auto-scrape`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              ...csfrHeaderObject(),
            },
          },
        );
        if (!response.ok)
          throw new Error("Failed to fetch auto-scrape settings");

        const data = await response.json();
        return data || { enabled: false, interval: JobInterval.DAILY };
      } catch (error) {
        console.error(error);
        return { enabled: false, interval: JobInterval.DAILY };
      }
    },
  });

  // Check scrape job status
  const checkScrapeStatus = useQuery<{ running: boolean }>({
    queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${serverUrl}/api/threat-tracker/scrape/status`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              ...csfrHeaderObject(),
            },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch scrape status");

        const data = await response.json();
        return data;
      } catch (error) {
        console.error(error);
        return { running: false };
      }
    },
    refetchInterval: scrapeJobRunning ? 5000 : false, // Poll every 5 seconds when job is running
  });

  // Update scrapeJobRunning state when status changes
  useEffect(() => {
    if (checkScrapeStatus.data) {
      setScrapeJobRunning(checkScrapeStatus.data.running);
    }
  }, [checkScrapeStatus.data]);

  // Sync local auto-scrape state with query data
  useEffect(() => {
    if (autoScrapeSettings.data && localAutoScrapeEnabled === null) {
      setLocalAutoScrapeEnabled(autoScrapeSettings.data.enabled);
    }
  }, [autoScrapeSettings.data, localAutoScrapeEnabled]);

  // Create source mutation with optimistic updates
  const createSource = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      return apiRequest(
        "POST",
        `${serverUrl}/api/threat-tracker/sources`,
        values,
      );
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
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/sources`],
      });
    },
    onError: (error, _, context) => {
      // Rollback optimistic update
      if (context?.optimisticSource) {
        setLocalSources((prev) =>
          prev.filter((source) => source.id !== context.optimisticSource.id),
        );
      }
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
      return apiRequest(
        "PUT",
        `${serverUrl}/api/threat-tracker/sources/${id}`,
        values,
      );
    },
    onSuccess: () => {
      toast({
        title: "Source updated",
        description: "Your source has been updated successfully.",
      });
      setSourceDialogOpen(false);
      setEditingSource(null);
      form.reset();
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/sources`],
      });
    },
    onError: (error) => {
      console.error("Error updating source:", error);
      toast({
        title: "Error updating source",
        description:
          "There was an error updating your source. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete source mutation with optimistic updates
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
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/sources`],
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
      return apiRequest(
        "POST",
        `${serverUrl}/api/threat-tracker/scrape/source/${id}`,
      );
    },
    onSuccess: (data) => {
      toast({
        title: "Source scraped",
        description: `Found ${data.articleCount || 0} new articles.`,
      });
      setScrapingSourceId(null);
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/sources`],
      });
    },
    onError: (error) => {
      console.error("Error scraping source:", error);
      toast({
        title: "Error scraping source",
        description:
          "There was an error scraping this source. Please try again.",
        variant: "destructive",
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
        title: "Scrape job started",
        description:
          "The system is now scraping all active sources for threats.",
      });
      setScrapeJobRunning(true);
      // Start polling for status updates
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`],
      });
    },
    onError: (error) => {
      console.error("Error starting scrape job:", error);
      toast({
        title: "Error starting scrape job",
        description:
          "There was an error starting the scrape job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stop scrape job mutation
  const stopScrapeJob = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `${serverUrl}/api/threat-tracker/scrape/stop`);
    },
    onSuccess: () => {
      toast({
        title: "Scrape job stopped",
        description: "The scrape job has been stopped.",
      });
      setScrapeJobRunning(false);
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`],
      });
    },
    onError: (error) => {
      console.error("Error stopping scrape job:", error);
      toast({
        title: "Error stopping scrape job",
        description:
          "There was an error stopping the scrape job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update auto-scrape settings mutation
  const updateAutoScrapeSettings = useMutation({
    mutationFn: async ({ enabled, interval }: AutoScrapeSettings) => {
      return apiRequest(
        "PUT",
        `${serverUrl}/api/threat-tracker/settings/auto-scrape`,
        { enabled, interval },
      );
    },
    onMutate: async ({ enabled, interval }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/settings/auto-scrape`],
      });

      // Get snapshot of current data
      const previousSettings = queryClient.getQueryData<AutoScrapeSettings>([
        `${serverUrl}/api/threat-tracker/settings/auto-scrape`,
      ]);
      const previousLocalEnabled = localAutoScrapeEnabled;

      // Immediately update local state for instant UI feedback
      setLocalAutoScrapeEnabled(enabled);

      // Optimistically update the cache
      queryClient.setQueryData<AutoScrapeSettings>(
        [`${serverUrl}/api/threat-tracker/settings/auto-scrape`],
        {
          enabled,
          interval:
            interval ||
            (previousSettings && "interval" in previousSettings
              ? previousSettings.interval
              : JobInterval.DAILY),
        },
      );

      return { previousSettings, previousLocalEnabled };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousSettings) {
        queryClient.setQueryData<AutoScrapeSettings>(
          [`${serverUrl}/api/threat-tracker/settings/auto-scrape`],
          context.previousSettings,
        );
      }
      if (context?.previousLocalEnabled !== undefined) {
        setLocalAutoScrapeEnabled(context.previousLocalEnabled);
      }
      toast({
        title: "Error updating settings",
        description:
          "There was an error updating auto-scrape settings. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      // Sync local state with server response
      setLocalAutoScrapeEnabled(data.enabled);
      toast({
        title: "Auto-scrape settings updated",
        description: data.enabled
          ? `Auto-scrape has been enabled with ${data.interval.toLowerCase()} frequency.`
          : "Auto-scrape has been disabled.",
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
    if (autoScrapeSettings.data) {
      updateAutoScrapeSettings.mutate({
        enabled,
        interval: autoScrapeSettings.data.interval,
      });
    }
  }

  // Handle change auto-scrape interval
  function handleChangeAutoScrapeInterval(interval: JobInterval) {
    if (autoScrapeSettings.data) {
      updateAutoScrapeSettings.mutate({
        enabled: autoScrapeSettings.data.enabled,
        interval,
      });
    }
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
      return d.toLocaleString();
    } catch {
      return "Unknown";
    }
  }

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
    const defaultSources = localSources.filter(source => source.isDefault);
    const userSources = localSources.filter(source => !source.isDefault);

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
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  {defaultSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between py-2 px-3 bg-background rounded border">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${source.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{source.name}</span>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">Default</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {source.url}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-xs text-muted-foreground">
                          {formatLastScraped(source.lastScraped)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => scrapeSingleSource.mutate(source.id)}
                          disabled={scrapeSingleSource.isPending && scrapingSourceId === source.id}
                          className="h-7 w-7 p-0"
                        >
                          {scrapeSingleSource.isPending && scrapingSourceId === source.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Globe className="h-3 w-3" />
                          )}
                          <span className="sr-only">Scrape</span>
                        </Button>
                        <Switch
                          checked={source.active}
                          onCheckedChange={(checked) => 
                            updateSource.mutate({
                              id: source.id,
                              values: {
                                name: source.name,
                                url: source.url,
                                active: checked,
                                includeInAutoScrape: source.includeInAutoScrape
                              }
                            })
                          }
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
      <div className="w-full overflow-x-auto">
        <div className="min-w-full">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%] min-w-[120px]">Name</TableHead>
                <TableHead className="w-[35%] min-w-[180px]">URL</TableHead>
                <TableHead className="w-[15%] min-w-[100px]">Status</TableHead>
                <TableHead className="w-[15%] min-w-[100px]">
                  Last Scraped
                </TableHead>
                <TableHead className="w-[10%] min-w-[80px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userSources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium truncate pr-2">
                    {source.name}
                  </TableCell>
                  <TableCell className="pr-2">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-primary hover:underline truncate"
                    >
                      <span className="truncate">
                        {source.url.length > 30
                          ? source.url.substring(0, 30) + "..."
                          : source.url}
                      </span>
                      <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="pr-2">
                    <div className="flex flex-col gap-1">
                      {source.active ? (
                        <Badge
                          variant="default"
                          className="flex items-center gap-1 bg-green-500 text-xs px-1 py-0.5 w-fit"
                        >
                          <Check className="h-2 w-2" />
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 text-muted-foreground text-xs px-1 py-0.5 w-fit"
                        >
                          <X className="h-2 w-2" />
                          Inactive
                        </Badge>
                      )}
                      {source.includeInAutoScrape && source.active && (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 text-xs px-1 py-0.5 w-fit"
                        >
                          <RotateCw className="h-2 w-2" />
                          Auto
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs truncate pr-2">
                    {formatLastScraped(source.lastScraped)}
                  </TableCell>
                  <TableCell className="text-right pr-0">
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
                        className="h-7 px-2 text-xs"
                      >
                        {scrapingSourceId === source.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline ml-1">Scrape</span>
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Threat Sources</h1>
          <p className="text-muted-foreground">
            Manage threat intelligence data sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleNewSource} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Auto-scrape Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Auto-Scrape Settings</CardTitle>
          <CardDescription>
            Configure automatic scraping for all active sources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-scrape"
              checked={autoScrapeSettings.data?.enabled ?? false}
              onCheckedChange={handleToggleAutoScrape}
            />
            <label htmlFor="auto-scrape" className="text-sm font-medium">
              Enable automatic scraping
            </label>
          </div>
          {autoScrapeSettings.data?.enabled && autoScrapeSettings.data && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Scrape Interval</label>
              <Select
                value={autoScrapeSettings.data.interval}
                onValueChange={(value) =>
                  handleChangeAutoScrapeInterval(value as JobInterval)
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={JobInterval.HOURLY}>Hourly</SelectItem>
                  <SelectItem value={JobInterval.DAILY}>Daily</SelectItem>
                  <SelectItem value={JobInterval.WEEKLY}>Weekly</SelectItem>
                  <SelectItem value={JobInterval.DISABLED}>
                    Disabled
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sources Display */}
      {renderSourcesTable()}

      {/* Add/Edit Source Dialog */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingSource ? "Edit Source" : "Add New Source"}
            </DialogTitle>
            <DialogDescription>
              {editingSource
                ? "Update the threat source details"
                : "Add a new threat intelligence source"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Security News Blog"
                        {...field}
                      />
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
                      <Input
                        placeholder="https://example.com"
                        type="url"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable this source for monitoring
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
                      <FormLabel>Include in Auto-Scrape</FormLabel>
                      <FormDescription>
                        Include this source in automatic scraping
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
              <DialogFooter>
                <Button type="submit" disabled={createSource.isPending || updateSource.isPending}>
                  {(createSource.isPending || updateSource.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingSource ? "Update" : "Add"} Source
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

    if (sources.error) {
      return (
        <div className="flex justify-center py-8 text-destructive">
          Error loading sources: {sources.error.message}
        </div>
      );
    }

    if (!sources.data || sources.data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Globe className="h-12 w-12 mb-4 opacity-50" />
          <p>No sources configured yet</p>
          <p className="text-sm">Add your first source to start monitoring threats</p>
        </div>
      );
    }

    // Separate default and user sources
    const defaultSources = sources.data.filter(source => source.isDefault);
    const userSources = sources.data.filter(source => !source.isDefault);

    return (
      <div className="space-y-6">
        {/* Default Sources Section - Collapsible */}
        {defaultSources.length > 0 && (
          <Collapsible 
            open={!isDefaultSourcesCollapsed} 
            onOpenChange={setIsDefaultSourcesCollapsed}
          >
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between p-0 h-auto hover:bg-transparent"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Default Sources</span>
                  <Badge variant="secondary" className="text-xs">
                    {defaultSources.length}
                  </Badge>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                  isDefaultSourcesCollapsed ? "rotate-180" : ""
                }`} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {defaultSources.map((source) => (
                  <Card key={source.id} className="border-l-4 border-l-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate">{source.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                          <div className="flex items-center gap-1 mt-2">
                            <Badge 
                              variant={source.active ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {source.active ? "Active" : "Inactive"}
                            </Badge>
                            {source.includeInAutoScrape && (
                              <Badge variant="outline" className="text-xs">
                                Auto-scrape
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleSource(source)}
                            disabled={updateSource.isPending}
                            className="h-8 w-8 p-0"
                          >
                            {updateSource.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : source.active ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleScrapeSource(source)}
                            disabled={scrapingSourceId === source.id || !source.active}
                            className="h-8 w-8 p-0"
                          >
                            {scrapingSourceId === source.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Globe className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* User Sources Section */}
        {userSources.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold">My Sources</h3>
              <Badge variant="outline">{userSources.length}</Badge>
            </div>
            {renderUserSourcesTable(userSources)}
          </div>
        )}

        {/* Show message when only default sources exist */}
        {userSources.length === 0 && defaultSources.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>You haven't created any custom sources yet.</p>
            <p className="text-sm">Click "Add Source" to create your first custom threat source.</p>
          </div>
        )}
      </div>
    );
  }

  function renderUserSourcesTable(userSources: ThreatSource[]) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Scraped</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userSources.map((source) => (
              <TableRow key={source.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{source.name}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">
                      {source.url}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge 
                      variant={source.active ? "default" : "secondary"}
                      className="w-fit"
                    >
                      {source.active ? "Active" : "Inactive"}
                    </Badge>
                    {source.includeInAutoScrape && (
                      <Badge variant="outline" className="w-fit text-xs">
                        Auto-scrape
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {formatLastScraped(source.lastScrapedAt)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {threatArticles.data?.filter(
                      (article) => article.sourceId === source.id
                    ).length || 0}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleScrapeSource(source)}
                      disabled={scrapingSourceId === source.id || !source.active}
                    >
                      {scrapingSourceId === source.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Globe className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSource(source)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSource(source)}
                      disabled={deleteSource.isPending}
                    >
                      {deleteSource.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sources</h1>
          <p className="text-muted-foreground">
            Manage sources for threat monitoring and configure auto-scrape settings.
          </p>
        </div>
        <Button
          onClick={handleNewSource}
          disabled={createSource.isPending}
          className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
        >
          {createSource.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Add Source
        </Button>
      </div>

      {/* Auto-scrape settings card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Auto-Scrape Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic scraping of threat sources to stay updated on security vulnerabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="auto-scrape"
                checked={
                  localAutoScrapeEnabled ??
                  autoScrapeSettings.data?.enabled ??
                  false
                }
                onCheckedChange={handleToggleAutoScrape}
                disabled={updateAutoScrapeSettings.isPending}
              />
              <div className="grid gap-0.5">
                <label
                  htmlFor="auto-scrape"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {(localAutoScrapeEnabled ?? autoScrapeSettings.data?.enabled)
                    ? "Enabled"
                    : "Disabled"}
                </label>
                <p className="text-xs text-muted-foreground">
                  {autoScrapeSettings.data?.enabled
                    ? `Auto-scrape runs ${autoScrapeSettings.data?.interval.toLowerCase()}`
                    : "Enable to automatically scrape sources for new threats"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={
                  autoScrapeSettings.data?.interval === JobInterval.HOURLY
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  handleChangeAutoScrapeInterval(JobInterval.HOURLY)
                }
                disabled={
                  !autoScrapeSettings.data?.enabled ||
                  updateAutoScrapeSettings.isPending
                }
              >
                Hourly
              </Button>
              <Button
                variant={
                  autoScrapeSettings.data?.interval === JobInterval.DAILY
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  handleChangeAutoScrapeInterval(JobInterval.DAILY)
                }
                disabled={
                  !autoScrapeSettings.data?.enabled ||
                  updateAutoScrapeSettings.isPending
                }
                className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
              >
                Daily
              </Button>
              <Button
                variant={
                  autoScrapeSettings.data?.interval === JobInterval.WEEKLY
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  handleChangeAutoScrapeInterval(JobInterval.WEEKLY)
                }
                disabled={
                  !autoScrapeSettings.data?.enabled ||
                  updateAutoScrapeSettings.isPending
                }
              >
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
                Scrape job is currently running...
              </span>
            ) : (
              <span>
                Manual scrape allows you to immediately check for new threats
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {scrapeJobRunning ? (
              <Button
                variant="outline"
                onClick={() => stopScrapeJob.mutate()}
                disabled={stopScrapeJob.isPending}
              >
                {stopScrapeJob.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Stop Scraping
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={() => scrapeAllSources.mutate()}
                disabled={
                  scrapeAllSources.isPending || localSources.length === 0
                }
                className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
              >
                {scrapeAllSources.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Scrape All Sources
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Sources card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Threat Sources</CardTitle>
            <CardDescription>
              Websites to monitor for security threat information. Default sources are provided for all users and cannot be deleted, but can be enabled/disabled.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>{renderSourcesTable()}</CardContent>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Inactive sources won't be scraped
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
                        <FormLabel>Auto-Scrape</FormLabel>
                        <FormDescription>
                          Include in automatic scraping
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
                  {editingSource ? "Update" : "Add"} Source
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
}
