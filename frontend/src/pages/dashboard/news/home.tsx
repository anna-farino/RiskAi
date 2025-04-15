import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { ArticleCard } from "@/components/ui/article-card";
import { apiRequest } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import type { Article, Keyword } from "@shared/db/schema/news-tracker/index";
import { queryClient } from "@/lib/query-client";
import {
  Loader2,
  Newspaper,
  Filter,
  Search,
  ArrowRight,
  Trash2,
  AlertTriangle,
  X,
  Calendar,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function NewsHome() {
  const { toast } = useToast();
  
  // Local state for optimistic UI updates
  const [localArticles, setLocalArticles] = useState<Article[]>([]);
  // Track pending operations for visual feedback
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Debounce search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Build query parameters for API call
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    
    // Add search query if provided
    if (debouncedSearchQuery) {
      params.append('search', debouncedSearchQuery);
    }
    
    // Add keyword IDs if selected
    if (selectedKeywordIds.length > 0) {
      params.append('keywordIds', selectedKeywordIds.join(','));
    }
    
    // Add date range if provided
    if (startDate) {
      params.append('startDate', startDate.toISOString());
    }
    
    if (endDate) {
      params.append('endDate', endDate.toISOString());
    }
    
    return params.toString();
  }, [debouncedSearchQuery, selectedKeywordIds, startDate, endDate]);
  
  // Fetch articles with filters
  const articles = useQuery<Article[]>({
    queryKey: [
      "/api/news-tracker/articles", 
      debouncedSearchQuery, 
      selectedKeywordIds.join(','), // Convert array to string to ensure proper dependency tracking
      startDate?.toISOString(), 
      endDate?.toISOString()
    ],
    queryFn: async () => {
      try {
        const queryParams = buildQueryParams();
        const url = `${serverUrl}/api/news-tracker/articles${queryParams ? `?${queryParams}` : ''}`;
        
        console.log('Fetching articles with URL:', url);
        console.log('Filter parameters:', {
          search: debouncedSearchQuery,
          keywordIds: selectedKeywordIds,
          startDate,
          endDate
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
        console.log('Received filtered articles:', data.length);
        return data || [];
      } catch (error) {
        console.error('Error fetching articles:', error);
        return []; // Return empty array instead of undefined to prevent errors
      }
    },
    refetchOnWindowFocus: false, // Prevent unnecessary refetching when window regains focus
  });
  
  // Sync local state with query data when it changes
  useEffect(() => {
    if (articles.data) {
      setLocalArticles(articles.data);
    }
  }, [articles.data]);
  
  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedKeywordIds([]);
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      try {
        // Use fetch directly to handle empty responses properly
        const response = await fetch(`${serverUrl}/api/news-tracker/articles/${id}`, {
          method: "DELETE",
          headers: csfrHeaderObject(),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete article: ${response.statusText}`);
        }
        
        // Don't try to parse JSON - some DELETE endpoints return empty responses
        return { success: true, id };
      } catch (error) {
        console.error("Delete article error:", error);
        throw error;
      }
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/articles"] });
      
      // Snapshot the previous values
      const previousArticles = queryClient.getQueryData<Article[]>(["/api/news-tracker/articles"]);
      const previousLocalArticles = [...localArticles];
      
      // Add to pendingItems to show loading indicator
      setPendingItems(prev => new Set(prev).add(id));
      
      // Optimistically update local state for immediate UI feedback
      setLocalArticles(prev => prev.filter(article => article.id !== id));
      
      // Optimistically update React Query cache
      queryClient.setQueryData<Article[]>(["/api/news-tracker/articles"], (oldData = []) => {
        return oldData.filter(article => article.id !== id);
      });
      
      // Return a context object with the snapshotted values
      return { previousArticles, previousLocalArticles, id };
    },
    onError: (err, id, context) => {
      if (context) {
        // If the mutation fails, restore both local state and React Query cache
        setLocalArticles(context.previousLocalArticles);
        queryClient.setQueryData<Article[]>(["/api/news-tracker/articles"], context.previousArticles);
        
        // Remove from pending items
        setPendingItems(prev => {
          const updated = new Set(prev);
          updated.delete(id);
          return updated;
        });
      }
      
      toast({
        title: "Error deleting article",
        description: "Failed to delete article. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, id) => {
      // Remove from pending items
      setPendingItems(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
      
      // Don't invalidate - optimistic delete already removed the item
      toast({
        title: "Article deleted successfully",
      });
    },
  });

  const deleteAllArticles = useMutation({
    mutationFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/articles`, {
          method: "DELETE",
          headers: csfrHeaderObject(),
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete all articles: ${response.statusText}`);
        }
        
        // Try to parse JSON response
        try {
          const data = await response.json();
          return data;
        } catch (e) {
          // If parsing fails, just return success
          return { success: true, deletedCount: 0 };
        }
      } catch (error) {
        console.error("Delete all articles error:", error);
        throw error;
      }
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/news-tracker/articles"] });
      
      // Snapshot the previous articles
      const previousArticles = queryClient.getQueryData<Article[]>(["/api/news-tracker/articles"]);
      const previousLocalArticles = [...localArticles];
      
      // Optimistically clear the articles in local state
      setLocalArticles([]);
      
      // Optimistically clear the articles in React Query cache
      queryClient.setQueryData<Article[]>(["/api/news-tracker/articles"], []);
      
      return { previousArticles, previousLocalArticles };
    },
    onError: (error, variables, context) => {
      if (context) {
        // If the mutation fails, restore both local state and React Query cache
        setLocalArticles(context.previousLocalArticles);
        queryClient.setQueryData<Article[]>(["/api/news-tracker/articles"], context.previousArticles);
      }
      
      toast({
        title: "Error",
        description: "Failed to delete articles. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data: {
      success: boolean;
      message?: string;
      deletedCount: number;
    }) => {
      // Don't invalidate - optimistic update already cleared the list
      toast({
        title: "Articles deleted",
        description: `Successfully deleted ${data.deletedCount} articles.`,
      });
    },
  });

  return (
    <>
      <div className="flex flex-col gap-6 md:gap-10 mb-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            News Radar
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl">
            Advanced aggregation and AI-driven content analysis for efficient
            news collection and processing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Newspaper className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                Automated
              </span>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              Content Scraping
            </h3>
            <p className="text-sm text-slate-400 flex-1">
              Automatically extract content from multiple sources with advanced
              browser automation
            </p>
            <div className="mt-4">
              <Button
                variant="link"
                size="sm"
                asChild
                className="p-0 h-auto text-primary hover:text-primary/80"
              >
                <Link
                  to="/dashboard/news/sources"
                  className="flex items-center gap-1"
                >
                  Manage Sources <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Filter className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                Customizable
              </span>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              Keyword Filtering
            </h3>
            <p className="text-sm text-slate-400 flex-1">
              Set up keywords to automatically categorize and filter relevant
              articles
            </p>
            <div className="mt-4">
              <Button
                variant="link"
                size="sm"
                asChild
                className="p-0 h-auto text-primary hover:text-primary/80"
              >
                <Link
                  to="/dashboard/news/keywords"
                  className="flex items-center gap-1"
                >
                  Manage Keywords <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-white">
                Recent Articles
              </h2>
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                {localArticles.length}
              </span>
            </div>
            <div className="flex items-center gap-2 w-[100%] justify-end">
              <div className="relative w-[200px] lg:w-[250px]">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search articles..."
                  className="h-9 pl-8 bg-white/5 border-slate-700/50 text-white placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "border-slate-600 hover:bg-white/10 text-white",
                  (selectedKeywordIds.length > 0 || startDate || endDate) && 
                  "border-primary bg-primary/20 text-primary hover:bg-primary/30"
                )}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {selectedKeywordIds.length > 0 || startDate || endDate ? (
                  <>Active Filters ({
                    (selectedKeywordIds.length > 0 ? 1 : 0) + 
                    ((startDate || endDate) ? 1 : 0)
                  })</>
                ) : (
                  "Filter"
                )}
              </Button>
              
              {showFilters && (
                <div className="absolute right-0 top-12 z-10 w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-lg shadow-lg p-4">
                  <div className="mb-3 flex justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Filter Articles</h3>
                      <p className="text-sm text-slate-400">Filter articles by keywords and date range</p>
                    </div>
                    <button 
                      onClick={() => setShowFilters(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-4 my-4">
                    {/* Keyword filter section */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-white">Filter by Keywords</h4>
                      
                      {/* Fetch keywords */}
                      <FetchKeywords 
                        selectedKeywordIds={selectedKeywordIds}
                        setSelectedKeywordIds={setSelectedKeywordIds}
                      />
                    </div>
                    
                    {/* Date filter section */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-white">Date Range</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Start Date</label>
                          <Input
                            type="date"
                            className="bg-white/5 border-slate-700/50 text-white"
                            value={startDate ? startDate.toISOString().slice(0, 10) : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setStartDate(new Date(e.target.value));
                              } else {
                                setStartDate(undefined);
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">End Date</label>
                          <Input
                            type="date"
                            className="bg-white/5 border-slate-700/50 text-white"
                            value={endDate ? endDate.toISOString().slice(0, 10) : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setEndDate(new Date(e.target.value));
                              } else {
                                setEndDate(undefined);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-slate-700/50">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        resetFilters();
                        setShowFilters(false);
                        // Force a refetch with the reset filters
                        queryClient.invalidateQueries({ 
                          queryKey: ["/api/news-tracker/articles"] 
                        });
                      }}
                    >
                      Reset All
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowFilters(false);
                        // Force a refetch to ensure changes are applied
                        queryClient.invalidateQueries({ 
                          queryKey: ["/api/news-tracker/articles"] 
                        });
                      }}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
              )}

              {localArticles.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="ml-2"
                      disabled={deleteAllArticles.isPending}
                    >
                      {deleteAllArticles.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will permanently delete all{" "}
                        {localArticles.length} articles. This action cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAllArticles.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Delete All Articles
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {articles.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 py-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-700/50 overflow-hidden"
                >
                  <div className="h-48 bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : localArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Newspaper className="h-8 w-8 text-slate-400" />
              </div>
              
              {debouncedSearchQuery || selectedKeywordIds.length > 0 || startDate || endDate ? (
                <>
                  <h3 className="text-xl font-medium text-white mb-2">
                    No matching articles
                  </h3>
                  <p className="text-slate-400 max-w-md mb-6">
                    No articles match your current filters. Try adjusting your search criteria or 
                    reset the filters to see all articles.
                  </p>
                  <Button onClick={() => {
                    resetFilters();
                    // Force a refetch with the reset filters
                    queryClient.invalidateQueries({ 
                      queryKey: ["/api/news-tracker/articles"] 
                    });
                  }}>Reset Filters</Button>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-medium text-white mb-2">
                    No articles yet
                  </h3>
                  <p className="text-slate-400 max-w-md mb-6">
                    Add sources and start scraping to populate your news feed with
                    the latest articles.
                  </p>
                  <Button asChild>
                    <Link to="/dashboard/news/sources">
                      Get Started with Sources
                    </Link>
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {localArticles.map((article) => (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={article.id}
                  className={cn(
                    "group transition-opacity duration-200",
                    pendingItems.has(article.id) && "opacity-60"
                  )}
                >
                  <ArticleCard
                    article={article}
                    onDelete={(id: any) => deleteArticle.mutate(id)}
                    isPending={pendingItems.has(article.id)}
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Keyword selector component
function FetchKeywords({
  selectedKeywordIds,
  setSelectedKeywordIds
}: {
  selectedKeywordIds: string[];
  setSelectedKeywordIds: (ids: string[]) => void;
}) {
  // Fetch keywords
  const { data: keywords = [] } = useQuery<{ id: string; term: string }[]>({
    queryKey: ["/api/news-tracker/keywords"],
    queryFn: async () => {
      const response = await fetch(`${serverUrl}/api/news-tracker/keywords`, {
        method: "GET",
        credentials: "include",
        headers: {
          ...csfrHeaderObject(),
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch keywords");
      }
      
      return await response.json();
    }
  });
  
  // Toggle keyword selection
  const toggleKeyword = (keywordId: string) => {
    console.log('Toggling keyword:', keywordId);
    
    // Use a callback function with setSelectedKeywordIds to ensure we're working with the latest state
    setSelectedKeywordIds(prevIds => {
      if (prevIds.includes(keywordId)) {
        console.log('Removing keyword from selection');
        const newIds = prevIds.filter(id => id !== keywordId);
        console.log('New selection:', newIds);
        return newIds;
      } else {
        console.log('Adding keyword to selection');
        const newIds = [...prevIds, keywordId];
        console.log('New selection:', newIds);
        return newIds;
      }
    });
    
    // Force an immediate invalidation of the query after state update
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/articles"] });
    }, 100);
  };
  
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selectedKeywordIds.length > 0 ? (
          selectedKeywordIds.map(id => {
            const keyword = keywords.find(k => k.id === id);
            return (
              <div 
                key={id}
                className="px-2 py-1 rounded-md bg-primary/20 text-primary text-sm flex items-center gap-1"
              >
                {keyword?.term || id}
                <button 
                  onClick={() => toggleKeyword(id)} 
                  className="hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-slate-400 text-sm">No keywords selected</div>
        )}
      </div>
      
      <div className="border border-slate-700/50 rounded-md overflow-hidden">
        <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-700/50">
          {keywords.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">No keywords available</div>
          ) : (
            keywords.map(keyword => (
              <div 
                key={keyword.id}
                className={cn(
                  "flex items-center gap-2 p-2 hover:bg-white/5 cursor-pointer transition-colors",
                  selectedKeywordIds.includes(keyword.id) && "bg-primary/20 text-primary"
                )}
                onClick={() => toggleKeyword(keyword.id)}
              >
                <Tag className="h-3.5 w-3.5 mr-1 text-slate-400" />
                <div className="text-sm">{keyword.term}</div>
                <div className="ml-auto">
                  {selectedKeywordIds.includes(keyword.id) && "✓"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
