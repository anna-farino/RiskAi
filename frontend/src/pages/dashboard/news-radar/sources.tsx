import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import {
  Source,
  insertSourceSchema,
} from "@shared/db/schema/news-tracker/index";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Link2,
  Globe,
  Plus,
  RotateCw,
  Check,
  X,
  Clock,
  Settings,
  Play,
  Trash2,
  Edit,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { cn } from "@/lib/utils";
import { DeleteAlertDialog } from "@/components/delete-alert-dialog";
import { z } from "zod";

// Define the JobInterval enum matching the server-side enum
enum JobInterval {
  FIFTEEN_MINUTES = 15 * 60 * 1000,
  HOURLY = 60 * 60 * 1000,
  FOUR_HOURS = 4 * 60 * 60 * 1000,
  TWICE_DAILY = 12 * 60 * 60 * 1000,
  DAILY = 24 * 60 * 60 * 1000,
  WEEKLY = 7 * 24 * 60 * 60 * 1000,
}

// Convert enum to human-readable labels
const intervalLabels: Record<JobInterval, string> = {
  [JobInterval.FIFTEEN_MINUTES]: "Every 15 Minutes",
  [JobInterval.HOURLY]: "Hourly",
  [JobInterval.FOUR_HOURS]: "Every 4 Hours",
  [JobInterval.TWICE_DAILY]: "Twice Daily",
  [JobInterval.DAILY]: "Daily",
  [JobInterval.WEEKLY]: "Weekly",
};

// Type definition for auto scrape settings
interface AutoScrapeSettings {
  enabled: boolean;
  interval: JobInterval;
  lastRun?: string;
  nextRun?: string;
}

// Edit source schema
const editSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
});

type EditSourceFormValues = z.infer<typeof editSourceSchema>;

