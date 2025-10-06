import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { ArticleCard } from "@/components/ui/article-card";
import { apiRequest } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import type { Article, Keyword } from "@shared/db/schema/news-tracker/index";
import { queryClient } from "@/lib/query-client";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  Shield,
  FileText,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

export default function NewsHome() {
  const { toast } = useToast();
  const fetchWithAuth = useFetch();
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{
    startDate?: Date;
    endDate?: Date;
  }>({});
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [relevanceFilter, setRelevanceFilter] = useState<"all" | "high" | "medium" | "low">("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const articlesPerPage = 20;
  
  // Local state for optimistic UI updates
  const [localArticles, setLocalArticles] = useState<Article[]>([]);
  // Track pending operations for visual feedback
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  // Track last visit timestamp for "new" badge functionality
  const [lastVisitTimestamp, setLastVisitTimestamp] = useState<string | null>(null);
  // Track selected article from dashboard
  const [highlightedArticleId, setHighlightedArticleId] = useState<string | null>(null);
  
  // Three-tier toolbar state with localStorage persistence
  const [isToolbarExpanded, setIsToolbarExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('news-radar-toolbar-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Tier-specific expansion states
  const [isTier2Expanded, setIsTier2Expanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('news-radar-tier2-expanded');
    return saved !== null ? JSON.parse(saved) : false;
  });
  
  const [isTier3Expanded, setIsTier3Expanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('news-radar-tier3-expanded');
    return saved !== null ? JSON.parse(saved) : false;
  });
  
  // Available keywords display state
  const [showAllAvailableKeywords, setShowAllAvailableKeywords] = useState<boolean>(false);
  
  // Fetch keywords for filter dropdown
  const keywords = useQuery<Keyword[]>({
    queryKey: ["/api/news-tracker/keywords"],
    queryFn: async () => {
      try {
        const response = await fetchWithAuth("/api/news-tracker/keywords", {
          method: "GET",
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
    
    params.append("sort", sortOrder);
    
    if (relevanceFilter !== "all") {
      params.append("relevanceFilter", relevanceFilter);
    }
    // Send a high limit to get more articles (instead of backend default 50)
    params.append("limit", "1000");
    
    return params.toString();
  };
  
  // Articles query with filtering
  const articles = useQuery<Article[]>({
    queryKey: ["/api/news-tracker/articles", searchTerm, selectedKeywordIds, dateRange, sortOrder, relevanceFilter],
    queryFn: async () => {
      try {
        const queryString = buildQueryString();
        const url = `/api/news-tracker/articles${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetchWithAuth(url, {
          method: "GET",
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

  // Get relevance category based on article's relevance score
  const getRelevanceCategory = (article: Article): string => {
    const score = article.relevanceScore || 0;
    
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    if (score > 0) return 'low';
    return 'none'; // No keywords matched
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedKeywordIds([]);
    setDateRange({});
    setSortOrder("newest");
    setRelevanceFilter("all");
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

  // Check for selected article from dashboard
  useEffect(() => {
    const selectedArticleData = sessionStorage.getItem('selectedArticle');
    if (selectedArticleData) {
      try {
        const selectedArticle = JSON.parse(selectedArticleData);
        setHighlightedArticleId(selectedArticle.id);
        // Clear the session storage to prevent repeat highlighting
        sessionStorage.removeItem('selectedArticle');
        window.scrollTo(0,0)
        
      } catch (error) {
        console.error("Error parsing selected article:", error);
        sessionStorage.removeItem('selectedArticle');
      }
    }
  }, [toast]);

  // Save toolbar expanded state to localStorage
  useEffect(() => {
    localStorage.setItem('news-radar-toolbar-expanded', JSON.stringify(isToolbarExpanded));
  }, [isToolbarExpanded]);
  
  // Save tier expansion states to localStorage
  useEffect(() => {
    localStorage.setItem('news-radar-tier2-expanded', JSON.stringify(isTier2Expanded));
  }, [isTier2Expanded]);
  
  useEffect(() => {
    localStorage.setItem('news-radar-tier3-expanded', JSON.stringify(isTier3Expanded));
  }, [isTier3Expanded]);

  // Toggle toolbar expanded state
  const toggleToolbar = () => {
    setIsToolbarExpanded(!isToolbarExpanded);
  };

  // Sync local state with query data when it changes
  useEffect(() => {
    if (articles.data) {
      let filteredArticles = [...articles.data];
      
      // Apply relevance filtering
      if (relevanceFilter !== "all") {
        filteredArticles = filteredArticles.filter(article => {
          const articleRelevance = getRelevanceCategory(article);
          return articleRelevance === relevanceFilter;
        });
      }

      
      // Apply chronological sorting
      filteredArticles.sort((a, b) => {
        // Use publishDate if available, otherwise fall back to a default very old date
        const dateA = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const dateB = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        
        if (sortOrder === "newest") {
          return dateB - dateA; // Newest first (descending)
        } else {
          return dateA - dateB; // Oldest first (ascending)
        }
      });
      
      // If there's a highlighted article, move it to the top
      if (highlightedArticleId) {
        const highlightedIndex = filteredArticles.findIndex(article => article.id === highlightedArticleId);
        if (highlightedIndex > 0) {
          const highlightedArticle = filteredArticles.splice(highlightedIndex, 1)[0];
          filteredArticles.unshift(highlightedArticle);
        }
      }
      
      setLocalArticles(filteredArticles);
    }
  }, [articles.data, highlightedArticleId, sortOrder, relevanceFilter]);

  // Auto-select active keywords when keywords are loaded
  useEffect(() => {
    if (keywords.data && keywords.data.length > 0) {
      const activeKeywordIds = keywords.data
        .filter(keyword => keyword.active !== false) // Include keywords that are active (true or undefined)
        .map(keyword => keyword.id);
      
      // Only update if the active keywords have changed
      if (JSON.stringify(activeKeywordIds.sort()) !== JSON.stringify(selectedKeywordIds.sort())) {
        console.log("Auto-selecting active keywords:", activeKeywordIds);
        setSelectedKeywordIds(activeKeywordIds);
      }
    }
  }, [keywords.data]); // Only depend on keywords.data

  // Auto-select active keywords when keywords are loaded
  useEffect(() => {
    if (keywords.data && keywords.data.length > 0) {
      const activeKeywordIds = keywords.data
        .filter(keyword => keyword.active !== false) // Include keywords that are active (true or undefined)
        .map(keyword => keyword.id);
      
      // Only update if the active keywords have changed
      if (JSON.stringify(activeKeywordIds.sort()) !== JSON.stringify(selectedKeywordIds.sort())) {
        console.log("Auto-selecting active keywords:", activeKeywordIds);
        setSelectedKeywordIds(activeKeywordIds);
      }
    }
  }, [keywords.data]); // Only depend on keywords.data

  // Reset pagination when filters change or when an article is highlighted
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedKeywordIds, dateRange, highlightedArticleId, relevanceFilter]);

  // Calculate pagination values
  const totalArticles = localArticles.length;
  const totalPages = Math.ceil(totalArticles / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const paginatedArticles = localArticles.slice(startIndex, endIndex);

  // Pagination navigation functions
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

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
      const response = await fetchWithAuth(`/api/news-capsule/process-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  // Pagination component
  const PaginationControls = () => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;
      
      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        }
      }
      
      return pages;
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-slate-400">
            Showing {startIndex + 1}-{Math.min(endIndex, totalArticles)} of {totalArticles} articles
          </div>
          <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="h-9 px-4 font-semibold border-slate-600 hover:bg-white/10 text-white disabled:opacity-50 transition-all duration-200"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              page === '...' ? (
                <span key={index} className="px-2 text-slate-400">...</span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(page as number)}
                  className={cn(
                    "w-10 h-9 font-semibold transition-all duration-200",
                    currentPage === page
                      ? "bg-[#BF00FF] text-white hover:bg-[#BF00FF]/80"
                      : "border-slate-600 hover:bg-white/10 text-white"
                  )}
                >
                  {page}
                </Button>
              )
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="h-9 px-4 font-semibold border-slate-600 hover:bg-white/10 text-white disabled:opacity-50 transition-all duration-200"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Three-Tier Unified Toolbar Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md mb-4 transition-all duration-300">
        {!isToolbarExpanded ? (
          /* Completely Collapsed State */
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-[#A855F7]" />
                  <span className="text-base font-medium text-slate-200">News Radar Controls</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>{localArticles.length} articles</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">click to expand</span>
                <Button
                  onClick={toggleToolbar}
                  variant="ghost"
                  size="sm"
                  className="text-[#A855F7] hover:text-white hover:bg-[#9333EA]/20 border border-[#9333EA]/30 hover:border-[#9333EA]/50 transition-all duration-200"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Three-Tier Progressive Layout */
          <div className="p-4 space-y-4">
            {/* Tier 1: Quick Actions Bar (Always Visible) */}
            <div className="bg-[#9333EA]/10 border border-[#9333EA]/20 rounded-md p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-[#A855F7]" />
                  <span className="text-base font-medium text-slate-200">Search and Filter Controls</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Badge className="bg-[#00FFFF]/20 text-[#00FFFF] border-[#00FFFF]/30 text-xs px-2 py-0.5">
                    {localArticles.length}
                  </Badge>
                  <span>Found Articles</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                {/* Smart Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search"
                    className="pl-10 h-10 text-sm bg-slate-800/85 border border-slate-700 text-white placeholder:text-slate-400 hover:border-[#9333EA]/50 hover:text-white focus:border-[#00FFFF] focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-200"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>

                {/* Quick Date Filter */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-10 px-4 text-sm border transition-all duration-200 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9333EA]/30 hover:bg-transparent",
                    (dateRange.startDate || dateRange.endDate)
                      ? "border-[#9333EA] bg-[#9333EA]/20 text-[#A855F7] hover:bg-[#9333EA]/30 hover:text-white"
                      : "border-slate-600 bg-slate-800/85 text-slate-200 hover:border-[#9333EA]/50 hover:text-white hover:bg-slate-800/85"
                  )}
                  onClick={() => {
                    if (dateRange.startDate || dateRange.endDate) {
                      handleDateRangeChange({});
                    } else {
                      const now = new Date();
                      const twentyFourHoursAgo = new Date();
                      twentyFourHoursAgo.setHours(now.getHours() - 24);
                      handleDateRangeChange({ startDate: twentyFourHoursAgo, endDate: now });
                    }
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {(dateRange.startDate || dateRange.endDate) ? "Reset" : "Past 24hrs"}
                </Button>

                {/* More Filters Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTier2Expanded(!isTier2Expanded)}
                  className={cn(
                    "h-10 px-4 text-sm border transition-all duration-200 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9333EA]/30 hover:bg-transparent",
                    isTier2Expanded
                      ? "border-[#9333EA] bg-[#9333EA]/20 text-[#A855F7] hover:bg-[#9333EA]/30 hover:text-white"
                      : "border-slate-600 bg-slate-800/85 text-slate-200 hover:border-[#9333EA]/50 hover:text-white hover:bg-slate-800/85"
                  )}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  More Filters
                  {isTier2Expanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                </Button>

              </div>
            </div>

            {/* Tier 2: Enhanced Filters (Expandable) */}
            {isTier2Expanded && (
              <div className="bg-[#9333EA]/5 border border-[#9333EA]/20 rounded-md p-4 space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-[#A855F7]" />
                  <span className="text-sm font-medium text-slate-400">Advanced Filters</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">

                  {/* Sort Options & Time Period */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Time Range</h4>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { key: "newest", label: "Newest First" },
                        { key: "oldest", label: "Oldest First" }
                      ].map(({ key, label }) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className={cn(
                            "cursor-pointer text-xs px-3 py-2 transition-all duration-200 flex-1",
                            sortOrder === key
                              ? "bg-[#9333EA]/20 text-[#A855F7] border-[#9333EA]/30"
                              : "bg-slate-800/85 text-slate-200 border-slate-600 hover:border-[#9333EA]/30 hover:text-[#A855F7]"
                          )}
                          onClick={() => setSortOrder(key as any)}
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: "Today", days: 1 },
                        { label: "Week", days: 7 },
                        { label: "Month", days: 30 }
                      ].map(({ label, days }) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="cursor-pointer text-xs px-3 py-2 bg-slate-800/85 text-slate-200 border-slate-600 hover:border-[#9333EA]/30 hover:text-[#A855F7] transition-all duration-200 whitespace-nowrap flex-1"
                          onClick={() => {
                            const now = new Date();
                            const pastDate = new Date();
                            pastDate.setDate(now.getDate() - days);
                            handleDateRangeChange({ startDate: pastDate, endDate: now });
                          }}
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>


                  {/* Custom Date Range */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Custom Range</h4>
                    <div className="grid grid-cols-2 gap-1">
                      <Input
                        type="date"
                        value={dateRange.startDate ? new Date(dateRange.startDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined;
                          handleDateRangeChange({...dateRange, startDate: date});
                        }}
                        className="h-8 text-xs bg-slate-800/85 border-slate-600 text-slate-200 hover:border-[#9333EA]/30 hover:text-[#A855F7] transition-all duration-200 rounded-full [&::-webkit-calendar-picker-indicator]:filter-[invert(100%)] [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator:hover]:opacity-100"
                        placeholder="From Date"
                      />
                      <Input
                        type="date"
                        value={dateRange.endDate ? new Date(dateRange.endDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined;
                          handleDateRangeChange({...dateRange, endDate: date});
                        }}
                        className="h-8 text-xs bg-slate-800/85 border-slate-600 text-slate-200 hover:border-[#9333EA]/30 hover:text-[#A855F7] transition-all duration-200 rounded-full [&::-webkit-calendar-picker-indicator]:filter-[invert(100%)] [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator:hover]:opacity-100"
                        placeholder="To Date"
                      />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "cursor-pointer text-xs px-3 py-2 transition-all duration-200 whitespace-nowrap w-full",
                        (() => {
                          const now = new Date();
                          const yearStart = new Date(now.getFullYear(), 0, 1);
                          const isYearToDate = dateRange.startDate && dateRange.endDate &&
                            new Date(dateRange.startDate).toDateString() === yearStart.toDateString() &&
                            new Date(dateRange.endDate).toDateString() === now.toDateString();
                          return isYearToDate
                            ? "bg-[#9333EA]/20 text-[#A855F7] border-[#9333EA]/30 hover:bg-[#9333EA]/30"
                            : "bg-slate-800/85 text-slate-200 border-slate-600 hover:border-[#9333EA]/30 hover:text-[#A855F7]";
                        })()
                      )}
                      onClick={() => {
                        const now = new Date();
                        const yearStart = new Date(now.getFullYear(), 0, 1); // January 1st of current year
                        handleDateRangeChange({ startDate: yearStart, endDate: now });
                      }}
                    >
                      Year to Date
                    </Badge>
                  </div>

                  {/* Keywords Toggle */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Keywords</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTier3Expanded(!isTier3Expanded)}
                      className={cn(
                        "w-full h-10 px-4 text-sm border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9333EA]/30",
                        isTier3Expanded || selectedKeywordIds.length > 0
                          ? "border-[#9333EA] bg-[#9333EA]/20 text-[#A855F7] hover:bg-[#9333EA]/30"
                          : "border-slate-600 bg-slate-800/85 text-slate-200 hover:border-[#9333EA]/50 hover:text-white"
                      )}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Keywords ({selectedKeywordIds.length})
                      {isTier3Expanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                    </Button>
                  </div>
                </div>

              </div>
            )}

            {/* Tier 3: Keyword Management (Expandable) */}
            {isTier3Expanded && (
              <div className="bg-[#9333EA]/5 border border-[#9333EA]/20 rounded-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#A855F7]" />
                    <span className="text-sm font-medium text-slate-400">Keyword Management</span>
                    <Badge variant="outline" className="text-xs px-2 py-0.5 text-slate-400 border-slate-600">
                      {selectedKeywordIds.length} of {keywords.data?.length || 0} selected
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedKeywordIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedKeywordIds([])}
                        className="h-7 px-2 text-xs text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        Clear All
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-7 px-3 text-xs border-slate-600 hover:bg-white/10 text-slate-400 hover:text-white transition-all duration-200"
                    >
                      <Link to="/dashboard/news/keywords">
                        Manage
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Selected Keywords */}
                {selectedKeywordIds.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Selected Keywords</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedKeywordIds.map((keywordId) => {
                        const keyword = keywords.data?.find(k => k.id === keywordId);
                        return keyword ? (
                          <Badge 
                            key={keyword.id}
                            className="bg-[#9333EA]/20 text-[#A855F7] border-[#9333EA]/30 text-xs px-2 py-1 cursor-pointer group hover:bg-[#9333EA]/30 transition-all duration-200"
                            onClick={() => toggleKeywordSelection(keyword.id)}
                          >
                            {keyword.term}
                            <X className="ml-1 h-2.5 w-2.5 group-hover:text-red-300" />
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Available Keywords */}
                {keywords.data && keywords.data.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Available Keywords</h4>
                    <div className="flex flex-wrap gap-1">
                      {keywords.data
                        .filter(keyword => !selectedKeywordIds.includes(keyword.id))
                        .slice(0, showAllAvailableKeywords ? undefined : 20)
                        .map((keyword: Keyword) => (
                          <Badge 
                            key={keyword.id}
                            variant="outline"
                            className="cursor-pointer hover:bg-[#9333EA]/10 text-xs px-2 py-1 transition-colors bg-slate-800/85 text-slate-200 border-slate-600 hover:border-[#9333EA]/30 hover:text-[#A855F7]"
                            onClick={() => toggleKeywordSelection(keyword.id)}
                          >
                            {keyword.term}
                          </Badge>
                        ))}
                      {keywords.data.filter(k => !selectedKeywordIds.includes(k.id)).length > 20 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllAvailableKeywords(!showAllAvailableKeywords)}
                          className="h-7 px-2 text-xs text-slate-400 hover:text-[#A855F7] transition-colors"
                        >
                          {showAllAvailableKeywords ? 'Show Less' : `+${keywords.data.filter(k => !selectedKeywordIds.includes(k.id)).length - 20} more`}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Articles Container - Separate from actions */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-6">

          {articles.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5 py-4">
              {/* Standardized skeleton items */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-md border border-slate-700/50 bg-gradient-to-b from-transparent to-black/10 backdrop-blur-sm overflow-hidden"
                >
                  <div className="h-1.5 w-full bg-slate-800/50 animate-pulse" />
                  <div className="p-4 sm:p-5">
                    <div className="h-5 w-4/5 bg-slate-800/50 animate-pulse rounded-md mb-3" />
                    <div className="h-3 w-3/4 bg-slate-800/50 animate-pulse rounded-md mb-3" />
                    <div className="h-3 w-1/2 bg-slate-800/50 animate-pulse rounded-md mb-4" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 bg-slate-800/50 animate-pulse rounded-full" />
                      <div className="h-6 w-20 bg-slate-800/50 animate-pulse rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : localArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-full flex items-center justify-center mb-6">
                <Newspaper className="h-8 w-8 text-[#BF00FF]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                No articles yet
              </h3>
              <p className="text-slate-400 text-center max-w-md mb-8 leading-relaxed">
                Enable sources and keywords to populate your news feed with
                the latest articles and analysis.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  asChild
                  className="h-10 px-6 font-semibold bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] transition-all duration-200"
                >
                  <Link to="/dashboard/news/sources">Enable Sources</Link>
                </Button>
                <Button 
                  variant="outline" 
                  asChild
                  className="h-10 px-6 font-semibold border-slate-600 hover:bg-white/10 text-white transition-all duration-200"
                >
                  <Link to="/dashboard/news/keywords">Manage Keywords</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5 pt-2 sm:pt-4 md:pt-6">
                {paginatedArticles.map((article) => (
                  <div key={article.id} className={cn(
                    "relative",
                    article.id === highlightedArticleId && "bg-primary/10 rounded-md"
                  )}>
                    {isArticleNew(article) && (
                      <div className="absolute -top-1 -right-1 z-10">
                        <Badge className="bg-[#BF00FF] text-white hover:bg-[#BF00FF]/80 text-xs px-1.5 py-0.5 shadow-md">
                          <Star className="h-2.5 w-2.5 mr-1" />
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
                        isPending={pendingItems.has(article.id)}
                        onKeywordClick={handleKeywordClick}
                        onSendToCapsule={sendToCapsule}
                      />
                    </a>
                  </div>
                ))}
              </div>
              
              {/* Pagination controls below articles */}
              <PaginationControls />
            </div>
          )}
      </div>
    </>
  );
}
