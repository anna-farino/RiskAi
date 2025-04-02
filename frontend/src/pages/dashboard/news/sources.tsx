import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { Source, insertSourceSchema } from "@shared/db/schema/news-tracker/index";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Link2, Globe, Plus, RotateCw, Check, X, Clock, Settings, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { serverUrl } from "@/utils/server-url";
import { cn } from "@/lib/utils";

// Define the JobInterval enum matching the server-side enum
enum JobInterval {
  HOURLY = 60 * 60 * 1000,
  TWICE_DAILY = 12 * 60 * 60 * 1000,
  DAILY = 24 * 60 * 60 * 1000,
  WEEKLY = 7 * 24 * 60 * 60 * 1000
}

// Convert enum to human-readable labels
const intervalLabels: Record<JobInterval, string> = {
  [JobInterval.HOURLY]: "Hourly",
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
          credentials: 'include'
        })
        if (!response.ok) throw new Error()
        
        const data = await response.json()
        return data || []
      } catch(error) {
        console.error((error))
      }
    }
  });
  console.log(sources.data)
  
  // Get auto-scrape settings
  const autoScrapeSettings = useQuery<AutoScrapeSettings>({
    queryKey: ["/api/news-tracker/settings/auto-scrape"],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/settings/auto-scrape`, {
          method: 'GET',
          credentials: 'include'
        })
        if (!response.ok) throw new Error()
        
        const data = await response.json()
        return data || []
      } catch(error) {
        console.error((error))
      }
    },
    placeholderData: { 
      enabled: false, 
      interval: JobInterval.DAILY 
    }
  });

  const addSource = useMutation({
    mutationFn: async (data: { url: string; name: string }) => {
      await apiRequest("POST", `${serverUrl}/api/news-tracker/sources`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/sources"] });
      form.reset();
      toast({
        title: "Source added successfully",
      });
    },
  });

  const scrapeSource = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `${serverUrl}/api/news-tracker/sources/${id}/scrape`);
    },
    onSuccess: () => {
      toast({
        title: "Source scraped successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
    },
  });

  const stopScraping = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `${serverUrl}/api/news-tracker/sources/${id}/stop`);
    },
    onSuccess: () => {
      toast({
        title: "Scraping stopped successfully",
      });
    },
  });
  
  // Toggle auto-scrape inclusion for a source
  const toggleAutoScrape = useMutation({
    mutationFn: async ({ id, include }: { id: string, include: boolean }) => {
      await apiRequest("PATCH", `${serverUrl}/api/news-tracker/sources/${id}/auto-scrape`, {
        includeInAutoScrape: include
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/sources"] });
      toast({
        title: "Auto-scrape settings updated",
      });
    },
  });
  
  // Run global scrape job manually
  const runGlobalScrape = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `${serverUrl}/api/news-tracker/jobs/scrape`);
    },
    onSuccess: () => {
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
            queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/articles"] });
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
      await apiRequest("POST", `${serverUrl}/api/settings/auto-scrape`, {
        enabled, 
        interval
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/auto-scrape"] });
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
      <div className="flex flex-col gap-5 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">Sources</h1>
            <p className="text-slate-300">Manage news sources and control web scraping operations</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-slate-700 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Auto-Scrape Settings
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
                      <SelectTrigger id="schedule-select" className="bg-white/5 border-slate-700 text-white">
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
            
            <Button 
              onClick={() => runGlobalScrape.mutate()}
              disabled={runGlobalScrape.isPending}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              {runGlobalScrape.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Auto-Scrape Now
            </Button>
          </div>
        </div>
        
        {/* Scheduled status indicator */}
        { autoScrapeSettings.data?.enabled && autoScrapeSettings.data?.interval && (
          <div className="flex items-center p-3 bg-primary/10 rounded-lg text-sm border border-primary/20">
            <Clock className="h-4 w-4 text-primary mr-2" />
            <span className="text-white">
              Auto-scrape is scheduled to run <span className="text-primary font-medium">
                {intervalLabels[autoScrapeSettings.data.interval as JobInterval]}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-medium text-white">Add News Source</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Source Name</label>
                <Input
                  placeholder="E.g., Tech News Daily"
                  {...form.register("name")}
                  className="bg-white/5 border-slate-700/50 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Source URL</label>
                <Input
                  placeholder="https://example.com"
                  {...form.register("url")}
                  className="bg-white/5 border-slate-700/50 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={addSource.isPending}
                className="bg-primary hover:bg-primary/90"
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

        <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-medium text-white mb-3">Quick Tips</h2>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2 text-slate-300">
                <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>Add reliable news sources with well-structured content for best results</span>
              </li>
              <li className="flex gap-2 text-slate-300">
                <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>The scraper works with static and dynamic sites including React-based ones</span>
              </li>
              <li className="flex gap-2 text-slate-300">
                <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>Configure auto-scrape settings to automatically collect new content on a schedule</span>
              </li>
              <li className="flex gap-2 text-slate-300">
                <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>Toggle which sources to include in the auto-scrape process using the switches</span>
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
        "bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden",
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
            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Globe className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No sources added</h3>
            <Button 
              className=""
              onClick={() => sources.refetch()}
            >
                Fetch Sources
            </Button>
            <p className="text-slate-400 max-w-md">
              Add your first news source above to start scraping articles
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-white/5">
                  <TableHead className="text-slate-300">Source</TableHead>
                  <TableHead className="text-slate-300">URL</TableHead>
                  <TableHead className="text-slate-300">Auto-Scrape</TableHead>
                  <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.data?.map((source) => (
                  <TableRow key={source.id} className="border-slate-700/50 hover:bg-white/5">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Globe className="h-4 w-4 text-primary" />
                        </div>
                        {source.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-slate-500" />
                        <a 
                          href={source.url} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-300 hover:text-primary transition-colors truncate max-w-[300px]"
                        >
                          {source.url}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`auto-scrape-${source.id}`}
                          checked={source.includeInAutoScrape || false}
                          onCheckedChange={(checked) => 
                            toggleAutoScrape.mutate({ id: source.id, include: checked })
                          }
                          disabled={toggleAutoScrape.isPending}
                        />
                        <Label htmlFor={`auto-scrape-${source.id}`} className="text-slate-300">
                          {source.includeInAutoScrape ? "Included" : "Excluded"}
                        </Label>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => scrapeSource.mutate(source.id)}
                          disabled={scrapeSource.isPending}
                          className="border-slate-700 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        >
                          {scrapeSource.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCw className="mr-2 h-4 w-4" />
                          )}
                          Scrape
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => stopScraping.mutate(source.id)}
                          disabled={stopScraping.isPending}
                          className="border-red-900/50 bg-red-950/20 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                        >
                          {stopScraping.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <X className="mr-2 h-4 w-4" />
                          )}
                          Stop
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
