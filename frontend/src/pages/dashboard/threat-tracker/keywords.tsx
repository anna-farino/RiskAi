import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { ThreatKeyword } from "@shared/db/schema/threat-tracker";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  PencilLine,
  Check,
  CheckCircle,
  X,
  XCircle,
  Shield,
  ChevronDown,
  ChevronRight,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Form schema for keyword creation/editing
const keywordFormSchema = z.object({
  term: z.string().min(1, "Keyword is required"),
  category: z.string().min(1, "Category is required"),
  active: z.boolean().default(true),
});

type KeywordFormValues = z.infer<typeof keywordFormSchema>;

// Form schema for bulk keyword import
const bulkKeywordFormSchema = z.object({
  terms: z.string().min(3, "Enter at least one keyword"),
  category: z.string().min(1, "Category is required"),
  active: z.boolean().default(true),
});

type BulkKeywordFormValues = z.infer<typeof bulkKeywordFormSchema>;

export default function Keywords() {
  const { toast } = useToast();
  const fetchWithAuth = useFetch();
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [bulkKeywordDialogOpen, setBulkKeywordDialogOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<ThreatKeyword | null>(
    null,
  );
  const [localKeywords, setLocalKeywords] = useState<ThreatKeyword[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("threat");
  const [isDefaultKeywordsCollapsed, setIsDefaultKeywordsCollapsed] = useState<
    Record<string, boolean>
  >({
    threat: true,
    vendor: true,
    client: true,
    hardware: true,
  });

  // Initialize the single keyword form
  const form = useForm<KeywordFormValues>({
    resolver: zodResolver(keywordFormSchema) as any,
    defaultValues: {
      term: "",
      category: "threat",
      active: true,
    },
  });

  // Initialize the bulk keyword form
  const bulkForm = useForm<BulkKeywordFormValues>({
    resolver: zodResolver(bulkKeywordFormSchema) as any,
    defaultValues: {
      terms: "",
      category: "threat",
      active: true,
    },
  });

  // Fetch keywords
  const keywords = useQuery<ThreatKeyword[]>({
    queryKey: ["/api/threat-tracker/keywords"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/threat-tracker/keywords", {
            method: "GET",
          });
        if (!response.ok) throw new Error("Failed to fetch keywords");
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return []; // Return empty array instead of undefined to prevent errors
      }
    },
    staleTime: 0, // Always refetch on component mount
    refetchOnMount: true, // Force refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Update local state whenever query data changes
  useEffect(() => {
    if (keywords.data) {
      setLocalKeywords(keywords.data);
    }
  }, [keywords.data]);

  // Create bulk keywords mutation with optimistic updates
  const createBulkKeywords = useMutation({
    mutationFn: async (values: BulkKeywordFormValues) => {
      console.log("Submitting bulk keywords:", values);

      // Split the terms and create individual keywords
      const keywordTerms = values.terms
        .split(",")
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      console.log("Processed terms:", keywordTerms);

      // Create each keyword individually using the regular keywords endpoint
      const createdKeywords = [];

      for (const term of keywordTerms) {
        try {
          const response = await fetchWithAuth('/api/threat-tracker/keywords', {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              term,
              category: values.category,
              active: values.active,
            }),
          });
          const result = await response.json();

          console.log(`Created keyword: ${term}`, result);
          createdKeywords.push(result);
        } catch (error) {
          console.error(`Error creating keyword: ${term}`, error);
          // Continue with other keywords even if one fails
        }
      }

      return {
        message: `Created ${createdKeywords.length} keywords`,
        keywords: createdKeywords,
      };
    },
    onMutate: async (values) => {
      // Split the terms and create temporary optimistic keywords
      const keywordTerms = values.terms
        .split(",")
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
      
      const tempKeywords: ThreatKeyword[] = keywordTerms.map((term, index) => ({
        id: `temp-bulk-${Date.now()}-${index}`,
        term,
        category: values.category as any,
        active: values.active,
        userId: null,
        isDefault: false,
      }));
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      // Snapshot the previous state
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      // Update local state immediately
      setLocalKeywords(prev => [...tempKeywords, ...prev]);
      
      // Update React Query cache
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], old => 
        old ? [...tempKeywords, ...old] : tempKeywords
      );
      
      return { previousKeywords, previousLocalKeywords, tempKeywords };
    },
    onError: (err, values, context) => {
      // Revert both local state and React Query cache
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      console.error("Error creating bulk keywords:", err);
      toast({
        title: "Error adding keywords",
        description:
          "There was an error adding your keywords. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      const { keywords: createdKeywords } = data;
      
      if (context?.tempKeywords && createdKeywords.length > 0) {
        // Replace temp keywords with actual server data
        setLocalKeywords(prev => {
          // Remove temp keywords and add actual ones
          const withoutTemp = prev.filter(k => !context.tempKeywords.some(temp => temp.id === k.id));
          return [...createdKeywords, ...withoutTemp];
        });
        
        // Update React Query cache
        queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], prev => {
          if (!prev) return createdKeywords;
          const withoutTemp = prev.filter(k => !context.tempKeywords.some(temp => temp.id === k.id));
          return [...createdKeywords, ...withoutTemp];
        });
      }
      
      toast({
        title: "Keywords added in bulk",
        description: `Successfully created ${createdKeywords.length} keywords.`,
      });
      setBulkKeywordDialogOpen(false);
      bulkForm.reset({
        terms: "",
        category: selectedCategory,
        active: true,
      });
      
      // Invalidate and refetch to ensure all components have fresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Create keyword mutation with optimistic updates
  const createKeyword = useMutation({
    mutationFn: async (values: KeywordFormValues) => {
      const response = await fetchWithAuth('/api/threat-tracker/keywords', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      return response.json();
    },
    onMutate: async (newKeyword) => {
      // Create a temporary optimistic keyword
      const tempId = `temp-${Date.now()}`;
      const tempKeyword: ThreatKeyword = {
        id: tempId,
        term: newKeyword.term,
        category: newKeyword.category as any,
        active: newKeyword.active,
        userId: null,
        isDefault: false,
      };
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      // Snapshot the previous state for potential rollback
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      // Update local state immediately for UI
      setLocalKeywords(prev => [tempKeyword, ...prev]);
      
      // Update React Query cache
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], old => 
        old ? [tempKeyword, ...old] : [tempKeyword]
      );
      
      return { previousKeywords, previousLocalKeywords, tempId };
    },
    onError: (err, newKeyword, context) => {
      // Revert both local state and React Query cache
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      console.error("Error creating keyword:", err);
      toast({
        title: "Error creating keyword",
        description:
          "There was an error creating your keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      if (context?.tempId) {
        // Update local state with actual server data
        setLocalKeywords(prev => 
          prev.map(keyword => 
            keyword.id === context.tempId ? (data as ThreatKeyword) : keyword
          )
        );
        
        // Update React Query cache
        queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], prev => 
          prev?.map(keyword => 
            keyword.id === context.tempId ? (data as ThreatKeyword) : keyword
          ) || []
        );
      }
      
      toast({
        title: "Keyword created",
        description: "Your keyword has been added successfully.",
      });
      setKeywordDialogOpen(false);
      form.reset();
      
      // Invalidate and refetch to ensure all components have fresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Update keyword mutation with optimistic updates
  const updateKeyword = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: KeywordFormValues;
    }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/keywords/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      return response.json();
    },
    onMutate: async ({ id, values }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      // Snapshot the previous state
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      // Update local state immediately
      setLocalKeywords(prev => 
        prev.map(keyword => 
          keyword.id === id ? { ...keyword, ...values } : keyword
        )
      );
      
      // Update React Query cache
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], old => 
        (old || []).map(keyword => 
          keyword.id === id ? { ...keyword, ...values } : keyword
        )
      );
      
      return { previousKeywords, previousLocalKeywords, id };
    },
    onError: (err, variables, context) => {
      // Revert both local state and React Query cache
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      console.error("Error updating keyword:", err);
      toast({
        title: "Error updating keyword",
        description:
          "There was an error updating your keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      if (context?.id) {
        // Update local state with actual server data
        setLocalKeywords(prev => 
          prev.map(keyword => 
            keyword.id === context.id ? (data as ThreatKeyword) : keyword
          )
        );
        
        // Update React Query cache
        queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], prev => 
          prev?.map(keyword => 
            keyword.id === context.id ? (data as ThreatKeyword) : keyword
          ) || []
        );
      }
      
      toast({
        title: "Keyword updated",
        description: "Your keyword has been updated successfully.",
      });
      setKeywordDialogOpen(false);
      setEditingKeyword(null);
      form.reset();
      
      // Invalidate and refetch to ensure all components have fresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Delete keyword mutation with optimistic updates
  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await fetchWithAuth(`/api/threat-tracker/keywords/${id}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete keyword: ${response.statusText}`);
        }
        
        // Don't try to parse JSON - DELETE endpoints typically return empty responses
        return { success: true, id };
      } catch (error) {
        console.error("Delete keyword error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      // Snapshot the previous data
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      // Immediately update local state
      setLocalKeywords(prev => prev.filter(keyword => keyword.id !== id));
      
      // Update React Query cache
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], (oldData = []) => 
        oldData.filter(keyword => keyword.id !== id)
      );
      
      return { previousKeywords, previousLocalKeywords, id };
    },
    onError: (err, id, context) => {
      // Revert both local state and cache
      if (context) {
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      console.error("Error deleting keyword:", err);
      toast({
        title: "Error deleting keyword",
        description:
          "There was an error deleting your keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      toast({
        title: "Keyword deleted",
        description: "Your keyword has been deleted successfully.",
      });
      
      // Invalidate and refetch to ensure all components have fresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Toggle keyword active status with optimistic updates
  const toggleKeywordActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const response = await fetchWithAuth(`/api/threat-tracker/keywords/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ active }),
      });
      return response.json();
    },
    onMutate: async ({ id, active }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/threat-tracker/keywords"] });
      
      // Snapshot the previous values
      const previousKeywords = queryClient.getQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"]);
      const previousLocalKeywords = [...localKeywords];
      
      // Update local state immediately
      setLocalKeywords(prev => 
        prev.map(keyword => 
          keyword.id === id ? { ...keyword, active } : keyword
        )
      );
      
      // Also update React Query cache
      queryClient.setQueryData<ThreatKeyword[]>(["/api/threat-tracker/keywords"], oldData => 
        (oldData || []).map(keyword => 
          keyword.id === id ? { ...keyword, active } : keyword
        )
      );
      
      return { previousKeywords, previousLocalKeywords, id };
    },
    onError: (err, variables, context) => {
      if (context) {
        // Revert both local state and cache
        setLocalKeywords(context.previousLocalKeywords);
        queryClient.setQueryData(["/api/threat-tracker/keywords"], context.previousKeywords);
      }
      
      console.error("Error toggling keyword active status:", err);
      toast({
        title: "Error updating keyword",
        description:
          "There was an error updating the keyword status. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      toast({
        title: "Keyword status updated",
        description: "Keyword status has been updated successfully.",
      });
      
      // Invalidate and refetch to ensure all components have fresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/keywords"],
      });
    },
  });

  // Handle single keyword form submission
  function onSubmit(values: KeywordFormValues) {
    if (editingKeyword) {
      updateKeyword.mutate({ id: editingKeyword.id, values });
    } else {
      createKeyword.mutate(values);
    }
  }

  // Handle bulk keyword form submission
  function onBulkSubmit(values: BulkKeywordFormValues) {
    createBulkKeywords.mutate(values);
  }

  // Handle edit keyword
  function handleEditKeyword(keyword: ThreatKeyword) {
    setEditingKeyword(keyword);
    form.reset({
      term: keyword.term,
      category: keyword.category,
      active: keyword.active,
    });
    setKeywordDialogOpen(true);
  }

  // Handle new keyword dialog open
  function handleNewKeyword() {
    setEditingKeyword(null);
    form.reset({
      term: "",
      category: selectedCategory,
      active: true,
    });
    setKeywordDialogOpen(true);
  }

  // Handle bulk keyword dialog open
  function handleBulkKeywords() {
    bulkForm.reset({
      terms: "",
      category: selectedCategory,
      active: true,
    });
    setBulkKeywordDialogOpen(true);
  }

  // Handle toggle active status
  function handleToggleActive(id: string, currentStatus: boolean) {
    toggleKeywordActive.mutate({ id, active: !currentStatus });
  }

  // Filter keywords by category and separate defaults from user keywords
  const allKeywordsByCategory = localKeywords.filter(
    (keyword) => keyword.category === selectedCategory,
  );

  const defaultKeywords = allKeywordsByCategory.filter(
    (keyword) => keyword.isDefault,
  );
  const userKeywords = allKeywordsByCategory.filter(
    (keyword) => !keyword.isDefault,
  );

  // Group keywords by category for counts
  const categoryCounts = {
    threat: localKeywords.filter((k) => k.category === "threat").length,
    vendor: localKeywords.filter((k) => k.category === "vendor").length,
    client: localKeywords.filter((k) => k.category === "client").length,
    hardware: localKeywords.filter((k) => k.category === "hardware").length,
  };

  // Helper function to render compact default keywords
  function renderDefaultKeywords(keywords: ThreatKeyword[], category: string) {
    if (keywords.length === 0) return null;

    return (
      <div className="mb-6">
        <Collapsible
          open={!isDefaultKeywordsCollapsed[category]}
          onOpenChange={(open) => setIsDefaultKeywordsCollapsed(prev => ({...prev, [category]: !open}))}
        >
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 mb-3 hover:bg-muted/50 rounded-md p-1 -ml-1 w-full justify-start">
              {isDefaultKeywordsCollapsed[category] ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <Shield className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-medium text-muted-foreground">
                Default Keywords
              </h3>
              <Badge variant="outline" className="text-xs px-2 py-0">
                {keywords.length}
              </Badge>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <div className="flex flex-wrap gap-2 pl-6">
              {keywords.map((keyword: ThreatKeyword) => (
                <Badge
                  key={keyword.id}
                  variant={keyword.active ? "default" : "outline"}
                  className={`text-xs whitespace-nowrap ${
                    keyword.active
                      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  {keyword.term}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Helper function to render unified keyword grid tiles (user keywords first, then compact system keywords)
  function renderUnifiedKeywordGrid(defaultKeywords: ThreatKeyword[], userKeywords: ThreatKeyword[]) {
    if (localKeywords.length === 0) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Sort keywords alphabetically within their types
    const sortedUserKeywords = userKeywords.sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));
    const sortedDefaultKeywords = defaultKeywords.sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));

    if (sortedUserKeywords.length === 0 && sortedDefaultKeywords.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 border rounded-md border-dashed">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-2" />
          <h3 className="text-lg font-medium">No keywords available</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center px-4">
            {selectedCategory === "threat" &&
              "Add custom threat keywords to monitor for specific security issues."}
            {selectedCategory === "vendor" &&
              "Add custom vendors to monitor for security vulnerabilities."}
            {selectedCategory === "client" &&
              "Add custom clients to track security issues affecting them."}
            {selectedCategory === "hardware" &&
              "Add custom hardware/software to monitor for security issues."}
          </p>
          <Button onClick={handleNewKeyword} className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] border-0">
            <Plus className="mr-2 h-4 w-4" />
            Add{" "}
            {selectedCategory === "threat"
              ? "Keyword"
              : selectedCategory === "vendor"
                ? "Vendor"
                : selectedCategory === "client"
                  ? "Client"
                  : "Hardware/Software"}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* User Keywords Section - Full tiles, shown first */}
        {sortedUserKeywords.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#BF00FF]" />
              Your Keywords
              <Badge variant="outline" className="text-xs bg-[#BF00FF]/10 text-[#BF00FF] border-[#BF00FF]/30">
                {sortedUserKeywords.length}
              </Badge>
            </h3>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {sortedUserKeywords.map((keyword) => {
                const isPending = (toggleKeywordActive.isPending && toggleKeywordActive.variables?.id === keyword.id) ||
                                (deleteKeyword.isPending && deleteKeyword.variables === keyword.id);
                
                return (
                  <div 
                    key={keyword.id} 
                    className={cn(
                      "relative border border-slate-700/50 rounded-lg overflow-hidden transition-all duration-200 hover:border-slate-500",
                      isPending && "border-orange-500/50 shadow-orange-500/10 shadow-md",
                      keyword.active ? "bg-[#BF00FF]/5" : "bg-slate-800/70"
                    )}
                  >
                    {isPending && (
                      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-[#BF00FF]" />
                      </div>
                    )}
                  
                    <div className={cn(
                      "absolute top-0 right-0 h-6 w-6 flex items-center justify-center rounded-bl-lg",
                      keyword.active ? "bg-green-500/20" : "bg-slate-500/20"
                    )}>
                      {keyword.active ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center",
                            keyword.active ? "bg-[#BF00FF]/20" : "bg-slate-500/20"
                          )}>
                            <Shield className={cn(
                              "h-4 w-4", 
                              keyword.active ? "text-[#BF00FF]" : "text-slate-400"
                            )} />
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="font-medium text-sm text-white truncate pr-6" title={keyword.term}>
                          {keyword.term}
                        </p>
                        <p className="text-xs text-slate-400 capitalize">
                          {selectedCategory === "threat" ? "Custom Threat" : 
                           selectedCategory === "vendor" ? "Custom Vendor" : 
                           selectedCategory === "client" ? "Custom Client" : 
                           "Custom Hardware/Software"}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={keyword.active}
                            onCheckedChange={(checked) => handleToggleActive(keyword.id, keyword.active)}
                            disabled={isPending}
                            className="data-[state=checked]:bg-[#BF00FF]"
                          />
                          <span className="text-xs text-slate-400">
                            {keyword.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditKeyword(keyword)}
                            disabled={isPending}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-[#00FFFF] hover:bg-[#00FFFF]/10"
                            title="Edit keyword"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                                title="Delete keyword"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the keyword "
                                  {keyword.term}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteKeyword.mutate(keyword.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* System Keywords Section - Collapsible dropdown with category info */}
        {sortedDefaultKeywords.length > 0 && (
          <div className="space-y-4">
            <Collapsible
              open={!isDefaultKeywordsCollapsed[selectedCategory]}
              onOpenChange={(open) => setIsDefaultKeywordsCollapsed(prev => ({...prev, [selectedCategory]: !open}))}
            >
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full p-3 bg-slate-800/40 hover:bg-slate-800/60 rounded-lg border border-blue-500/20 hover:border-blue-500/30 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {isDefaultKeywordsCollapsed[selectedCategory] ? (
                        <ChevronRight className="h-4 w-4 text-blue-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-blue-400" />
                      )}
                      <Shield className="h-4 w-4 text-blue-400" />
                      <h3 className="text-sm font-medium text-blue-300">
                        System Keywords
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                        {sortedDefaultKeywords.length} total
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                        {sortedDefaultKeywords.filter(k => k.active).length} active
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="capitalize">
                      {selectedCategory === "threat" && "Security Threats"}
                      {selectedCategory === "vendor" && "Technology Vendors"}
                      {selectedCategory === "client" && "Client Organizations"}
                      {selectedCategory === "hardware" && "Hardware & Software"}
                    </span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isDefaultKeywordsCollapsed[selectedCategory] && "rotate-180"
                    )} />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="p-4 bg-slate-900/40 rounded-lg border border-blue-500/10">
                  <div className="mb-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {selectedCategory === "threat" && 
                        "Pre-configured keywords for common cybersecurity threats, attack vectors, and security incidents."}
                      {selectedCategory === "vendor" && 
                        "Technology companies and vendors commonly mentioned in security advisories and threat reports."}
                      {selectedCategory === "client" && 
                        "Standard client organization types and sectors frequently targeted by cyber threats."}
                      {selectedCategory === "hardware" && 
                        "Common hardware devices, software platforms, and technologies with security implications."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sortedDefaultKeywords.map((keyword) => (
                      <Badge
                        key={keyword.id}
                        variant={keyword.active ? "default" : "outline"}
                        className={cn(
                          "text-xs whitespace-nowrap px-3 py-1.5 transition-all duration-200",
                          keyword.active
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30"
                            : "bg-slate-800/60 text-slate-400 border-slate-600/50 hover:bg-slate-700/60"
                        )}
                        title={`System keyword: ${keyword.term} (${keyword.active ? 'Active' : 'Inactive'})`}
                      >
                        <Shield className="h-3 w-3 mr-1.5" />
                        {keyword.term}
                        {keyword.active && (
                          <CheckCircle className="h-3 w-3 ml-1.5 text-blue-400" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col pb-16 sm:pb-20 w-full min-w-0",
      )}
    >
      <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-white">
                Threat Keywords
              </h1>
              <p className="text-sm text-slate-300">
                Manage keywords for threat monitoring across categories
              </p>
            </div>
          </div>

          {/* Toolbar Content */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Category Navigation Section */}
            <div className="lg:col-span-5">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Category Navigation</span>
                </div>
                <div className="space-y-2">
                  <Tabs
                    defaultValue="threat"
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                    className="w-full"
                  >
                    <TabsList className="w-full h-auto grid grid-cols-2 gap-1 p-1 bg-slate-800/60">
                      <TabsTrigger
                        value="threat"
                        className="text-xs px-2 py-1 data-[state=active]:bg-[#BF00FF] data-[state=active]:text-white"
                      >
                        Threats ({categoryCounts.threat})
                      </TabsTrigger>
                      <TabsTrigger
                        value="vendor"
                        className="text-xs px-2 py-1 data-[state=active]:bg-[#BF00FF] data-[state=active]:text-white"
                      >
                        Vendors ({categoryCounts.vendor})
                      </TabsTrigger>
                      <TabsTrigger
                        value="client"
                        className="text-xs px-2 py-1 data-[state=active]:bg-[#BF00FF] data-[state=active]:text-white"
                      >
                        Clients ({categoryCounts.client})
                      </TabsTrigger>
                      <TabsTrigger
                        value="hardware"
                        className="text-xs px-2 py-1 data-[state=active]:bg-[#BF00FF] data-[state=active]:text-white"
                      >
                        H/W S/W ({categoryCounts.hardware})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="text-xs text-slate-400">
                    {allKeywordsByCategory.length} keywords ({allKeywordsByCategory.filter(k => k.active).length} active)
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Update Section */}
            <div className="lg:col-span-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Category Stats</span>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-slate-300">
                    Current category: {selectedCategory === "threat" ? "Threats" : selectedCategory === "vendor" ? "Vendors" : selectedCategory === "client" ? "Clients" : "Hardware/Software"}
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-[#BF00FF]">{allKeywordsByCategory.length} total</span>
                    <span className="text-green-400">{allKeywordsByCategory.filter(k => k.active).length} active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Section */}
            <div className="lg:col-span-3">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">Actions</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => {
                      setEditingKeyword(null);
                      form.reset({
                        term: "",
                        category: selectedCategory,
                        active: true,
                      });
                      setKeywordDialogOpen(true);
                    }}
                    className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] h-8 text-xs px-2"
                  >
                    <Plus className="h-3 w-3" />
                    Add Keyword
                  </Button>
                  <Button
                    onClick={handleBulkKeywords}
                    variant="outline" 
                    className="border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50 h-8 text-xs px-2"
                  >
                    <Upload className="h-3 w-3" />
                    Bulk Import
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs
        defaultValue="threat"
        value={selectedCategory}
        onValueChange={setSelectedCategory}
        className="w-full"
      >

        <TabsContent value="threat" className="mt-4 sm:mt-6">
          <Card className="border-0 sm:border">
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-base sm:text-lg lg:text-xl">
                Threat Keywords
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm leading-relaxed">
                Keywords related to cybersecurity threats (e.g., malware,
                breach, zero-day)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-1 sm:p-3 lg:p-6">
              {renderUnifiedKeywordGrid(
                defaultKeywords.filter((k) => k.category === "threat"),
                userKeywords.filter((k) => k.category === "threat")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendor" className="mt-4 sm:mt-6">
          <Card className="border-0 sm:border">
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-base sm:text-lg lg:text-xl">Vendors</CardTitle>
              <CardDescription className="text-xs sm:text-sm leading-relaxed">
                Technology vendors to monitor for security threats
              </CardDescription>
            </CardHeader>
            <CardContent className="p-1 sm:p-3 lg:p-6">
              {renderUnifiedKeywordGrid(
                defaultKeywords.filter((k) => k.category === "vendor"),
                userKeywords.filter((k) => k.category === "vendor")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client" className="mt-4 sm:mt-6">
          <Card className="border-0 sm:border">
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-base sm:text-lg lg:text-xl">Clients</CardTitle>
              <CardDescription className="text-xs sm:text-sm leading-relaxed">
                Your client organizations to monitor for security threats
              </CardDescription>
            </CardHeader>
            <CardContent className="p-1 sm:p-3 lg:p-6">
              {renderUnifiedKeywordGrid(
                defaultKeywords.filter((k) => k.category === "client"),
                userKeywords.filter((k) => k.category === "client")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hardware" className="mt-4 sm:mt-6">
          <Card className="border-0 sm:border">
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-base sm:text-lg lg:text-xl">
                Hardware/Software
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm leading-relaxed">
                Specific hardware or software to monitor for security threats
              </CardDescription>
            </CardHeader>
            <CardContent className="p-1 sm:p-3 lg:p-6">
              {renderUnifiedKeywordGrid(
                defaultKeywords.filter((k) => k.category === "hardware"),
                userKeywords.filter((k) => k.category === "hardware")
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Single keyword dialog */}
      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingKeyword ? "Edit Keyword" : "Add New Keyword"}
            </DialogTitle>
            <DialogDescription>
              {editingKeyword
                ? "Update this keyword's details."
                : "Add a new keyword to monitor in threat analysis."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="term"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keyword</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter keyword" />
                    </FormControl>
                    <FormDescription>
                      Enter a single term to monitor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="threat">Threat</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="hardware">
                          Hardware/Software
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Categorize this keyword</FormDescription>
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
                      <FormLabel>Active Status</FormLabel>
                      <FormDescription>
                        Toggle monitoring status
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setKeywordDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createKeyword.isPending || updateKeyword.isPending}
                >
                  {(createKeyword.isPending || updateKeyword.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingKeyword ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk keyword import dialog */}
      <Dialog
        open={bulkKeywordDialogOpen}
        onOpenChange={setBulkKeywordDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bulk Import Keywords</DialogTitle>
            <DialogDescription>
              Add multiple keywords at once by separating them with commas.
            </DialogDescription>
          </DialogHeader>
          <Form {...bulkForm}>
            <form
              onSubmit={bulkForm.handleSubmit(onBulkSubmit)}
              className="space-y-4"
            >
              <FormField
                control={bulkForm.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter keywords separated by commas"
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Example: ransomware, malware, zero-day
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bulkForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="threat">Threat</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="hardware">
                          Hardware/Software
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      All imported keywords will use this category
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bulkForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active Status</FormLabel>
                      <FormDescription>
                        Set initial active status
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBulkKeywordDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createBulkKeywords.isPending}>
                  {createBulkKeywords.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Import
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
