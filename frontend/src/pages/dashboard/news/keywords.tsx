import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { Keyword, insertKeywordSchema } from "@shared/db/schema/news-tracker/index";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2, Plus, Tag, Search, Info, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";

export default function Keywords() {
  const { toast } = useToast();
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
        const response = await fetch(`${serverUrl}/api/news-tracker/keywords`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        })
        if (!response.ok) throw new Error()
        const data = await response.json()
        return data || []
      } catch(error) {
        console.error(error)
      }
    }
  });

  const addKeyword = useMutation({
    mutationFn: async (data: { term: string }) => {
      await apiRequest("POST", `${serverUrl}/api/news-tracker/keywords`, data);
    },
    onMutate: async (newKeyword) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      // Snapshot the previous value
      const previousKeywords = queryClient.getQueryData<Keyword[]>(["/api/news-tracker/keywords"]);
      
      // Generate a temporary ID for optimistic UI (will be replaced by server-generated one)
      const tempId = `temp_${Date.now()}`;
      
      // Optimistically add the new keyword
      queryClient.setQueryData<Keyword[]>(["/api/news-tracker/keywords"], (oldData = []) => [
        ...oldData,
        {
          id: tempId,
          term: newKeyword.term,
          active: true,
          userId: "current", // This will be set by the server
          createdAt: new Date().toISOString(),
        } as Keyword,
      ]);
      
      return { previousKeywords };
    },
    onError: (err, newKeyword, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData(["/api/news-tracker/keywords"], context?.previousKeywords);
      toast({
        title: "Error adding keyword",
        description: "Failed to add keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Invalidate and refetch to get the real data with server-generated ID
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/keywords"] });
      form.reset();
      toast({
        title: "Keyword added successfully",
      });
    },
  });

  const toggleKeyword = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await apiRequest("PATCH", `${serverUrl}/api/news-tracker/keywords/${id}`, { active });
    },
    onMutate: async ({ id, active }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      // Snapshot the previous value
      const previousKeywords = queryClient.getQueryData<Keyword[]>(["/api/news-tracker/keywords"]);
      
      // Optimistically update the active status
      queryClient.setQueryData<Keyword[]>(["/api/news-tracker/keywords"], (oldData = []) => 
        oldData.map((keyword) => 
          keyword.id === id ? { ...keyword, active } : keyword
        )
      );
      
      return { previousKeywords };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData(["/api/news-tracker/keywords"], context?.previousKeywords);
      toast({
        title: "Error updating keyword",
        description: "Failed to update keyword status. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Ensure consistency with server data
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/keywords"] });
    },
  });

  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${serverUrl}/api/news-tracker/keywords/${id}`);
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/keywords"] });
      
      // Snapshot the previous data
      const previousKeywords = queryClient.getQueryData<Keyword[]>(["/api/news-tracker/keywords"]);
      
      // Optimistically remove the keyword
      queryClient.setQueryData<Keyword[]>(["/api/news-tracker/keywords"], (oldData = []) => 
        oldData.filter(keyword => keyword.id !== id)
      );
      
      return { previousKeywords };
    },
    onError: (err, id, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData(["/api/news-tracker/keywords"], context?.previousKeywords);
      toast({
        title: "Error deleting keyword",
        description: "Failed to delete keyword. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Ensure consistency with server data
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/keywords"] });
      toast({
        title: "Keyword deleted successfully",
      });
    },
  });


  const onSubmit = form.handleSubmit((data) => {
    addKeyword.mutate(data);
  });

  return (
    <>
      <div className="flex flex-col gap-5 mb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Keywords</h1>
          <p className="text-slate-300">Manage keywords to categorize and filter article content</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
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
                    className="pl-9 bg-white/5 border-slate-700/50 text-white placeholder:text-slate-500"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={addKeyword.isPending}
                  className="bg-primary hover:bg-primary/90"
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

        <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-medium text-white mb-4">Keyword Stats</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Total Keywords</span>
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Tag className="h-3 w-3 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-white">{keywords.data?.length || 0}</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Active Keywords</span>
                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-white">
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

      <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-white">Keyword List</h2>
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
              className="pl-9 h-9 w-[200px] bg-white/5 border-slate-700/50 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {keywords.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : keywords.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <HelpCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No keywords found</h3>
            <p className="text-slate-400 max-w-md mb-6">
              Add your first keyword using the form above to help categorize articles
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {keywords.data?.map((keyword) => (
              <div 
                key={keyword.id} 
                className={cn(
                  "relative border border-slate-700/50 rounded-lg overflow-hidden",
                  "transition-all duration-200 hover:border-slate-500",
                  keyword.active ? "bg-primary/5" : "bg-white/5"
                )}
              >
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
                        checked={keyword.active}
                        onCheckedChange={(checked) =>
                          toggleKeyword.mutate({ id: keyword.id, active: checked })
                        }
                      />
                      <span className={cn(
                        "text-xs font-medium",
                        keyword.active ? "text-green-400" : "text-slate-400"
                      )}>
                        {keyword.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteKeyword.mutate(keyword.id)}
                      className="h-8 w-8 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
