import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  
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

  // Click outside handler for autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setKeywordAutocompleteOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Delete all articles mutation
  const deleteAllArticles = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${serverUrl}/api/threat-tracker/articles`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...csfrHeaderObject(),
        },
      });
      if (!response.ok) throw new Error('Failed to delete articles');
      return response.json();
    },
    onSuccess: () => {
      setLocalArticles([]);
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      toast({
        title: "Success",
        description: "All articles have been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete articles.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAllArticles = () => {
    deleteAllArticles.mutate();
  };

  // Delete individual article mutation
  const deleteArticle = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetch(`${serverUrl}/api/threat-tracker/articles/${articleId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...csfrHeaderObject(),
        },
      });
      if (!response.ok) throw new Error('Failed to delete article');
      return response.json();
    },
    onMutate: async (articleId) => {
      // Optimistically remove from local state
      setLocalArticles(prev => prev.filter(article => article.id !== articleId));
      setPendingItems(prev => new Set(prev).add(articleId));
    },
    onSuccess: (_, articleId) => {
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      toast({
        title: "Success",
        description: "Article deleted successfully.",
      });
    },
    onError: (error: any, articleId) => {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
      toast({
        title: "Error",
        description: error.message || "Failed to delete article.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteArticle = (articleId: string) => {
    deleteArticle.mutate(articleId);
  };

  // Mark for News Capsule mutation
  const markForCapsule = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetch(`${serverUrl}/api/threat-tracker/articles/${articleId}/mark-for-capsule`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...csfrHeaderObject(),
        },
      });
      if (!response.ok) throw new Error('Failed to mark article for capsule');
      return response.json();
    },
    onMutate: async (articleId) => {
      // Optimistically update local state
      setLocalArticles(prev => 
        prev.map(article => 
          article.id === articleId 
            ? { ...article, markedForCapsule: true }
            : article
        )
      );
      setPendingItems(prev => new Set(prev).add(articleId));
    },
    onSuccess: (_, articleId) => {
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      toast({
        title: "Success",
        description: "Article marked for News Capsule.",
      });
    },
    onError: (error: any, articleId) => {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
      toast({
        title: "Error",
        description: error.message || "Failed to mark article for capsule.",
        variant: "destructive",
      });
    },
  });

  const handleMarkForCapsule = (articleId: string) => {
    markForCapsule.mutate(articleId);
  };

  // Unmark from News Capsule mutation
  const unmarkFromCapsule = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetch(`${serverUrl}/api/threat-tracker/articles/${articleId}/unmark-for-capsule`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...csfrHeaderObject(),
        },
      });
      if (!response.ok) throw new Error('Failed to unmark article from capsule');
      return response.json();
    },
    onMutate: async (articleId) => {
      // Optimistically update local state
      setLocalArticles(prev => 
        prev.map(article => 
          article.id === articleId 
            ? { ...article, markedForCapsule: false }
            : article
        )
      );
      setPendingItems(prev => new Set(prev).add(articleId));
    },
    onSuccess: (_, articleId) => {
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      toast({
        title: "Success",
        description: "Article unmarked from News Capsule.",
      });
    },
    onError: (error: any, articleId) => {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: [`${serverUrl}/api/threat-tracker/articles`] });
      setPendingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
      toast({
        title: "Error",
        description: error.message || "Failed to unmark article from capsule.",
        variant: "destructive",
      });
    },
  });

  const handleUnmarkFromCapsule = (articleId: string) => {
    unmarkFromCapsule.mutate(articleId);
  };

  // Get filtered keywords for autocomplete
  const filteredKeywords = useMemo(() => {
    if (!keywords.data) return [];
    
    return keywords.data.filter(keyword => 
      keyword.term.toLowerCase().includes(keywordSearchTerm.toLowerCase()) &&
      !selectedKeywordIds.includes(keyword.id)
    );
  }, [keywords.data, keywordSearchTerm, selectedKeywordIds]);

  // Get selected keywords for display
  const selectedKeywords = useMemo(() => {
    if (!keywords.data) return [];
    
    return keywords.data.filter(keyword => 
      selectedKeywordIds.includes(keyword.id)
    );
  }, [keywords.data, selectedKeywordIds]);

  const addKeyword = (keywordId: string) => {
    setSelectedKeywordIds(prev => [...prev, keywordId]);
    setKeywordSearchTerm("");
    setKeywordAutocompleteOpen(false);
  };

  const removeKeyword = (keywordId: string) => {
    setSelectedKeywordIds(prev => prev.filter(id => id !== keywordId));
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedKeywordIds([]);
    setDateRange({});
  };

  const hasActiveFilters = searchTerm || selectedKeywordIds.length > 0 || dateRange.startDate || dateRange.endDate;

  if (articles.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Threat Articles</h1>
          <p className="text-muted-foreground">
            Monitor and analyze cybersecurity threats from various sources
          </p>
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Filter toggle */}
          <Button
            variant={isFilterOpen ? "default" : "outline"}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && !isFilterOpen && (
              <Badge variant="secondary" className="ml-1">
                {[
                  searchTerm && "search",
                  selectedKeywordIds.length > 0 && `${selectedKeywordIds.length} keywords`,
                  (dateRange.startDate || dateRange.endDate) && "date range"
                ].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Expandable filters */}
        {isFilterOpen && (
          <div className="space-y-4 rounded-lg border p-4">
            {/* Keywords filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Keywords</label>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Input
                    placeholder="Search keywords..."
                    value={keywordSearchTerm}
                    onChange={(e) => {
                      setKeywordSearchTerm(e.target.value);
                      setKeywordAutocompleteOpen(true);
                    }}
                    onFocus={() => setKeywordAutocompleteOpen(true)}
                    className="pr-8"
                  />
                  <Plus className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
                
                {/* Autocomplete dropdown */}
                {keywordAutocompleteOpen && filteredKeywords.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                    {filteredKeywords.slice(0, 10).map((keyword) => (
                      <button
                        key={keyword.id}
                        onClick={() => addKeyword(keyword.id)}
                        className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <span>{keyword.term}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {keyword.category}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Selected keywords */}
              {selectedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedKeywords.map((keyword) => (
                    <Badge key={keyword.id} variant="secondary" className="flex items-center gap-1">
                      {keyword.term}
                      <button
                        onClick={() => removeKeyword(keyword.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground">
            Showing {localArticles.length} filtered articles
          </div>
        )}
      </div>

      {/* Articles grid */}
      {localArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No articles found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters 
              ? "Try adjusting your filters or search terms."
              : "Articles will appear here when sources are scraped."
            }
          </p>
          <Link to="/dashboard/threat/sources">
            <Button variant="outline" className="flex items-center gap-2">
              Manage Sources
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {localArticles.map((article) => (
            <ThreatArticleCard
              key={article.id}
              article={article}
              isPending={pendingItems.has(article.id)}
              onDelete={() => handleDeleteArticle(article.id)}
              onMarkForCapsule={() => handleMarkForCapsule(article.id)}
              onUnmarkFromCapsule={() => handleUnmarkFromCapsule(article.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}