import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import React from "react";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { apiRequest } from "@/lib/query-client";
import { serverUrl } from "@/utils/server-url";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Plus, 
  RefreshCw, 
  Settings, 
  Trash2, 
  PencilLine, 
  ExternalLink, 
  Check, 
  X, 
  RotateCw,
  Loader2,
  Target,
  Clock
} from "lucide-react";

// Define the source form schema
const sourceFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Please enter a valid URL"),
  description: z.string().optional(),
  active: z.boolean(),
  includeInAutoScrape: z.boolean(),
});

type ThreatSource = {
  id: string;
  name: string;
  url: string;
  description?: string;
  active: boolean;
  includeInAutoScrape: boolean;
  lastScraped?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export enum JobInterval {
  HOURLY = "HOURLY",
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  DISABLED = "DISABLED",
}

type AutoScrapeSettings = {
  enabled: boolean;
  interval: JobInterval;
};

type SourceFormValues = z.infer<typeof sourceFormSchema>;

export default function Sources() {
  const [editingSource, setEditingSource] = useState<ThreatSource | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [scrapingSourceId, setScrapingSourceId] = useState<string | null>(null);
  const [localSources, setLocalSources] = useState<ThreatSource[]>([]);
  const [autoScrapeSettings, setAutoScrapeSettings] = useState<AutoScrapeSettings>({
    enabled: false,
    interval: JobInterval.DAILY,
  });

  const form = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      active: true,
      includeInAutoScrape: false,
    },
  });

  // Queries
  const { data: sources = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/threat-tracker/sources'],
    queryFn: async () => {
      const response = await fetch(`${serverUrl()}/api/threat-tracker/sources`, {
        headers: {
          ...csfrHeaderObject(),
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch sources');
      return response.json();
    },
  });

  const { data: scrapeJobRunning = false } = useQuery({
    queryKey: ['/api/threat-tracker/scrape-job-status'],
    queryFn: async () => {
      const response = await fetch(`${serverUrl()}/api/threat-tracker/scrape-job-status`, {
        headers: {
          ...csfrHeaderObject(),
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch scrape job status');
      const data = await response.json();
      return data.running || false;
    },
    refetchInterval: 2000,
  });

  const { data: autoScrapeSettingsData } = useQuery({
    queryKey: ['/api/threat-tracker/auto-scrape-settings'],
    queryFn: async () => {
      const response = await fetch(`${serverUrl()}/api/threat-tracker/auto-scrape-settings`, {
        headers: {
          ...csfrHeaderObject(),
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch auto-scrape settings');
      return response.json();
    },
  });

  // Mutations
  const createSource = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      return apiRequest('/api/threat-tracker/sources', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/sources'] });
      setIsFormOpen(false);
      form.reset();
    },
  });

  const updateSource = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SourceFormValues }) => {
      return apiRequest(`/api/threat-tracker/sources/${id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/sources'] });
      setIsFormOpen(false);
      setEditingSource(null);
      form.reset();
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/threat-tracker/sources/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/sources'] });
    },
  });

  const scrapeSingleSource = useMutation({
    mutationFn: async (sourceId: string) => {
      return apiRequest(`/api/threat-tracker/scrape-source/${sourceId}`, {
        method: 'POST',
      });
    },
    onMutate: (sourceId) => {
      setScrapingSourceId(sourceId);
    },
    onSettled: () => {
      setScrapingSourceId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/sources'] });
    },
  });

  const scrapeAllSources = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/threat-tracker/scrape-all', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/scrape-job-status'] });
    },
  });

  const updateAutoScrapeSettings = useMutation({
    mutationFn: async ({ enabled, interval }: AutoScrapeSettings) => {
      return apiRequest('/api/threat-tracker/auto-scrape-settings', {
        method: 'PUT',
        body: JSON.stringify({ enabled, interval }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/auto-scrape-settings'] });
    },
  });

  // Effects
  useEffect(() => {
    if (sources) {
      setLocalSources(sources);
    }
  }, [sources]);

  useEffect(() => {
    if (autoScrapeSettingsData) {
      setAutoScrapeSettings(autoScrapeSettingsData);
    }
  }, [autoScrapeSettingsData]);

  // Event handlers
  function onSubmit(values: SourceFormValues) {
    if (editingSource) {
      updateSource.mutate({ id: editingSource.id, values });
    } else {
      createSource.mutate(values);
    }
  }

  function handleEditSource(source: ThreatSource) {
    setEditingSource(source);
    form.reset({
      name: source.name,
      url: source.url,
      description: source.description || "",
      active: source.active,
      includeInAutoScrape: source.includeInAutoScrape,
    });
    setIsFormOpen(true);
  }

  function handleNewSource() {
    setEditingSource(null);
    form.reset({
      name: "",
      url: "",
      description: "",
      active: true,
      includeInAutoScrape: false,
    });
    setIsFormOpen(true);
  }

  function handleToggleAutoScrape(enabled: boolean) {
    const newSettings = { ...autoScrapeSettings, enabled };
    setAutoScrapeSettings(newSettings);
    updateAutoScrapeSettings.mutate(newSettings);
  }

  function handleChangeAutoScrapeInterval(interval: JobInterval) {
    const newSettings = { ...autoScrapeSettings, interval };
    setAutoScrapeSettings(newSettings);
    updateAutoScrapeSettings.mutate(newSettings);
  }

  function formatLastScraped(date: Date | null | undefined) {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString();
  }

  function renderSourcesTable() {
    return (
      <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:mx-0">
        <div className="px-3 sm:px-4 lg:px-0 min-w-[400px] sm:min-w-[280px]">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-300 w-[50%] sm:w-[25%] text-xs sm:text-sm">Name</TableHead>
                <TableHead className="text-slate-300 w-[50%] sm:w-[35%] text-xs sm:text-sm">URL</TableHead>
                <TableHead className="text-slate-300 w-[25%] sm:w-[15%] text-xs sm:text-sm hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-slate-300 w-[15%] sm:w-[15%] text-xs sm:text-sm hidden sm:table-cell">Last Scraped</TableHead>
                <TableHead className="text-slate-300 w-[25%] sm:w-[10%] text-right text-xs sm:text-sm hidden sm:table-cell">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localSources.map((source) => (
                <React.Fragment key={source.id}>
                  {/* First row - Name and URL (and all desktop columns) */}
                  <TableRow className="border-b sm:border-b">
                    <TableCell className="font-medium text-white w-[50%] sm:w-[25%] p-2 sm:p-4">
                      <span className="truncate text-xs sm:text-sm">{source.name}</span>
                    </TableCell>
                    <TableCell className="w-[50%] sm:w-[35%] p-2 sm:p-4">
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-slate-300 hover:text-primary transition-colors truncate"
                      >
                        <span className="truncate text-xs sm:text-sm">
                          {source.url.replace(/^https?:\/\/(www\.)?/, '')}
                        </span>
                        <ExternalLink className="ml-1 h-2 w-2 sm:h-2.5 sm:w-2.5 text-slate-500 flex-shrink-0" />
                      </a>
                    </TableCell>
                    {/* Desktop-only columns */}
                    <TableCell className="hidden sm:table-cell w-[15%] p-2 sm:p-4">
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
                    <TableCell className="hidden sm:table-cell w-[15%] p-2 sm:p-4 text-xs text-slate-400">
                      {formatLastScraped(source.lastScraped)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right w-[10%] p-1 sm:p-4 align-top">
                      <div className="flex gap-2">
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
                  
                  {/* Second row on mobile - Status and Actions */}
                  <TableRow key={`${source.id}-mobile`} className="sm:hidden border-t-0">
                    <TableCell className="w-[50%] p-2 pt-0">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-400 mb-1">Status:</span>
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
                    <TableCell className="w-[50%] p-2 pt-0">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-400 mb-1">Actions:</span>
                        <div className="flex gap-2">
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
                      </div>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-6xl">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
              <p className="text-slate-400">Loading sources...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-[#BF00FF]" />
            <div>
              <h1 className="text-2xl font-bold text-white">Threat Sources</h1>
              <p className="text-slate-400">Manage your threat intelligence sources</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex gap-2">
              <Button
                onClick={handleNewSource}
                className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Source
              </Button>
              
              <Button
                onClick={() => scrapeAllSources.mutate()}
                disabled={scrapeJobRunning || localSources.filter(s => s.active).length === 0}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {scrapeJobRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {scrapeJobRunning ? 'Scraping...' : 'Scrape All'}
              </Button>
            </div>
          </div>
        </div>

        {/* Auto-scrape settings */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#00FFFF]" />
              Auto-scrape Settings
            </CardTitle>
            <CardDescription className="text-slate-400">
              Configure automatic scraping of active sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-scrape" className="text-slate-300">
                Enable auto-scrape
              </Label>
              <Switch
                id="auto-scrape"
                checked={autoScrapeSettings.enabled}
                onCheckedChange={handleToggleAutoScrape}
              />
            </div>
            
            {autoScrapeSettings.enabled && (
              <div className="space-y-2">
                <Label className="text-slate-300">Scrape interval</Label>
                <Select
                  value={autoScrapeSettings.interval}
                  onValueChange={(value) => handleChangeAutoScrapeInterval(value as JobInterval)}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={JobInterval.HOURLY}>Hourly</SelectItem>
                    <SelectItem value={JobInterval.DAILY}>Daily</SelectItem>
                    <SelectItem value={JobInterval.WEEKLY}>Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sources table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Sources ({localSources.length})</CardTitle>
            <CardDescription className="text-slate-400">
              Manage your threat intelligence sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            {localSources.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">No sources configured yet</p>
                <Button
                  onClick={handleNewSource}
                  className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Source
                </Button>
              </div>
            ) : (
              renderSourcesTable()
            )}
          </CardContent>
        </Card>

        {/* Source form dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingSource ? 'Edit Source' : 'Add New Source'}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingSource 
                  ? 'Update the source information' 
                  : 'Add a new threat intelligence source'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Source name"
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
                      <FormLabel className="text-slate-300">URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="https://example.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Brief description of this source"
                          rows={2}
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
                    <FormItem className="flex items-center justify-between rounded-lg border border-slate-600 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-slate-300">Active</FormLabel>
                        <div className="text-sm text-slate-400">
                          Enable this source for scraping
                        </div>
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
                    <FormItem className="flex items-center justify-between rounded-lg border border-slate-600 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-slate-300">Include in Auto-scrape</FormLabel>
                        <div className="text-sm text-slate-400">
                          Include this source in automatic scraping
                        </div>
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFormOpen(false)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createSource.isPending || updateSource.isPending}
                    className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
                  >
                    {createSource.isPending || updateSource.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {editingSource ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}