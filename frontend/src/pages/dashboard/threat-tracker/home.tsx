import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { ArticleCard } from "@/components/ui/article-card";
import { apiRequest } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import type { ThreatArticle, ThreatKeyword } from "@shared/db/schema/threat-tracker/index";
import { queryClient } from "@/lib/query-client";
import {
  Loader2,
  Shield,
  Filter,
  Search,
  ArrowRight,
  Trash2,
  AlertTriangle,
  X,
  Plus,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useToast } from "@/hooks/use-toast";
import { serverUrl } from "@/utils/server-url";
import { Link } from "react-router-dom";
import { ThreatArticleCard } from "./components/threat-article-card";

export default function ThreatHome() {
  const { toast } = useToast();
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{
    startDate?: Date;
    endDate?: Date;
  }>({});
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [keywordAutocompleteOpen, setKeywordAutocompleteOpen] = useState<boolean>(false);
  const [keywordSearchTerm, setKeywordSearchTerm] = useState<string>("");
  
  // Local state for optimistic UI updates
  const [localArticles, setLocalArticles] = useState<ThreatArticle[]>([]);
  // Track pending operations for visual feedback
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  
  // Fetch keywords for filter dropdown
  const keywords = useQuery<ThreatKeyword[]>({
    queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/threat-tracker/keywords`, {
          method: "GET",
          credentials: "include",
          headers: {
            ...csfrHeaderObject(),
          },
        });
        if (!response.ok) throw new Error('Failed to fetch keywords');
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error("Error fetching keywords:", error);
        return [];
      }
    },
  });
  
  // Build query string for filtering
  const buildQueryString = () => {
    const params = new URLSearchParams();
    
    if (searchTerm) {
      params.append("search", searchTerm);
    }
    
    if (selectedKeywordIds.length > 0) {
      selectedKeywordIds.forEach(id => {
        params.append("keywordIds", id);
      });
    }
    
    if (dateRange.startDate) {
      params.append("startDate", dateRange.startDate.toISOString());
    }
    
    if (dateRange.endDate) {
      params.append("endDate", dateRange.endDate.toISOString());
    }
    
    return params.toString();
  };
  
  // Articles query with filtering
  const articles = useQuery<ThreatArticle[]>({
    queryKey: [`${serverUrl}/api/threat-tracker/articles`, searchTerm, selectedKeywordIds, dateRange],
    queryFn: async () => {
      try {
        const queryString = buildQueryString();
        const url = `${serverUrl}/api/threat-tracker/articles${queryString ? `?${queryString}` : ''}`;
        
        console.log("Fetching articles with URL:", url);
        console.log("Filter parameters:", {
          search: searchTerm,
          keywordIds: selectedKeywordIds,
          ...dateRange
        });
        
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: {
            ...csfrHeaderObject(),
          },
        });
        
        if (!response.ok) throw new Error('Failed to fetch articles');
        const data = await response.json();
        console.log("Received filtered articles:", data.length);
        return data || [];
      } catch (error) {
        console.error("Error fetching articles:", error);
        return [];
      }
    },
  });
  
  // Sync local state with query data when it changes
  useEffect(() => {
    if (articles.data) {
      setLocalArticles(articles.data);
    }
  }, [articles.data]);
  
  // Delete article mutation
  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `${serverUrl}/api/threat-tracker/articles/${id}`);
    },
    onMutate: (id) => {
      // Optimistic update - remove article from local state
      setLocalArticles(prev => prev.filter(article => article.id !== id));
      // Add to pending operations
      setPendingItems(prev => new Set(prev).add(id));
    },
    onSuccess: (_, id) => {
      toast({
        title: "Article deleted",
        description: "The article has been successfully deleted.",
      });
      // Remove from pending operations
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
    },
    onError: (error, id) => {
      console.error("Error deleting article:", error);
      toast({
        title: "Error deleting article",
        description: "There was an error deleting the article. Please try again.",
        variant: "destructive",
      });
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      // Remove from pending operations
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    },
  });
  
  // Delete all articles mutation
  const deleteAllArticles = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `${serverUrl}/api/threat-tracker/articles`);
    },
    onMutate: () => {
      // Optimistic update - clear local articles
      setLocalArticles([]);
    },
    onSuccess: () => {
      toast({
        title: "All articles deleted",
        description: "All articles have been successfully deleted.",
      });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
    },
    onError: (error) => {
      console.error("Error deleting all articles:", error);
      toast({
        title: "Error deleting articles",
        description: "There was an error deleting all articles. Please try again.",
        variant: "destructive",
      });
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
    },
  });
  
  // Mark article for capsule mutation
  const markArticleForCapsule = useMutation({
    mutationFn: async ({ id, marked }: { id: string; marked: boolean }) => {
      const endpoint = marked ? 
        `${serverUrl}/api/threat-tracker/articles/${id}/mark-for-capsule` : 
        `${serverUrl}/api/threat-tracker/articles/${id}/unmark-for-capsule`;
      return apiRequest("POST", endpoint);
    },
    onMutate: ({ id, marked }) => {
      // Add to pending operations
      setPendingItems(prev => new Set(prev).add(id));
      // Optimistic update
      setLocalArticles(prev => 
        prev.map(article => 
          article.id === id 
            ? { ...article, markedForCapsule: marked } 
            : article
        )
      );
    },
    onSuccess: (_, { id, marked }) => {
      toast({
        title: marked ? "Article marked for News Capsule" : "Article unmarked",
        description: marked 
          ? "The article has been marked and can be included in News Capsule reports." 
          : "The article has been unmarked for News Capsule.",
      });
      // Remove from pending operations
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
    },
    onError: (error, { id }) => {
      console.error("Error marking article:", error);
      toast({
        title: "Error updating article",
        description: "There was an error updating the article. Please try again.",
        variant: "destructive",
      });
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      // Remove from pending operations
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    },
  });

  // Send article to News Capsule
  const sendToCapsule = async (url: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/news-capsule/process-url`, {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject(),
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send to capsule: ${response.statusText}`);
      }

      toast({
        title: "Article sent to News Capsule",
        description: "The article has been successfully sent for processing.",
      });
    } catch (error) {
      console.error("Send to capsule error:", error);
      toast({
        title: "Error",
        description: "Failed to send article to News Capsule. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Function to handle keyword filtering
  const toggleKeywordFilter = (keywordId: string) => {
    setSelectedKeywordIds(prev => 
      prev.includes(keywordId)
        ? prev.filter(id => id !== keywordId)
        : [...prev, keywordId]
    );
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedKeywordIds([]);
    setDateRange({});
  };
  
  // Function to handle article deletion
  const handleDeleteArticle = (id: string) => {
    deleteArticle.mutate(id);
  };
  
  // Function to handle marking for capsule
  const handleMarkForCapsule = (id: string, currentlyMarked: boolean) => {
    markArticleForCapsule.mutate({ id, marked: !currentlyMarked });
  };
  
  // Handle delete all articles
  const handleDeleteAllArticles = () => {
    deleteAllArticles.mutate();
  };
  
  // Group keywords by category
  const keywordsByCategory = {
    threat: keywords.data?.filter(k => k.category === 'threat') || [],
    vendor: keywords.data?.filter(k => k.category === 'vendor') || [],
    client: keywords.data?.filter(k => k.category === 'client') || [],
    hardware: keywords.data?.filter(k => k.category === 'hardware') || [],
  };

  // Filter keywords for autocomplete based on search term
  const filteredKeywords = useMemo(() => {
    if (!keywords.data) return [];
    
    return keywords.data.filter((keyword) => {
      const matchesSearch = keywordSearchTerm === "" || 
        keyword.term.toLowerCase().includes(keywordSearchTerm.toLowerCase());
      const notAlreadySelected = !selectedKeywordIds.includes(keyword.id);
      return matchesSearch && notAlreadySelected && keyword.active;
    });
  }, [keywords.data, keywordSearchTerm, selectedKeywordIds]);

  // Get selected keywords for display
  const selectedKeywords = useMemo(() => {
    if (!keywords.data) return [];
    return keywords.data.filter(k => selectedKeywordIds.includes(k.id));
  }, [keywords.data, selectedKeywordIds]);

  // Add keyword to selection
  const addKeywordToFilter = (keywordId: string) => {
    if (!selectedKeywordIds.includes(keywordId)) {
      setSelectedKeywordIds(prev => [...prev, keywordId]);
    }
    setKeywordSearchTerm("");
    setKeywordAutocompleteOpen(false);
  };

  // Remove keyword from selection
  const removeKeywordFromFilter = (keywordId: string) => {
    setSelectedKeywordIds(prev => prev.filter(id => id !== keywordId));
  };
  
  return (
    <>
      <div className="flex flex-col gap-6 md:gap-10 mb-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            Threat Tracker
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl">
            Monitor cybersecurity threats affecting your vendors, clients, and hardware/software to stay ahead of potential vulnerabilities.
          </p>
        </div>


      </div>

      <div className="flex flex-col w-full gap-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="relative w-full md:w-1/2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              className="pl-9 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {selectedKeywordIds.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedKeywordIds.length}
                </Badge>
              )}
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-1.5"
                  disabled={localArticles.length === 0 || deleteAllArticles.isPending}
                >
                  {deleteAllArticles.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete all threat articles. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllArticles}>
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {/* Filters section */}
        {isFilterOpen && (
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Filter Options</h3>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs"
                >
                  Clear all
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsFilterOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Keyword Autocomplete Filter */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Add Keywords</h4>
                <Popover open={keywordAutocompleteOpen} onOpenChange={setKeywordAutocompleteOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 justify-between"
                      onClick={() => setKeywordAutocompleteOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add keyword filter
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search keywords..."
                        value={keywordSearchTerm}
                        onValueChange={setKeywordSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>No keywords found.</CommandEmpty>
                        {filteredKeywords.length > 0 && (
                          <>
                            <CommandGroup heading="Threat Keywords">
                              {filteredKeywords
                                .filter(k => k.category === 'threat')
                                .map((keyword) => (
                                  <CommandItem
                                    key={keyword.id}
                                    value={keyword.term}
                                    onSelect={() => addKeywordToFilter(keyword.id)}
                                  >
                                    <Shield className="h-4 w-4 mr-2 text-red-500" />
                                    {keyword.term}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup heading="Vendors">
                              {filteredKeywords
                                .filter(k => k.category === 'vendor')
                                .map((keyword) => (
                                  <CommandItem
                                    key={keyword.id}
                                    value={keyword.term}
                                    onSelect={() => addKeywordToFilter(keyword.id)}
                                  >
                                    <div className="h-4 w-4 mr-2 bg-blue-500 rounded-sm" />
                                    {keyword.term}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup heading="Clients">
                              {filteredKeywords
                                .filter(k => k.category === 'client')
                                .map((keyword) => (
                                  <CommandItem
                                    key={keyword.id}
                                    value={keyword.term}
                                    onSelect={() => addKeywordToFilter(keyword.id)}
                                  >
                                    <div className="h-4 w-4 mr-2 bg-green-500 rounded-sm" />
                                    {keyword.term}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup heading="Hardware">
                              {filteredKeywords
                                .filter(k => k.category === 'hardware')
                                .map((keyword) => (
                                  <CommandItem
                                    key={keyword.id}
                                    value={keyword.term}
                                    onSelect={() => addKeywordToFilter(keyword.id)}
                                  >
                                    <div className="h-4 w-4 mr-2 bg-orange-500 rounded-sm" />
                                    {keyword.term}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Selected Keywords Display */}
              {selectedKeywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">Active Filters</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedKeywords.map((keyword) => (
                      <Badge
                        key={keyword.id}
                        variant="default"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeKeywordFromFilter(keyword.id)}
                      >
                        {keyword.term}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Client Keywords */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Clients</h4>
                <div className="flex flex-wrap gap-1.5">
                  {keywordsByCategory.client.map((keyword) => (
                    <Badge
                      key={keyword.id}
                      variant={selectedKeywordIds.includes(keyword.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleKeywordFilter(keyword.id)}
                    >
                      {keyword.term}
                    </Badge>
                  ))}
                  {keywordsByCategory.client.length === 0 && (
                    <span className="text-xs text-muted-foreground">No clients defined</span>
                  )}
                </div>
              </div>
              
              {/* Hardware/Software Keywords */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Hardware/Software</h4>
                <div className="flex flex-wrap gap-1.5">
                  {keywordsByCategory.hardware.map((keyword) => (
                    <Badge
                      key={keyword.id}
                      variant={selectedKeywordIds.includes(keyword.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleKeywordFilter(keyword.id)}
                    >
                      {keyword.term}
                    </Badge>
                  ))}
                  {keywordsByCategory.hardware.length === 0 && (
                    <span className="text-xs text-muted-foreground">No hardware/software defined</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Articles display */}
        <div className="space-y-4">
          {articles.isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : localArticles.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {localArticles.map((article) => (
                <ThreatArticleCard
                  key={article.id}
                  article={article}
                  isPending={pendingItems.has(article.id)}
                  onDelete={() => handleDeleteArticle(article.id)}
                  onKeywordClick={(keyword, category) => {
                    // Add the keyword to the filter
                    const keywordObj = keywords.data?.find(k => k.term === keyword && k.category === category);
                    if (keywordObj && !selectedKeywordIds.includes(keywordObj.id)) {
                      setSelectedKeywordIds(prev => [...prev, keywordObj.id]);
                    }
                  }}
                  onSendToCapsule={sendToCapsule}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 rounded-lg border border-dashed">
              <h3 className="font-semibold text-xl mb-2">No threat articles found</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Start by adding sources and keywords to monitor for security threats, or adjust your search filters.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button asChild>
                  <Link to="/dashboard/threat/sources">Add Sources</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard/threat/keywords">Manage Keywords</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}