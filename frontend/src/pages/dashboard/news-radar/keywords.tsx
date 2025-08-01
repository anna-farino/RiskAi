import { useQuery, useMutation } from "@tanstack/react-query";
import { Keyword, insertKeywordSchema } from "@shared/db/schema/news-tracker/index";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2, Plus, Tag, Search, Info, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { useState, useEffect } from "react";

export default function Keywords() {
  const fetchWithTokens = useFetch();
  const { toast } = useToast();
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
        const response = await fetchWithTokens(`/api/news-tracker/keywords`, {
          method: 'GET'
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
        const response = await fetchWithTokens(`/api/news-tracker/keywords`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
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
        const response = await fetchWithTokens(`/api/news-tracker/keywords/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ active })
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

  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      try {
        // Use fetch directly to handle empty responses properly
        const response = await fetchWithTokens(`/api/news-tracker/keywords/${id}`, {
          method: "DELETE"
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

  return (
    <>
      <div className="flex flex-col gap-5 mb-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Keywords</h1>
          <p className="text-slate-300">Manage keywords to categorize and filter article content</p>
        </div>
      </div>

      <div className=" grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <h2 className="text-lg font-medium text-white mb-2">Add Keyword</h2>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Keyword Term</label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Tag className="h-4 w-4" />
                  </div>
                  <Input
                    placeholder="Enter keyword term..."
                    {...form.register("term")}
                    className="pl-9 bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={addKeyword.isPending}
                  className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
                >
                  {addKeyword.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Add
                </Button>
              </div>
            </div>
            
            <div className="mt-2 pt-4 border-t border-slate-700/50 text-sm text-slate-400">
              <div className="flex gap-2 items-start">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>Keywords help the system identify and categorize articles during scraping and analysis</p>
              </div>
            </div>
          </form>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-medium text-white mb-4">Keyword Stats</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/70 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Total Keywords</span>
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Tag className="h-3 w-3 text-primary" />
                </div>
              </div>
              <p 
                className={cn("text-2xl font-semibold text-white ", {
                  "animate-[pulse_0.5s_ease-in-out_infinite]": keywordsAreUpdating 
                })}
              >
                {keywords.data?.length || 0}
              </p>
            </div>
            
            <div className="bg-slate-800/70 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Active Keywords</span>
                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                </div>
              </div>
              <p className={cn(
                "text-2xl font-semibold text-white", {
                  "animate-[pulse_0.5s_ease-in-out_infinite]": activeKeywordsAreUpdating 
                }
              )}>
                {keywords.data?.filter(k => k.active).length || 0}
              </p>
            </div>
          </div>
          
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border border-slate-700/50">
            <div className="flex gap-2 items-start">
              <Search className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-white mb-1">Keyword Matching</p>
                <p className="text-xs text-slate-400">
                  Keywords are automatically matched against article content during the scraping process
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="flex flex-row gap-x-4 items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="hidden sm:block text-lg font-medium text-white">Keyword List</h2>
            <h2 className="sm:hidden text-lg font-medium text-white">Keywords</h2>
            <div className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
              {keywords.data?.length || 0}
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <Input 
              placeholder="Filter keywords..."
              className="pl-9 h-9 w-full max-w-[200px] bg-slate-800/70 border-slate-700/50 text-white placeholder:text-slate-500"
            />
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
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {/* Use localKeywords for immediate UI updates */}
            {keywords.data && keywords.data
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
                    "relative border border-slate-700/50 rounded-lg overflow-hidden",
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
    </>
  );
}
