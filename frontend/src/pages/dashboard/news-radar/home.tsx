import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
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
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{
    startDate?: Date;
    endDate?: Date;
  }>({});
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  
  // Local state for optimistic UI updates
  const [localArticles, setLocalArticles] = useState<Article[]>([]);
  // Track pending operations for visual feedback
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  // Track last visit timestamp for "new" badge functionality
  const [lastVisitTimestamp, setLastVisitTimestamp] = useState<string | null>(null);
  
  // Fetch keywords for filter dropdown
  const keywords = useQuery<Keyword[]>({
    queryKey: ["/api/news-tracker/keywords"],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/keywords`, {
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
    staleTime: 0, // Always refetch on component mount
    refetchOnMount: true, // Force refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
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
  const articles = useQuery<Article[]>({
    queryKey: ["/api/news-tracker/articles", searchTerm, selectedKeywordIds, dateRange],
    queryFn: async () => {
      try {
        const queryString = buildQueryString();
        const url = `${serverUrl}/api/news-tracker/articles${queryString ? `?${queryString}` : ''}`;
        
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
        if (data.length > 0) {
          console.log("Sample article data:", {
            id: data[0].id,
            title: data[0].title.substring(0, 30) + "...",
            detected_keywords: data[0].detectedKeywords,
            rawArticleKeys: Object.keys(data[0])
          });
        }
        return data || [];
      } catch (error) {
        console.error("Error fetching articles:", error);
        return []; // Return empty array instead of undefined to prevent errors
      }
    },
  });
  
  // Toggle keyword selection for filtering
  const toggleKeywordSelection = (keywordId: string) => {
    setSelectedKeywordIds(prev => {
      if (prev.includes(keywordId)) {
        console.log("Removing keyword from selection");
        return prev.filter(id => id !== keywordId);
      } else {
        console.log("Adding keyword to selection");
        return [...prev, keywordId];
      }
    });
  };
  
  // Handle search input changes with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Set date range
  const handleDateRangeChange = (range: {startDate?: Date; endDate?: Date}) => {
    setDateRange(range);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedKeywordIds([]);
    setDateRange({});
    setIsFilterOpen(false);
  };
  
  // Handle keyword click from article card
  const handleKeywordClick = (keywordTerm: string) => {
    // First check if we have this keyword in our list
    if (keywords.data) {
      const keyword = keywords.data.find(k => k.term.toLowerCase() === keywordTerm.toLowerCase());
      
      if (keyword) {
        // Keyword exists - toggle its selection
        toggleKeywordSelection(keyword.id);
      } else {
        // For now, just log if we don't find the keyword
        console.log(`Keyword "${keywordTerm}" not found in your keywords list`);
        // Optionally, you could show a toast message here
        toast({
          title: "Keyword not in your list",
          description: `"${keywordTerm}" exists in articles but isn't in your keyword list. Add it in Keywords tab for filtering.`,
        });
      }
    }
  };
  
  // Initialize last visit timestamp from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('news-radar-last-visit');
    setLastVisitTimestamp(stored);
    
    // Update last visit timestamp when component mounts
    const currentTime = new Date().toISOString();
    localStorage.setItem('news-radar-last-visit', currentTime);
  }, []);

  // Sync local state with query data when it changes
  useEffect(() => {
    if (articles.data) {
      setLocalArticles(articles.data);
    }
  }, [articles.data]);

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

  // Calculate number of new articles since last visit
  const newArticlesCount = useMemo(() => {
    if (!lastVisitTimestamp) return 0;
    
    const lastVisit = new Date(lastVisitTimestamp);
    return localArticles.filter(article => {
      if (!article.publishDate) return false;
      const publishDate = new Date(article.publishDate);
      return publishDate > lastVisit;
    }).length;
  }, [lastVisitTimestamp, localArticles]);

  // Function to check if an article is new
  const isArticleNew = (article: Article): boolean => {
    if (!lastVisitTimestamp || !article.publishDate) return false;
    const lastVisit = new Date(lastVisitTimestamp);
    const publishDate = new Date(article.publishDate);
    return publishDate > lastVisit;
  };

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

  return (
    <>
      <div className="flex flex-col gap-6 sm:gap-8 md:gap-12 mb-8 sm:mb-12 md:mb-16 py-4 sm:py-6 md:py-8">
        <div className="flex flex-col gap-3 sm:gap-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            News Radar
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-3xl">
            Advanced aggregation and AI-driven content analysis for efficient
            news collection and processing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 sm:p-5 flex flex-col">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Newspaper className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs font-medium text-white/70 bg-slate-800/70 px-2 py-0.5 rounded-full">
                Automated
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-white mb-1">
              Content Scraping
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 flex-1">
              Automatically extract content from multiple sources with advanced
              browser automation
            </p>
            <div className="mt-3 sm:mt-4">
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
                  Manage Sources <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 sm:p-5 flex flex-col">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-xs font-medium text-white/70 bg-slate-800/70 px-2 py-0.5 rounded-full">
                Customizable
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-white mb-1">
              Keyword Filtering
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 flex-1">
              Set up keywords to automatically categorize and filter relevant
              articles
            </p>
            <div className="mt-3 sm:mt-4">
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
                  Manage Keywords <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 sm:p-5 md:p-6">
        <div className="flex flex-col gap-6 sm:gap-8 md:gap-10">
          {/* Header section - responsive layout for mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 md:gap-8">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                Recent Articles
              </h2>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                {localArticles.length}
              </span>
              {newArticlesCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#BF00FF] font-medium">
                    {newArticlesCount} new
                  </span>
                  <Badge className="bg-[#BF00FF] text-white hover:bg-[#BF00FF]/80 text-xs px-2 py-0">
                    NEW
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 justify-end">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="h-9 w-[160px] md:w-[200px] lg:w-[250px] pl-9 bg-white/5 border-slate-700/50 text-white placeholder:text-slate-400"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-white/10"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-3 w-3 text-slate-400" />
                  </Button>
                )}
              </div>
              
              <AlertDialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "border-slate-600 hover:bg-white/10 text-white",
                      (selectedKeywordIds.length > 0 || dateRange.startDate || dateRange.endDate) && 
                      "bg-primary/20 border-primary/50 text-primary"
                    )}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                    {(selectedKeywordIds.length > 0 || dateRange.startDate || dateRange.endDate) && (
                      <Badge variant="secondary" className="ml-2 bg-primary/30 text-primary text-xs">
                        {selectedKeywordIds.length + (dateRange.startDate ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-background border-slate-700/50 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Filter Articles</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Filter articles by keywords and date range
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  <div className="py-4 space-y-4">
                    {/* Keywords section */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-white">Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {keywords.data && keywords.data.length > 0 ? (
                          keywords.data.map((keyword: Keyword) => (
                            <Badge 
                              key={keyword.id}
                              variant={selectedKeywordIds.includes(keyword.id) ? "default" : "outline"}
                              className={cn(
                                "cursor-pointer hover:bg-white/10",
                                selectedKeywordIds.includes(keyword.id) ? 
                                "bg-primary text-primary-foreground hover:bg-primary/80" : 
                                "bg-transparent text-slate-300 border-slate-600"
                              )}
                              onClick={() => toggleKeywordSelection(keyword.id)}
                            >
                              {keyword.term}
                              {selectedKeywordIds.includes(keyword.id) && (
                                <X className="h-3 w-3 ml-1" />
                              )}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">
                            No keywords found. <Link to="/dashboard/news/keywords" className="text-primary">Add some keywords</Link> to enable filtering.
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Date range section */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-white">Date Range</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-400">Start Date</label>
                          <Input 
                            type="date"
                            value={dateRange.startDate ? new Date(dateRange.startDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : undefined;
                              handleDateRangeChange({...dateRange, startDate: date});
                            }}
                            className="bg-white/5 border-slate-700/50 text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-400">End Date</label>
                          <Input 
                            type="date"
                            value={dateRange.endDate ? new Date(dateRange.endDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : undefined;
                              handleDateRangeChange({...dateRange, endDate: date});
                            }}
                            className="bg-white/5 border-slate-700/50 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <AlertDialogFooter>
                    <Button
                      variant="ghost"
                      onClick={resetFilters}
                      className="text-slate-300 hover:text-white hover:bg-white/10"
                    >
                      Reset Filters
                    </Button>
                    <AlertDialogCancel className="border-slate-700 bg-background text-white hover:bg-white/10 hover:text-white">
                      Close
                    </AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
                {localArticles.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 sm:h-9 w-8 sm:w-9 p-0"
                        disabled={deleteAllArticles.isPending}
                      >
                        {deleteAllArticles.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
          </div>

          {articles.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5 py-2 sm:py-4">
              {/* Adjust number of skeleton items based on screen size */}
              {[...Array(window.innerWidth < 640 ? 3 : 6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-700/50 overflow-hidden"
                >
                  <div className="h-32 sm:h-40 md:h-48 bg-slate-800/50 animate-pulse" />
                  <div className="p-3 sm:p-4">
                    <div className="h-4 w-3/4 bg-slate-800/50 animate-pulse rounded mb-2" />
                    <div className="h-3 w-1/2 bg-slate-800/50 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : localArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 md:py-16 text-center">
              <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-3 sm:mb-4">
                <Newspaper className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-medium text-white mb-1 sm:mb-2">
                No articles yet
              </h3>
              <p className="text-sm sm:text-base text-slate-400 max-w-md mb-4 sm:mb-6 px-4">
                Add sources and start scraping to populate your news feed with
                the latest articles.
              </p>
              <Button asChild size="sm" className="bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] sm:py-2 sm:px-4">
                <Link to="/dashboard/news/sources">
                  Get Started with Sources
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5 pt-2 sm:pt-4 md:pt-6">
              {localArticles.map((article) => (
                <div key={article.id} className="relative">
                  {isArticleNew(article) && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <Badge className="bg-[#BF00FF] text-white hover:bg-[#BF00FF]/80 text-xs px-2 py-1 shadow-lg animate-pulse">
                        NEW
                      </Badge>
                    </div>
                  )}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "group transition-opacity duration-200 block",
                      pendingItems.has(article.id) && "opacity-60"
                    )}
                  >
                    <ArticleCard
                      article={article}
                      onDelete={(id: any) => deleteArticle.mutate(id)}
                      isPending={pendingItems.has(article.id)}
                      onKeywordClick={handleKeywordClick}
                      onSendToCapsule={sendToCapsule}
                    />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
    </>
  );
}
