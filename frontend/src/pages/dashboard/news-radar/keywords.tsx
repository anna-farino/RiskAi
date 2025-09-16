import { useQuery, useMutation } from "@tanstack/react-query";
import { Keyword, insertKeywordSchema } from "@shared/db/schema/news-tracker/index";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2, Plus, Tag, Search, Info, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFetch } from "@/hooks/use-fetch";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export default function Keywords() {
  const { toast } = useToast();
  const fetchWithAuth = useFetch();
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  const [keywordsUpdating, setKeywordsUpdating] = useState(false);
  const [activeKeywordsUpdating, setActiveKeywordsUpdating] = useState(false);
  const [keywordBeingToggled, setKeywordBeingToggled] = useState<string[]>([]);
  
  const form = useForm({
    resolver: zodResolver(insertKeywordSchema),
    defaultValues: {
      term: "",
    },
  });

  const keywords = useQuery<Keyword[]>({
    queryKey: ["/api/news-tracker/keywords"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth('/api/news-tracker/keywords', {
          method: 'GET',
        })
        if (!response.ok) throw new Error('Failed to fetch keywords')
        const data = await response.json()
        return data || []
      } catch(error) {
        console.error(error)
        return [] // Return empty array instead of undefined to prevent errors
      }
    },
    staleTime: 0, // Always refetch on component mount
    refetchOnMount: true, // Force refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const addKeyword = useMutation({
    mutationFn: async (data: { term: string }) => {
      try {
        const response = await fetchWithAuth('/api/news-tracker/keywords', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to add keyword: ${response.statusText}`);
        }
        
        // Parse JSON response
        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error("Add keyword error:", error);
        throw error;
      }
    },
    onMutate: async (newKeyword) => {
      // Create a temporary optimistic keyword
      const tempId = `temp-${Date.now()}`;
      // Cast to any to avoid type errors with missing properties that will be filled by the server
      const tempKeyword = {
        id: tempId,
        term: newKeyword.term,
        active: true,
        userId: null,
      } as Keyword;
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      // Snapshot the previous state for potential rollback
      const previousKeywords = queryClient.getQueryData<Keyword[]>(["/api/news-tracker/keywords"]);
      
      // Add to pendingItems to show loading indicators
      setPendingItems(prev => new Set(prev).add(tempId));
      
      // Update React Query cache
      queryClient.setQueryData<Keyword[]>(["/api/news-tracker/keywords"], old => 
        old ? [tempKeyword, ...old] : [tempKeyword]
      );
      
      return { previousKeywords, tempId };
    },
    onError: (err, newKeyword, context) => {
      // Revert both local state and React Query cache
      if (context) {
        queryClient.setQueryData(["/api/news-tracker/keywords"], context.previousKeywords);
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.tempId);
          return updated;
        });
      }
      
      toast({
        title: "Error adding keyword",
        description: "Failed to add keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: async (data, variables, context) => {
      if (context?.tempId) {
        queryClient.setQueryData<Keyword[]>(["/api/news-tracker/keywords"], prev => 
          prev?.map(keyword => 
            keyword.id === context.tempId ? (data as Keyword) : keyword
          ) || []
        );
        setKeywordsUpdating(true)
        await keywords.refetch()
        setKeywordsUpdating(false)
        
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.tempId);
          return updated;
        });
      }
      
      // Invalidate and refetch to ensure all components have fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      form.reset();
      toast({
        title: "Keyword added successfully",
      });
    },
  });

  const toggleKeyword = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      setKeywordBeingToggled(prev => [...prev, id])
      try {
        const response = await fetchWithAuth(`/api/news-tracker/keywords/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ active }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to toggle keyword: ${response.statusText}`);
        }
        
        // Try to parse JSON but handle empty responses
        try {
          const data = await response.json();
          return data;
        } catch (e) {
          // If parsing fails, just return success with the data we know
          return { id, active, success: true };
        }
      } catch (error) {
        console.error("Toggle keyword error:", error);
        throw error;
      }
    },
    onMutate: async ({ id, active }) => {
      // Add to pendingItems to show loading indicators
      setPendingItems(prev => new Set(prev).add(id));
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      // Snapshot the previous values
      const previousKeywords = queryClient.getQueryData<Keyword[]>(["/api/news-tracker/keywords"]);
      
      // Also update React Query cache
      queryClient.setQueryData<Keyword[]>(["/api/news-tracker/keywords"], oldData => 
        (oldData || []).map(keyword => 
          keyword.id === id ? { ...keyword, active } : keyword
        )
      );
      
      return { previousKeywords, id };
    },
    onError: (err, variables, context) => {
      if (context) {
        // Revert both local state and cache
        queryClient.setQueryData(["/api/news-tracker/keywords"], context.previousKeywords);
        
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.id);
          return updated;
        });
      }
      
      toast({
        title: "Error updating keyword",
        description: "Failed to update keyword status. Please try again.",
        variant: "destructive",
      });
      setKeywordBeingToggled(prev => prev.filter(k => k!= variables.id)) 
    },
    onSuccess: async (data, variables, context) => {
      if (context?.id) {
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.id);
          return updated;
        });
      }
      
      // Invalidate and refetch to ensure all components have fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/keywords"] });
      setActiveKeywordsUpdating(true)
      await keywords.refetch()
      setActiveKeywordsUpdating(false)
      setKeywordBeingToggled(prev => prev.filter(k => k!= variables.id)) 
      
      toast({
        title: "Keyword status updated",
      });
    },
    onSettled(_, __, variables) {
    },
  });

  const toggleAllKeywords = useMutation({
    mutationFn: async ({ activate }: { activate: boolean }) => {
      try {
        const allKeywords = keywords.data || [];
        const targetKeywords = activate ? 
          allKeywords.filter(k => !k.active) : // If activating, get inactive keywords
          allKeywords.filter(k => k.active);   // If deactivating, get active keywords
        
        console.log(`${activate ? 'Activating' : 'Deactivating'} keywords:`, targetKeywords.map(k => ({ id: k.id, term: k.term })));
        
        if (targetKeywords.length === 0) {
          console.log(`No keywords to ${activate ? 'activate' : 'deactivate'}`);
          return { success: true };
        }
        
        // Process all keywords one by one to ensure proper error handling
        for (const keyword of targetKeywords) {
          console.log(`${activate ? 'Activating' : 'Deactivating'} keyword: ${keyword.term} (${keyword.id})`);
          
          const response = await fetchWithAuth(`/api/news-tracker/keywords/${keyword.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ active: activate }),
          });
          
          if (!response.ok) {
            console.error(`Failed to ${activate ? 'activate' : 'deactivate'} keyword ${keyword.term}:`, response.status, response.statusText);
            throw new Error(`Failed to ${activate ? 'activate' : 'deactivate'} keyword ${keyword.term}: ${response.statusText}`);
          }
          
          console.log(`Successfully ${activate ? 'activated' : 'deactivated'}: ${keyword.term}`);
        }
        
        console.log(`All keywords ${activate ? 'activated' : 'deactivated'} successfully`);
        return { success: true };
      } catch (error) {
        console.error("Toggle all keywords error:", error);
        throw error;
      }
    },
    onMutate: async ({ activate }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      // Snapshot the previous values
      const previousKeywords = queryClient.getQueryData<Keyword[]>(["/api/news-tracker/keywords"]);
      
      // Update React Query cache - toggle all keywords
      queryClient.setQueryData<Keyword[]>(["/api/news-tracker/keywords"], oldData => 
        (oldData || []).map(keyword => ({ ...keyword, active: activate }))
      );
      
      return { previousKeywords };
    },
    onError: (err, variables, context) => {
      if (context) {
        // Revert cache
        queryClient.setQueryData(["/api/news-tracker/keywords"], context.previousKeywords);
      }
      
      toast({
        title: `Error ${variables.activate ? 'activating' : 'deactivating'} keywords`,
        description: `Failed to ${variables.activate ? 'activate' : 'deactivate'} all keywords. Please try again.`,
        variant: "destructive",
      });
    },
    onSuccess: async (_, { activate }) => {
      // Invalidate and refetch to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      // Force a refetch to ensure UI is updated
      setActiveKeywordsUpdating(true);
      await keywords.refetch();
      setActiveKeywordsUpdating(false);
      
      toast({
        title: `All keywords ${activate ? 'activated' : 'deactivated'}`,
        description: activate ? "All keywords are now active for filtering." : "You can now activate individual keywords as needed.",
      });
    },
  });

  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      try {
        // Use fetch directly to handle empty responses properly
        const response = await fetchWithAuth(`/api/news-tracker/keywords/${id}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete keyword: ${response.statusText}`);
        }
        
        // Don't try to parse JSON - some DELETE endpoints return empty responses
        return { success: true, id };
      } catch (error) {
        console.error("Delete keyword error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      // Mark as pending for visual feedback
      setPendingItems(prev => new Set(prev).add(id));
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      // Snapshot the previous data
      const previousKeywords = queryClient.getQueryData<Keyword[]>(["/api/news-tracker/keywords"]);
      
      // Update React Query cache
      queryClient.setQueryData<Keyword[]>(["/api/news-tracker/keywords"], (oldData = []) => 
        oldData.filter(keyword => keyword.id !== id)
      );
      
      return { previousKeywords, id };
    },
    onError: (err, id, context) => {
      if (context) {
        // Revert both local state and cache
        queryClient.setQueryData(["/api/news-tracker/keywords"], context.previousKeywords);
        
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.id);
          return updated;
        });
      }
      
      toast({
        title: "Error deleting keyword",
        description: "Failed to delete keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: async (data, variables, context) => {
      if (context?.id) {
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(context.id);
          return updated;
        });
      }
      
      // Invalidate and refetch to ensure all components have fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/keywords"] });
      setKeywordsUpdating(true)
      await keywords.refetch()
      setKeywordsUpdating(false)
      
      toast({
        title: "Keyword deleted successfully",
      });
    },
  });

  const keywordsAreUpdating = 
    addKeyword.isPending || 
    deleteKeyword.isPending || 
    keywordsUpdating

  const activeKeywordsAreUpdating = 
    toggleKeyword.isPending ||
    activeKeywordsUpdating ||
    keywordsAreUpdating

  const onSubmit = form.handleSubmit((data) => {
    addKeyword.mutate(data);
  });

  // Search functionality for the unified toolbar
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Filter keywords based on search term and active status
  const filteredKeywords = keywords.data?.filter(keyword => {
    const matchesSearch = keyword.term.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !showActiveOnly || keyword.active;
    return matchesSearch && matchesStatus;
  }) || [];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div
      className={cn(
        "flex flex-col pb-16 sm:pb-20 w-full min-w-0",
      )}
    >
      <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-white">
                Keyword Management
              </h1>
              <p className="text-sm text-slate-300">
                Manage keywords to categorize and filter article content
              </p>
            </div>
          </div>

          {/* Toolbar Content */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Search & Filter Section */}
            <div className="lg:col-span-1">
              <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Search & Filter Keywords</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search keywords..."
                      className="pl-10 h-8 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                      value={searchTerm}
                      onChange={handleSearchChange}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 text-xs px-3 transition-colors whitespace-nowrap",
                      showActiveOnly
                        ? "border border-green-500 bg-green-500 bg-opacity-20 hover:bg-opacity-30 text-green-500"
                        : "border border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50"
                    )}
                    onClick={() => setShowActiveOnly(!showActiveOnly)}
                    title={showActiveOnly ? "Show All Keywords" : "Show Active Only"}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active Only
                  </Button>
                </div>
              </div>
            </div>

            {/* Actions Section */}
            <div className="lg:col-span-1">
              <form onSubmit={onSubmit}>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Plus className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-400">Add New Keyword</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Enter keyword term..."
                        {...form.register("term")}
                        className="pl-10 h-8 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={addKeyword.isPending || !form.watch("term")?.trim()}
                      className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] h-8 text-xs px-3 whitespace-nowrap"
                    >
                      {addKeyword.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-3 w-3 mr-1" />
                      )}
                      Add Keyword
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {/* Actions Section */}
            <div className="lg:col-span-4">
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-400">Add New Keyword</span>
                  </div>
                  <div className="text-xs text-slate-300 mb-3 space-y-2">
                    <p>
                      Enter specific terms to track in news articles. Keywords are automatically activated when added.
                    </p>
                    <p className="text-slate-400">
                      Examples: "cybersecurity", "AI technology", "blockchain"
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Enter keyword term..."
                        {...form.register("term")}
                        className="pl-10 h-8 text-sm bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={addKeyword.isPending || !form.watch("term")?.trim()}
                      className="w-full bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] h-8 text-xs px-2"
                    >
                      {addKeyword.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Add Keyword
                    </Button>
                    <div className="text-xs text-slate-400">
                      {filteredKeywords.length} keywords ({keywords.data?.filter(k => k.active).length || 0} active)
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>



      <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
        <div className="flex flex-row gap-x-4 items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="hidden sm:block text-lg font-medium text-white">Keyword List</h2>
            <h2 className="sm:hidden text-lg font-medium text-white">Keywords</h2>
            <div className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
              {filteredKeywords.length}{filteredKeywords.length !== keywords.data?.length && ` of ${keywords.data?.length || 0}`}
            </div>
            {/* Toggle All Keywords Button */}
            {keywords.data && keywords.data.length > 0 && (
              (() => {
                const activeCount = keywords.data.filter(k => k.active).length;
                const allActive = activeCount === keywords.data.length;
                const hasActive = activeCount > 0;
                
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllKeywords.mutate({ activate: !hasActive })}
                    disabled={toggleAllKeywords.isPending}
                    className={cn(
                      "h-7 px-2 text-xs transition-all duration-200",
                      hasActive 
                        ? "border-orange-500/30 hover:bg-orange-500/10 text-orange-400 hover:text-orange-300"
                        : "border-green-500/30 hover:bg-green-500/10 text-green-400 hover:text-green-300"
                    )}
                    title={hasActive ? "Deactivate all keywords" : "Activate all keywords"}
                  >
                    {toggleAllKeywords.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : hasActive ? (
                      <XCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {hasActive ? "Deactivate All" : "Activate All"}
                  </Button>
                );
              })()
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {searchTerm && (
              <span>Searching: "{searchTerm}"</span>
            )}
            {showActiveOnly && (
              <span>Active keywords only</span>
            )}
          </div>
        </div>

        {keywords.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : keywords.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-800/70 flex items-center justify-center mb-4">
              <HelpCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No keywords found</h3>
            <p className="text-slate-400 max-w-md mb-6">
              Add your first keyword using the form above to help categorize articles
            </p>
          </div>
        ) : filteredKeywords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-800/70 flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No keywords found</h3>
            <p className="text-slate-400 max-w-md mb-6">
              {searchTerm 
                ? `No keywords match "${searchTerm}". Try adjusting your search terms.`
                : showActiveOnly 
                  ? "No active keywords found. Try toggling the Active Only filter."
                  : "No keywords to display."
              }
            </p>
            {(searchTerm || showActiveOnly) && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setShowActiveOnly(false);
                }}
                className="border-slate-600/50 hover:border-slate-500/70 hover:bg-white/10 text-white"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {/* Use filteredKeywords for display */}
            {filteredKeywords
              .sort((a,b) => a.term > b.term ? 1 : -1)
              .map((keyword) => {
              // Check if this item has a pending action
              const isPending = toggleKeyword.isPending && toggleKeyword.variables?.id === keyword.id;
              console.log(isPending)
              const isCurrentlyActive = 
                toggleKeyword.isPending && toggleKeyword.variables?.id === keyword.id
                  ? toggleKeyword.variables.active 
                  : keyword.active;
              
              return (
                <div 
                  key={keyword.id} 
                  className={cn(
                    "relative border border-slate-700/50 rounded-md overflow-hidden",
                    "transition-all duration-200",
                    isPending 
                      ? "border-orange-500/50 shadow-orange-500/10 shadow-md" 
                      : "hover:border-slate-500",
                    keyword.active ? "bg-primary/5" : "bg-slate-800/70"
                  )}
                >
                  {/* Show loading indicator for pending items */}
                  {isPending && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                
                  <div className={cn(
                    "absolute top-0 right-0 h-6 w-6 flex items-center justify-center",
                    "rounded-bl-lg",
                    keyword.active ? "bg-green-500/20" : "bg-slate-500/20"
                  )}>
                    {keyword.active ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center",
                          keyword.active ? "bg-primary/20" : "bg-slate-500/20"
                        )}>
                          <Tag className={cn(
                            "h-4 w-4", 
                            keyword.active ? "text-primary" : "text-slate-400"
                          )} />
                        </div>
                        <h3 className="font-medium text-white">{keyword.term}</h3>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isCurrentlyActive}
                          disabled={toggleKeyword.isPending}
                          onCheckedChange={(checked) =>
                            toggleKeyword.mutate({ id: keyword.id, active: checked })
                          }
                        />
                        <span className={cn(
                          "text-xs font-medium",
                          isCurrentlyActive ? "text-green-400" : "text-slate-400",
                          isPending && "opacity-50"
                        )}>
                          {isCurrentlyActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => deleteKeyword.mutate(keyword.id)}
                        className={cn(
                          "h-fit w-fit",
                          "rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10",
                          "p-2"
                        )}
                      >
                        <Trash2 className="h-4 w-4 text-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
