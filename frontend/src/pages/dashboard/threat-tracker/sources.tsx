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
  X
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
        if (!response.ok) throw new Error('Failed to fetch auto-scrape settings')
        
        const data = await response.json()
        return data || { enabled: false, interval: JobInterval.DAILY }
      } catch(error) {
        console.error(error)
        return { enabled: false, interval: JobInterval.DAILY }
      }
    }
  });
  
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
        if (!response.ok) throw new Error('Failed to fetch scrape status')
        
        const data = await response.json()
        return data
      } catch(error) {
        console.error(error)
        return { running: false }
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

  // Create source mutation
  const createSource = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      return apiRequest("POST", `${serverUrl}/api/threat-tracker/sources`, values);
    },
    onSuccess: () => {
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
    onSuccess: () => {
      toast({
        title: "Source updated",
        description: "Your source has been updated successfully.",
      });
      setSourceDialogOpen(false);
      setEditingSource(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/sources`] });
    },
    onError: (error) => {
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
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `${serverUrl}/api/threat-tracker/sources/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Source deleted",
        description: "Your source has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/sources`] });
    },
    onError: (error) => {
      console.error("Error deleting source:", error);
      toast({
        title: "Error deleting source",
        description: "There was an error deleting your source. Please try again.",
        variant: "destructive",
      });
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
        title: "Source scraped",
        description: `Found ${data.articleCount || 0} new articles.`,
      });
      setScrapingSourceId(null);
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/sources`] });
    },
    onError: (error) => {
      console.error("Error scraping source:", error);
      toast({
        title: "Error scraping source",
        description: "There was an error scraping this source. Please try again.",
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
        description: "The system is now scraping all active sources for threats.",
      });
      setScrapeJobRunning(true);
      // Start polling for status updates
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`] });
    },
    onError: (error) => {
      console.error("Error starting scrape job:", error);
      toast({
        title: "Error starting scrape job",
        description: "There was an error starting the scrape job. Please try again.",
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
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`] });
    },
    onError: (error) => {
      console.error("Error stopping scrape job:", error);
      toast({
        title: "Error stopping scrape job",
        description: "There was an error stopping the scrape job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update auto-scrape settings mutation
  const updateAutoScrapeSettings = useMutation({
    mutationFn: async ({ enabled, interval }: AutoScrapeSettings) => {
      return apiRequest("PUT", `${serverUrl}/api/threat-tracker/settings/auto-scrape`, { enabled, interval });
    },
    onSuccess: (data) => {
      toast({
        title: "Auto-scrape settings updated",
        description: data.enabled 
          ? `Auto-scrape has been enabled with ${data.interval.toLowerCase()} frequency.`
          : "Auto-scrape has been disabled.",
      });
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/settings/auto-scrape`] });
    },
    onError: (error) => {
      console.error("Error updating auto-scrape settings:", error);
      toast({
        title: "Error updating settings",
        description: "There was an error updating auto-scrape settings. Please try again.",
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Sources</h1>
        <p className="text-muted-foreground">
          Manage sources for threat monitoring and configure auto-scrape settings.
        </p>
      </div>
      
      {/* Auto-scrape settings card */}
      <Card>
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
                checked={autoScrapeSettings.data?.enabled || false}
                onCheckedChange={handleToggleAutoScrape}
                disabled={updateAutoScrapeSettings.isPending}
              />
              <div className="grid gap-0.5">
                <label
                  htmlFor="auto-scrape"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {autoScrapeSettings.data?.enabled ? 'Enabled' : 'Disabled'}
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
                variant={autoScrapeSettings.data?.interval === JobInterval.HOURLY ? "default" : "outline"}
                size="sm"
                onClick={() => handleChangeAutoScrapeInterval(JobInterval.HOURLY)}
                disabled={!autoScrapeSettings.data?.enabled || updateAutoScrapeSettings.isPending}
              >
                Hourly
              </Button>
              <Button
                variant={autoScrapeSettings.data?.interval === JobInterval.DAILY ? "default" : "outline"}
                size="sm"
                onClick={() => handleChangeAutoScrapeInterval(JobInterval.DAILY)}
                disabled={!autoScrapeSettings.data?.enabled || updateAutoScrapeSettings.isPending}
                className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
              >
                Daily
              </Button>
              <Button
                variant={autoScrapeSettings.data?.interval === JobInterval.WEEKLY ? "default" : "outline"}
                size="sm"
                onClick={() => handleChangeAutoScrapeInterval(JobInterval.WEEKLY)}
                disabled={!autoScrapeSettings.data?.enabled || updateAutoScrapeSettings.isPending}
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
                {stopScrapeJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Stop Scraping
              </Button>
            ) : (
              <Button 
                variant="default" 
                onClick={() => scrapeAllSources.mutate()}
                disabled={scrapeAllSources.isPending || localSources.length === 0}
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
              Websites to monitor for security threat information
            </CardDescription>
          </div>
          <Button onClick={handleNewSource} disabled={createSource.isPending} className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]">
            {createSource.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Source
          </Button>
        </CardHeader>
        <CardContent>
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
                  {editingSource ? 'Update' : 'Add'} Source
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
          <Button onClick={handleNewSource} className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]">
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Button>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:mx-0">
        <div className="px-3 sm:px-4 lg:px-0 min-w-[400px] sm:min-w-[280px]">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-300 w-[25%] sm:w-[25%] md:w-[20%] text-xs sm:text-sm">Name</TableHead>
                <TableHead className="text-slate-300 w-[25%] sm:w-[35%] md:w-[30%] text-xs sm:text-sm">URL</TableHead>
                <TableHead className="text-slate-300 w-[25%] sm:w-[15%] md:w-[15%] text-xs sm:text-sm">Status</TableHead>
                <TableHead className="text-slate-300 w-[0%] sm:w-[0%] md:w-[0%] lg:w-[15%] text-xs sm:text-sm hidden lg:table-cell">Last Scraped</TableHead>
                <TableHead className="text-slate-300 w-[25%] sm:w-[25%] md:w-[20%] text-right text-xs sm:text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localSources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium text-white w-[25%] sm:w-[25%] md:w-[20%] p-2 sm:p-4">
                    <div className="overflow-hidden min-w-0">
                      <span className="truncate text-xs sm:text-sm min-w-0 block">{source.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="w-[25%] sm:w-[35%] md:w-[30%] p-2 sm:p-4">
                    <div className="overflow-hidden min-w-0">
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-slate-300 hover:text-primary transition-colors min-w-0"
                      >
                        <span className="truncate text-xs sm:text-sm min-w-0">
                          {source.url.replace(/^https?:\/\/(www\.)?/, '')}
                        </span>
                        <ExternalLink className="ml-1 h-2 w-2 sm:h-2.5 sm:w-2.5 text-slate-500 flex-shrink-0" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="w-[25%] sm:w-[15%] md:w-[15%] p-1 sm:p-4">
                    <div className="flex flex-col gap-0.5 min-w-0 items-start">
                      {source.active ? (
                        <Badge variant="default" className="flex items-center gap-0.5 bg-green-500 text-[10px] sm:text-xs px-1.5 py-0.5 h-5 sm:h-5 w-fit flex-shrink-0">
                          <Check className="h-1.5 w-1.5 sm:h-2 sm:w-2" />
                          <span>Active</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-0.5 text-muted-foreground text-[10px] sm:text-xs px-1.5 py-0.5 h-5 sm:h-5 w-fit flex-shrink-0">
                          <X className="h-1.5 w-1.5 sm:h-2 sm:w-2" />
                          <span>Inactive</span>
                        </Badge>
                      )}
                      {source.includeInAutoScrape && source.active && (
                        <Badge variant="outline" className="flex items-center gap-0.5 text-[10px] sm:text-xs px-1.5 py-0.5 h-5 sm:h-5 w-fit flex-shrink-0">
                          <RotateCw className="h-1.5 w-1.5 sm:h-2 sm:w-2" />
                          <span>Auto</span>
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell w-[0%] sm:w-[0%] md:w-[0%] lg:w-[15%] p-2 sm:p-4 text-xs text-slate-400">
                    {formatLastScraped(source.lastScraped)}
                  </TableCell>
                  <TableCell className="text-right w-[25%] sm:w-[25%] md:w-[20%] p-1 sm:p-4 align-top">
                    {/* Mobile Layout - Stacked vertically */}
                    <div className="flex flex-col gap-1 items-end sm:hidden min-w-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => scrapeSingleSource.mutate(source.id)}
                        disabled={
                          !source.active || 
                          scrapingSourceId === source.id || 
                          scrapeJobRunning
                        }
                        className="h-6 w-6 rounded-full text-slate-400 hover:text-[#00FFFF] hover:bg-[#00FFFF]/10 p-1 flex-shrink-0"
                        title="Scrape source"
                      >
                        {scrapingSourceId === source.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditSource(source)}
                        className="h-6 w-6 rounded-full text-slate-400 hover:text-[#00FFFF] hover:bg-[#00FFFF]/10 p-1 flex-shrink-0"
                        title="Edit source"
                      >
                        <PencilLine className="h-3 w-3" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 p-1 flex-shrink-0"
                            title="Delete source"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the source "{source.name}".
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteSource.mutate(source.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    
                    {/* Desktop Layout - Horizontal */}
                    <div className="hidden sm:flex flex-row justify-end items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => scrapeSingleSource.mutate(source.id)}
                        disabled={
                          !source.active || 
                          scrapingSourceId === source.id || 
                          scrapeJobRunning
                        }
                        className="h-fit w-fit rounded-full text-slate-400 hover:text-[#00FFFF] hover:bg-[#00FFFF]/10 p-2"
                        title="Scrape source"
                      >
                        {scrapingSourceId === source.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditSource(source)}
                        className="h-fit w-fit rounded-full text-slate-400 hover:text-[#00FFFF] hover:bg-[#00FFFF]/10 p-2"
                        title="Edit source"
                      >
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-fit w-fit rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 p-2"
                            title="Delete source"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the source "{source.name}".
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteSource.mutate(source.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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