export default function Sources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [sourcesBeingScraped, setSourcesBeingScraped] = useState<string[]>([]);
  const [scrapesBeingStopped, setScrapesBeingStopped] = useState<string[]>([]);
  const [optimisticAutoScrapeEnabled, setOptimisticAutoScrapeEnabled] =
    useState<boolean | null>(null);
  const [optimisticAutoScrapeInterval, setOptimisticAutoScrapeInterval] =
    useState<JobInterval | null>(null);

  // Get job status
  const autoScrapeStatus = useQuery({
    queryKey: ["/api/news-tracker/jobs/status"],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/jobs/status`,
          {
            method: "GET",
            credentials: "include",
            headers: csfrHeaderObject(),
          },
        );
        if (!response.ok) throw new Error("Failed to fetch job status");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error fetching job status:", error);
        return { running: false };
      }
    },
    refetchInterval: 5000, // Poll every 5 seconds
    // Add initial data to prevent undefined state
    initialData: { running: false },
  });

  const form = useForm({
    resolver: zodResolver(insertSourceSchema),
    defaultValues: {
      url: "",
      name: "",
    },
  });

  // Edit form
  const editForm = useForm<EditSourceFormValues>({
    resolver: zodResolver(editSourceSchema),
    defaultValues: {
      name: "",
      url: "",
    },
  });

  const sources = useQuery<Source[]>({
    queryKey: ["/api/news-tracker/sources"],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/sources`, {
          method: "GET",
          credentials: "include",
          headers: {
            ...csfrHeaderObject(),
          },
        });
        if (!response.ok) throw new Error("Failed to fetch sources");

        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return []; // Return empty array instead of undefined to prevent errors
      }
    },
    placeholderData: [],
  });

  // Get auto-scrape settings
  const autoScrapeSettings = useQuery<AutoScrapeSettings>({
    queryKey: ["/api/news-tracker/settings/auto-scrape"],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/settings/auto-scrape`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              ...csfrHeaderObject(),
            },
          },
        );
        if (!response.ok)
          throw new Error("Failed to fetch auto-update settings");

        const data = await response.json();
        return data || { enabled: false, interval: JobInterval.DAILY };
      } catch (error) {
        console.error(error);
        // Return default settings instead of undefined to prevent errors
        return { enabled: false, interval: JobInterval.DAILY };
      }
    },
    placeholderData: {
      enabled: false,
      interval: JobInterval.DAILY,
    },
  });

  // Sync optimistic state with server data when it loads
  useEffect(() => {
    if (autoScrapeSettings.data) {
      if (optimisticAutoScrapeEnabled === null) {
        setOptimisticAutoScrapeEnabled(autoScrapeSettings.data.enabled);
      }
      if (optimisticAutoScrapeInterval === null) {
        setOptimisticAutoScrapeInterval(autoScrapeSettings.data.interval);
      }
    }
  }, [
    autoScrapeSettings.data,
    optimisticAutoScrapeEnabled,
    optimisticAutoScrapeInterval,
  ]);

  const addSource = useMutation({
    mutationFn: async (data: { url: string; name: string }) => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/sources`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...csfrHeaderObject(),
          },
          body: JSON.stringify(data),
          credentials: "include",
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
        userId: null,
      } as Source;

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/sources"],
      });

      // Snapshot the previous states for potential rollback
      const previousSources = queryClient.getQueryData<Source[]>([
        "/api/news-tracker/sources",
      ]);

      // Update React Query cache
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        (oldData = []) => [tempSource, ...oldData],
      );

      return { previousSources, tempId };
    },
    onError: (err, newSource, context) => {
      if (context) {
        // Revert both local state and React Query cache
        queryClient.setQueryData<Source[]>(
          ["/api/news-tracker/sources"],
          context.previousSources,
        );

        // Remove from pending items
      }

      toast({
        title: "Error adding source",
        description: "Failed to add source. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      if (context?.tempId) {
        // Update React Query cache with server data
        queryClient.setQueryData<Source[]>(
          ["/api/news-tracker/sources"],
          (prev) =>
            prev?.map((source) =>
              source.id === context.tempId ? (data as Source) : source,
            ) || [],
        );
      }

      form.reset();
      toast({
        title: "Source added successfully",
      });
    },
    //onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/sources"] })
  });

  const scrapeSource = useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/sources/${id}/scrape`,
          {
            method: "POST",
            headers: csfrHeaderObject(),
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to update source: ${response.statusText}`);
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
        console.error("Update source error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      if (!sourcesBeingScraped.includes(id)) {
        setSourcesBeingScraped((prev) => [...prev, id]);
      }
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/sources"],
      });

      // Snapshot the previous value
      const previousSources = queryClient.getQueryData<Source[]>([
        "/api/news-tracker/sources",
      ]);

      // Optimistically update the source
      // We can't easily update the status directly as it may be part of scrapingConfig
      // But we can set a temporary visual indication by updating another property
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        (oldData = []) =>
          oldData.map((source) =>
            source.id === id ? { ...source, active: true } : source,
          ),
      );

      return { previousSources };
    },
    onError: (err, id, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        context?.previousSources,
      );
      toast({
        title: "Error updating source",
        description: "Failed to update source. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Don't invalidate the sources - we already updated them optimistically
      // For articles we do need to update since the content has changed
      queryClient.invalidateQueries({
        queryKey: ["/api/news-tracker/articles"],
      });
      toast({
        title: "Source updated successfully",
      });
    },
    onSettled: (id) => {
      setSourcesBeingScraped((prev) =>
        prev.filter((sourceId) => sourceId != id),
      );
    },
  });

  const stopScraping = useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/sources/${id}/stop`,
          {
            method: "POST",
            headers: csfrHeaderObject(),
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to stop updating: ${response.statusText}`);
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
        console.error("Stop updating error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      if (!scrapesBeingStopped.includes(id)) {
        setScrapesBeingStopped((prev) => [...prev, id]);
      }
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/sources"],
      });

      // Snapshot the previous value
      const previousSources = queryClient.getQueryData<Source[]>([
        "/api/news-tracker/sources",
      ]);

      // Optimistically update the source
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        (oldData = []) =>
          oldData.map((source) =>
            source.id === id
              ? { ...source, active: true } // Use active property as a visual indicator
              : source,
          ),
      );

      return { previousSources };
    },
    onError: (err, id, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        context?.previousSources,
      );
      toast({
        title: "Error stopping update",
        description: "Failed to stop updating. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (_, id) => {
      setSourcesBeingScraped((prev) =>
        prev.filter((sourceId) => sourceId != id),
      );
      // Don't invalidate - rely on the optimistic update
      toast({
        title: "Updating stopped successfully",
      });
    },
    onSettled: (_, __, id) => {
      setScrapesBeingStopped((prev) =>
        prev.filter((sourceId) => sourceId != id),
      );
    },
  });

  // Toggle auto-scrape inclusion for a source
  const toggleAutoScrape = useMutation({
    mutationFn: async ({ id, include }: { id: string; include: boolean }) => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/sources/${id}/auto-scrape`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...csfrHeaderObject(),
            },
            body: JSON.stringify({ includeInAutoScrape: include }),
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to update auto-update setting: ${response.statusText}`,
          );
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
        console.error("Toggle auto-update error:", error);
        throw error;
      }
    },
    onMutate: async ({ id, include }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/sources"],
      });

      // Get snapshot of current data
      const previousSources = queryClient.getQueryData<Source[]>([
        "/api/news-tracker/sources",
      ]);
      // Optimistically update React Query cache
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        (old = []) =>
          old.map((source) =>
            source.id === id
              ? { ...source, includeInAutoScrape: include }
              : source,
          ),
      );

      return { previousSources, id };
    },
    onError: (err, variables, context) => {
      if (context) {
        // Revert both local state and React Query cache on error
        queryClient.setQueryData<Source[]>(
          ["/api/news-tracker/sources"],
          context.previousSources,
        );
      }

      toast({
        title: "Failed to update auto-update setting",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables) => {
      // Remove from pending items
      toast({
        title: "Auto-update settings updated",
      });
    },
  });

  // Edit a source
  const editSource = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: EditSourceFormValues;
    }) => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/sources/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...csfrHeaderObject(),
            },
            body: JSON.stringify(data),
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to update source: ${response.statusText}`);
        }

        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error("Edit source error:", error);
        throw error;
      }
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/sources"],
      });

      // Snapshot the previous values
      const previousSources = queryClient.getQueryData<Source[]>([
        "/api/news-tracker/sources",
      ]);
      // Update React Query cache
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        (oldData = []) =>
          oldData.map((source) =>
            source.id === id
              ? { ...source, name: data.name, url: data.url }
              : source,
          ),
      );

      return { previousSources, id };
    },
    onError: (error: Error, variables, context) => {
      if (context) {
        // Revert both local state and React Query cache
        queryClient.setQueryData<Source[]>(
          ["/api/news-tracker/sources"],
          context.previousSources,
        );
      }

      toast({
        title: "Error updating source",
        description:
          error.message || "Failed to update source. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Source updated successfully",
      });

      setEditDialogOpen(false);
      setEditingSource(null);
      editForm.reset();
    },
  });

  // Delete a source
  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/sources/${id}`,
          {
            method: "DELETE",
            headers: csfrHeaderObject(),
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to delete source: ${response.statusText}`);
        }
        // Don't try to parse JSON - some DELETE endpoints return empty responses
        return response;
      } catch (error) {
        console.error("Delete source error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/sources"],
      });
      // Snapshot the previous values
      const previousSources = queryClient.getQueryData<Source[]>([
        "/api/news-tracker/sources",
      ]);

      // Update React Query cache optimistically
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        (oldData = []) => oldData.filter((source) => source.id !== id),
      );

      return { previousSources, id };
    },
    onError: (error: Error, id, context) => {
      if (context) {
        queryClient.setQueryData<Source[]>(
          ["/api/news-tracker/sources"],
          context.previousSources,
        );
      }

      toast({
        title: "Error deleting source",
        description:
          error.message || "Failed to delete source. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, id) => {
      toast({
        title: "Source deleted successfully",
      });
      // Close the delete dialog
      setDeleteDialogOpen(false);
      setSourceToDelete(null);
    },
    //onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/sources"] })
  });

  // Run global scrape job manually
  // Add the stop global scrape mutation
  const stopGlobalScrape = useMutation({
    mutationFn: async () => {
      try {
        // Add a debugging log before making the request
        console.log("Attempting to stop global update...");

        const response = await fetch(
          `${serverUrl}/api/news-tracker/jobs/stop`,
          {
            method: "POST",
            headers: {
              ...csfrHeaderObject(),
              "Content-Type": "application/json",
            },
            credentials: "include",
          },
        );

        console.log("Stop request response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error(
            `Failed to stop global update: ${response.statusText}`,
          );
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
        console.error("Stop global update error:", error);
        throw error;
      }
    },
    onError: (err) => {
      console.error("Stop global update mutation error handler:", err);
      toast({
        title: "Error stopping global update",
        description: "Failed to stop updating. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      console.log("Stop global update succeeded:", data);
      toast({
        title: "Global update stopped",
        description: "All updating operations have been stopped",
      });
      // Force update job status
      queryClient.invalidateQueries({
        queryKey: ["/api/news-tracker/jobs/status"],
      });
    },
  });

  const runGlobalScrape = useMutation({
    mutationFn: async () => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/jobs/scrape`,
          {
            method: "POST",
            headers: csfrHeaderObject(),
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to start global update: ${response.statusText}`,
          );
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
        console.error("Run global update error:", error);
        throw error;
      }
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/sources"],
      });

      // Snapshot the previous state
      const previousSources = queryClient.getQueryData<Source[]>([
        "/api/news-tracker/sources",
      ]);

      // Optimistically update all eligible sources
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        (oldData = []) =>
          oldData.map((source) =>
            source.includeInAutoScrape
              ? { ...source, active: true } // Use active property as a visual indicator
              : source,
          ),
      );

      return { previousSources };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData<Source[]>(
        ["/api/news-tracker/sources"],
        context?.previousSources,
      );
      toast({
        title: "Error starting global update",
        description: "Failed to start updating. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Don't refetch immediately - we'll poll instead
      toast({
        title: "Global update started",
        description: "All eligible sources are being update",
      });
      // Poll job status
      const checkInterval = setInterval(async () => {
        try {
          const response = await fetch(
            `${serverUrl}/api/news-tracker/jobs/status`,
          );
          const data = await response.json();
          if (!data.running) {
            clearInterval(checkInterval);
            toast({
              title: "Global update completed",
            });
            // Invalidate only articles since they've changed
            queryClient.invalidateQueries({
              queryKey: ["/api/news-tracker/articles"],
            });
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
    mutationFn: async ({
      enabled,
      interval,
    }: {
      enabled: boolean;
      interval: JobInterval;
    }) => {
      try {
        const response = await fetch(
          `${serverUrl}/api/news-tracker/settings/auto-scrape`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...csfrHeaderObject(),
            },
            body: JSON.stringify({ enabled, interval }),
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to change auto-update settings: ${response.statusText}`,
          );
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
        console.error("Update auto-update settings error:", error);
        throw error;
      }
    },
    onMutate: async ({ enabled, interval }) => {
      // Set optimistic local state for immediate UI feedback
      setOptimisticAutoScrapeEnabled(enabled);
      setOptimisticAutoScrapeInterval(interval);

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ["/api/news-tracker/settings/auto-scrape"],
      });

      // Snapshot the previous values for potential rollback
      const previousSettings = queryClient.getQueryData<AutoScrapeSettings>([
        "/api/news-tracker/settings/auto-scrape",
      ]);
      const previousOptimisticEnabledState = optimisticAutoScrapeEnabled;
      const previousOptimisticIntervalState = optimisticAutoScrapeInterval;

      // Optimistically update the cache with new settings
      queryClient.setQueryData<AutoScrapeSettings>(
        ["/api/news-tracker/settings/auto-scrape"],
        {
          enabled,
          interval:
            interval ||
            (previousSettings && "interval" in previousSettings
              ? previousSettings.interval
              : JobInterval.DAILY),
          lastRun: previousSettings?.lastRun,
          nextRun: previousSettings?.nextRun,
        },
      );

      return {
        previousSettings,
        previousOptimisticEnabledState,
        previousOptimisticIntervalState,
      };
    },
    onError: (err, variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousSettings) {
        queryClient.setQueryData<AutoScrapeSettings>(
          ["/api/news-tracker/settings/auto-scrape"],
          context.previousSettings,
        );
      }
      setOptimisticAutoScrapeEnabled(
        context?.previousOptimisticEnabledState ?? null,
      );
      setOptimisticAutoScrapeInterval(
        context?.previousOptimisticIntervalState ?? null,
      );

      toast({
        title: "Failed to change auto-update settings",
        description:
          "There was an error updating the settings. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables) => {
      // Update cache with actual server response
      queryClient.setQueryData<AutoScrapeSettings>(
        ["/api/news-tracker/settings/auto-scrape"],
        data,
      );

      // Sync optimistic state with server response
      setOptimisticAutoScrapeEnabled(data.enabled);
      setOptimisticAutoScrapeInterval(data.interval);

      toast({
        title: "Auto-update settings updated",
        description: data.enabled
          ? `Auto-update has been enabled with ${intervalLabels[data.interval as JobInterval] || 'daily'} frequency.`
          : "Auto-update has been disabled.",
      });

      // Close the settings popover
      setIsSettingsOpen(false);
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    // Validate that both fields are not empty or just whitespace
    if (!data.name?.trim() || !data.url?.trim()) {
      toast({
        title: "Validation Error",
        description: "Both source name and URL are required.",
        variant: "destructive",
      });
      return;
    }

    addSource.mutate(data);
  });

  const onEditSubmit = editForm.handleSubmit((data) => {
    if (!editingSource) return;

    // Validate that both fields are not empty or just whitespace
    if (!data.name?.trim() || !data.url?.trim()) {
      toast({
        title: "Validation Error",
        description: "Both source name and URL are required.",
        variant: "destructive",
      });
      return;
    }

    editSource.mutate({ id: editingSource.id, data });
  });

  const handleEditSource = (source: Source) => {
    setEditingSource(source);
    editForm.reset({
      name: source.name,
      url: source.url,
    });
    setEditDialogOpen(true);
  };

  return (
    <div
      className={cn(
        "flex flex-col pb-16 sm:pb-20 px-3 sm:px-4 lg:px-6 xl:px-8 max-w-7xl mx-auto w-full min-w-0",
      )}
    >
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

      {/* Edit source dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Source</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="edit-name"
                className="text-sm font-medium text-white"
              >
                Source Name
              </Label>
              <Input
                id="edit-name"
                placeholder="E.g., Tech News Daily"
                {...editForm.register("name", {
                  required: "Source name is required",
                  validate: (value) =>
                    value?.trim() !== "" || "Source name cannot be empty",
                })}
                className="h-9 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
              />
              {editForm.formState.errors.name && (
                <p className="text-xs text-red-400">
                  {editForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="edit-url"
                className="text-sm font-medium text-white"
              >
                Source URL
              </Label>
              <Input
                id="edit-url"
                placeholder="https://example.com"
                type="url"
                {...editForm.register("url", {
                  required: "Source URL is required",
                  validate: (value) =>
                    value?.trim() !== "" || "Source URL cannot be empty",
                })}
                className="h-9 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
              />
              {editForm.formState.errors.url && (
                <p className="text-xs text-red-400">
                  {editForm.formState.errors.url.message}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingSource(null);
                  editForm.reset();
                }}
                className="border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editSource.isPending || !editForm.formState.isValid}
                className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
              >
                {editSource.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Update Source
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 lg:gap-4">
          <div className="flex flex-col gap-0.5 sm:gap-1 lg:gap-2">
            <h1 className="text-3xl font-bold tracking-tight">News Sources</h1>
            <p className="text-muted-foreground">
              Manage news sources and control updates
            </p>
          </div>
        </div>

        {/* Instructions Card */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-blue-600" />
              How to Use News Radar Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">1. Configure Auto-Updates</h4>
                  <p className="text-sm text-muted-foreground">
                    Enable automatic news collection with hourly, daily, or weekly intervals for continuous monitoring.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">2. Manage News Sources</h4>
                  <p className="text-sm text-muted-foreground">
                    Default news sources are provided. Add custom RSS feeds or news sites, and toggle inclusion in auto-updates.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">3. Manual Collection</h4>
                  <p className="text-sm text-muted-foreground">
                    Use "Update All Sources Now" for immediate article collection or update individual sources as needed.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">4. Filter by Keywords</h4>
                  <p className="text-sm text-muted-foreground">
                    Visit the Keywords page to manage terms that help filter and categorize collected news articles.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-scrape configuration card */}
        <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Clock className="mr-2 h-5 w-5" />
              Auto-Update Configuration
            </CardTitle>
            <CardDescription className="text-slate-300">
              Configure automatic updating to stay on top of the latest information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-scrape"
                  checked={
                    optimisticAutoScrapeEnabled !== null
                      ? optimisticAutoScrapeEnabled
                      : !!autoScrapeSettings.data?.enabled
                  }
                  onCheckedChange={(checked) => {
                    const currentInterval =
                      optimisticAutoScrapeInterval !== null
                        ? optimisticAutoScrapeInterval
                        : (autoScrapeSettings.data?.interval ??
                          JobInterval.DAILY);
                    updateAutoScrapeSettings.mutate({
                      enabled: checked,
                      interval: currentInterval,
                    });
                  }}
                  disabled={updateAutoScrapeSettings.isPending}
                />
                <div className="grid gap-0.5">
                  <label
                    htmlFor="auto-scrape"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white"
                  >
                    {(
                      optimisticAutoScrapeEnabled !== null
                        ? optimisticAutoScrapeEnabled
                        : !!autoScrapeSettings.data?.enabled
                    )
                      ? "Enabled"
                      : "Disabled"}
                  </label>
                  <p className="text-xs text-slate-400">
                    {(
                      optimisticAutoScrapeEnabled !== null
                        ? optimisticAutoScrapeEnabled
                        : !!autoScrapeSettings.data?.enabled
                    )
                      ? `Auto-update runs ${intervalLabels[(optimisticAutoScrapeInterval !== null ? optimisticAutoScrapeInterval : autoScrapeSettings.data?.interval) as JobInterval]?.toLowerCase() || "daily"}`
                      : "Enable to automatically update sources for new articles"}
                  </p>
                </div>
                {updateAutoScrapeSettings.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary ml-2" />
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant={
                    (optimisticAutoScrapeInterval !== null
                      ? optimisticAutoScrapeInterval
                      : autoScrapeSettings.data?.interval) ===
                    JobInterval.HOURLY
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    const currentEnabled =
                      optimisticAutoScrapeEnabled !== null
                        ? optimisticAutoScrapeEnabled
                        : !!autoScrapeSettings.data?.enabled;
                    updateAutoScrapeSettings.mutate({
                      enabled: currentEnabled,
                      interval: JobInterval.HOURLY,
                    });
                  }}
                  disabled={
                    !(optimisticAutoScrapeEnabled !== null
                      ? optimisticAutoScrapeEnabled
                      : autoScrapeSettings.data?.enabled) ||
                    updateAutoScrapeSettings.isPending
                  }
                  className="text-white border-slate-600 hover:bg-slate-700"
                >
                  {updateAutoScrapeSettings.isPending && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  Hourly
                </Button>
                <Button
                  variant={
                    (optimisticAutoScrapeInterval !== null
                      ? optimisticAutoScrapeInterval
                      : autoScrapeSettings.data?.interval) === JobInterval.DAILY
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    const currentEnabled =
                      optimisticAutoScrapeEnabled !== null
                        ? optimisticAutoScrapeEnabled
                        : !!autoScrapeSettings.data?.enabled;
                    updateAutoScrapeSettings.mutate({
                      enabled: currentEnabled,
                      interval: JobInterval.DAILY,
                    });
                  }}
                  disabled={
                    !(optimisticAutoScrapeEnabled !== null
                      ? optimisticAutoScrapeEnabled
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
                    (optimisticAutoScrapeInterval !== null
                      ? optimisticAutoScrapeInterval
                      : autoScrapeSettings.data?.interval) ===
                    JobInterval.WEEKLY
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    const currentEnabled =
                      optimisticAutoScrapeEnabled !== null
                        ? optimisticAutoScrapeEnabled
                        : !!autoScrapeSettings.data?.enabled;
                    updateAutoScrapeSettings.mutate({
                      enabled: currentEnabled,
                      interval: JobInterval.WEEKLY,
                    });
                  }}
                  disabled={
                    !(optimisticAutoScrapeEnabled !== null
                      ? optimisticAutoScrapeEnabled
                      : autoScrapeSettings.data?.enabled) ||
                    updateAutoScrapeSettings.isPending
                  }
                  className="text-white border-slate-600 hover:bg-slate-700"
                >
                  {updateAutoScrapeSettings.isPending && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  Weekly
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="text-sm text-slate-400">
              {autoScrapeStatus?.data?.running ? (
                <span className="flex items-center text-primary">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Manual update allows you to immediately check for new articles
                </span>
              ) : (
                "Check for new articles"
              )}
            </div>
            <Button
              onClick={() => {
                if (autoScrapeStatus?.data?.running) {
                  stopGlobalScrape.mutate();
                } else {
                  runGlobalScrape.mutate();
                }
              }}
              disabled={runGlobalScrape.isPending || stopGlobalScrape.isPending}
              size="sm"
              className={
                autoScrapeStatus?.data?.running
                  ? "bg-red-600 hover:bg-red-600/80 text-white"
                  : "bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
              }
            >
              {runGlobalScrape.isPending || stopGlobalScrape.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : autoScrapeStatus?.data?.running ? (
                <X className="mr-2 h-4 w-4" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {autoScrapeStatus?.data?.running
                ? "Stop Update"
                : "Update All Sources Now"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* News Sources Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
        <div className="lg:col-span-3 xl:col-span-2 bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 sm:p-4 lg:p-6">
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <h2 className="text-sm sm:text-base lg:text-lg font-medium text-white">
                Add News Source
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-1 sm:mb-2">
              <div>
                <label className="text-xs sm:text-sm text-slate-400 mb-1 sm:mb-1.5 block">
                  Source Name *
                </label>
                <Input
                  placeholder="E.g., Tech News Daily"
                  {...form.register("name", {
                    required: "Source name is required",
                    validate: (value) =>
                      value?.trim() !== "" || "Source name cannot be empty",
                  })}
                  className="h-8 sm:h-9 lg:h-10 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                  required
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-400 mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs sm:text-sm text-slate-400 mb-1 sm:mb-1.5 block">
                  Source URL *
                </label>
                <Input
                  placeholder="https://example.com"
                  type="url"
                  {...form.register("url", {
                    required: "Source URL is required",
                    validate: (value) =>
                      value?.trim() !== "" || "Source URL cannot be empty",
                  })}
                  className="h-8 sm:h-9 lg:h-10 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                  required
                />
                {form.formState.errors.url && (
                  <p className="text-xs text-red-400 mt-1">
                    {form.formState.errors.url.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={addSource.isPending || !form.formState.isValid}
                className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] h-8 sm:h-9 lg:h-10 px-3 sm:px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addSource.isPending ? (
                  <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                )}
                <span className="hidden xs:inline">Add Source</span>
                <span className="xs:hidden">Add</span>
              </Button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 xl:col-span-1 bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 sm:p-4 lg:p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm sm:text-base lg:text-lg font-medium text-white mb-2 sm:mb-3">
              Quick Tips
            </h2>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              <li className="flex gap-1 sm:gap-2 text-slate-300">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>
                  Add reliable news sources with well-structured content for
                  best results.
                </span>
              </li>
              <li className="flex gap-1 sm:gap-2 text-slate-300">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>
                  Configure auto-update settings to automatically collect new
                  content on a schedule.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 text-primary" />
              </div>
              <div className="text-xs sm:text-sm text-white">
                <span className="font-medium">{sources.data?.length || 0}</span>{" "}
                sources available
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden",
          "flex flex-col",
        )}
      >
        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base lg:text-lg font-medium text-white">
              Source List
            </h2>
            <div className="text-xs sm:text-sm text-slate-400">
              {sources.data?.length || 0} sources configured
            </div>
          </div>
        </div>

        {sources.isLoading ? (
          <div className="flex justify-center py-12 sm:py-16">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-slate-400" />
          </div>
        ) : sources.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 rounded-full bg-slate-800/70 flex items-center justify-center mb-3 sm:mb-4">
              <Globe className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-slate-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-medium text-white mb-2">
              No sources added
            </h3>
            <Button
              className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] h-8 sm:h-9 px-3 sm:px-4 text-sm mb-3"
              onClick={() => sources.refetch()}
            >
              Fetch Sources
            </Button>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xs sm:max-w-md">
              Add your first news source above to start scraping articles
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:mx-0">
            <div className="px-3 sm:px-4 lg:px-0 min-w-[400px] sm:min-w-[280px]">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="border-slate-700/50 hover:bg-slate-800/70">
                    <TableHead className="text-slate-300 w-[25%] sm:w-[25%] text-xs sm:text-sm">
                      Source
                    </TableHead>
                    <TableHead className="text-slate-300 w-[25%] sm:w-[35%] text-xs sm:text-sm">
                      URL
                    </TableHead>
                    <TableHead className="text-slate-300 w-[25%] sm:w-[15%] text-center text-xs sm:text-sm">
                      Auto
                    </TableHead>
                    <TableHead className="text-right text-slate-300 w-[25%] sm:w-[25%] text-xs sm:text-sm">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.data &&
                    sources.data.map((source) => (
                      <TableRow
                        key={source.id}
                        className={cn(
                          "border-slate-700/50 hover:bg-slate-800/70 transition-opacity duration-200",
                        )}
                      >
                        <TableCell className="font-medium text-white w-[25%] sm:w-[25%] p-2 sm:p-4">
                          <div className="flex items-center gap-1 overflow-hidden min-w-0">
                            <div className="h-3 w-3 sm:h-5 sm:w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"></div>
                            <span className="truncate text-xs sm:text-sm min-w-0">
                              {source.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="w-[25%] sm:w-[35%] p-2 sm:p-4">
                          <div className="flex items-center gap-1 overflow-hidden min-w-0">
                            <Link2 className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-slate-500 flex-shrink-0" />
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-300 hover:text-primary transition-colors truncate text-xs sm:text-sm min-w-0"
                            >
                              {source.url.replace(/^https?:\/\/(www\.)?/, "")}
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="text-center w-[25%] sm:w-[15%] p-2 sm:p-4">
                          <div className="flex justify-center items-center min-w-0">
                            <Switch
                              id={`auto-scrape-${source.id}`}
                              checked={source.includeInAutoScrape || false}
                              onCheckedChange={(checked) =>
                                toggleAutoScrape.mutate({
                                  id: source.id,
                                  include: checked,
                                })
                              }
                              disabled={toggleAutoScrape.isPending}
                              className="scale-75 sm:scale-100 flex-shrink-0"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right w-[25%] sm:w-[25%] p-1 sm:p-4 align-top">
                          {/* Mobile & Tablet Layout - Stacked vertically */}
                          <div className="flex flex-col gap-1 items-end lg:hidden min-w-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditSource(source)}
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-[#BF00FF] hover:bg-[#BF00FF]/10 p-1 flex-shrink-0"
                              title="Edit source"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => scrapeSource.mutate(source.id)}
                              disabled={scrapeSource.isPending}
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-[#00FFFF] hover:bg-[#00FFFF]/10 p-1 flex-shrink-0"
                              title="Update source"
                            >
                              {scrapeSource.isPending &&
                              sourcesBeingScraped.includes(source.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCw className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => stopScraping.mutate(source.id)}
                              disabled={
                                stopScraping.isPending &&
                                scrapesBeingStopped.includes(source.id)
                              }
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 p-1 flex-shrink-0"
                              title="Stop scraping"
                            >
                              {stopScraping.isPending &&
                              scrapesBeingStopped.includes(source.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSourceToDelete(source.id);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={deleteSource.isPending}
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 p-1 flex-shrink-0"
                              title="Delete source"
                            >
                              {false && deleteSource.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>

                          {/* Large Desktop Layout - Horizontal */}
                          <div className="hidden lg:flex flex-row justify-end items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditSource(source)}
                              className="h-fit w-fit rounded-full text-slate-400 hover:text-[#BF00FF] hover:bg-[#BF00FF]/10 p-2"
                              title="Edit source"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => scrapeSource.mutate(source.id)}
                              disabled={
                                scrapeSource.isPending &&
                                sourcesBeingScraped.includes(source.id)
                              }
                              className="h-fit w-fit rounded-full text-slate-400 hover:text-[#00FFFF] hover:bg-[#00FFFF]/10 p-2"
                              title="Update source"
                            >
                              {scrapeSource.isPending &&
                              sourcesBeingScraped.includes(source.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => stopScraping.mutate(source.id)}
                              disabled={
                                stopScraping.isPending &&
                                scrapesBeingStopped.includes(source.id)
                              }
                              className="h-fit w-fit rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 p-2"
                              title="Stop scraping"
                            >
                              {stopScraping.isPending &&
                              scrapesBeingStopped.includes(source.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSourceToDelete(source.id);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={deleteSource.isPending}
                              className="h-fit w-fit rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 p-2"
                              title="Delete source"
                            >
                              {deleteSource.variables == source.id ? (
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
          </div>
        )}
      </div>
    </div>
  );
}