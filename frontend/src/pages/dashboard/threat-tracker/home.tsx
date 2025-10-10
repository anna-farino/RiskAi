import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import type {
  ThreatArticle,
  ThreatKeyword,
} from "@shared/db/schema/threat-tracker/index";
import { queryClient } from "@/lib/query-client";
import {
  Shield,
  Search,
  ArrowRight,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sliders,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ThreatArticleCard } from "./components/threat-article-card";

export default function ThreatHome() {
  const { toast } = useToast();
  const fetchWithAuth = useFetch();

  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [threatLevel, setThreatLevel] = useState<string>("All");
  const [dateRange, setDateRange] = useState<string>("Today");
  const [sortOrder, setSortOrder] = useState<string>("Newest First");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Helper function to convert date range labels to actual dates
  const getDateRangeFromLabel = (label: string) => {
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];
    
    switch (label) {
      case "Today": {
        return {
          startDate: nowStr,
          endDate: nowStr
        };
      }
      case "24hrs": {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return {
          startDate: yesterday.toISOString().split('T')[0],
          endDate: nowStr
        };
      }
      case "48hrs": {
        const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        return {
          startDate: twoDaysAgo.toISOString().split('T')[0],
          endDate: nowStr
        };
      }
      case "Year to Date": {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return {
          startDate: startOfYear.toISOString().split('T')[0],
          endDate: nowStr
        };
      }
      case "All":
        return { startDate: undefined, endDate: undefined };
      case "Past 24hrs": {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return {
          startDate: yesterday.toISOString().split('T')[0],
          endDate: nowStr
        };
      }
      case "Past 7 Days": {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          startDate: weekAgo.toISOString().split('T')[0],
          endDate: nowStr
        };
      }
      case "Past Month": {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          startDate: monthAgo.toISOString().split('T')[0],
          endDate: nowStr
        };
      }
      case "All Time":
      default:
        return { startDate: undefined, endDate: undefined };
    }
  };
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [originalDateRange, setOriginalDateRange] = useState<{
    startDate?: string;
    endDate?: string;
  }>(() => {
    const now = new Date();
    return {
      startDate: now.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    };
  });
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [keywordAutocompleteOpen, setKeywordAutocompleteOpen] =
    useState<boolean>(false);
  const [keywordSearchTerm, setKeywordSearchTerm] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local state for optimistic UI updates
  const [localArticles, setLocalArticles] = useState<ThreatArticle[]>([]);
  // Track pending operations for visual feedback
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  // Track last visit timestamp for "new" badge functionality
  const [lastVisitTimestamp, setLastVisitTimestamp] = useState<string | null>(
    null,
  );
  // Track sorting state for surfacing new articles
  const [sortNewToTop, setSortNewToTop] = useState<boolean>(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const articlesPerPage = 20;
  // Track selected article from dashboard
  const [highlightedArticleId, setHighlightedArticleId] = useState<
    string | null
  >(null);


  // Fetch keywords for filter dropdown
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
      selectedKeywordIds.forEach((id) => {
        params.append("keywordIds", id);
      });
    }

    if (originalDateRange.startDate) {
      params.append("startDate", `${originalDateRange.startDate}T00:00:00.000Z`);
    }

    if (originalDateRange.endDate) {
      params.append("endDate", `${originalDateRange.endDate}T23:59:59.999Z`);
    }

    // Send a high limit to get more articles (instead of backend default 50)
    params.append("limit", "1000");

    return params.toString();
  };

  // Articles query with filtering - only fetch when keywords are selected
  const articles = useQuery<ThreatArticle[]>({
    queryKey: [
      "/api/threat-tracker/articles",
      searchTerm,
      selectedKeywordIds,
      originalDateRange,
    ],
    queryFn: async () => {
      try {
        const queryString = buildQueryString();
        const url = `/api/threat-tracker/articles${queryString ? `?${queryString}` : ""}`;

        const response = await fetchWithAuth(url, {
          method: "GET",
        });

        if (!response.ok) throw new Error("Failed to fetch articles");
        const data = await response.json();
        console.log("Received filtered articles:", data.length);
        return data || [];
      } catch (error) {
        console.error("Error fetching articles:", error);
        return [];
      }
    },
    enabled: selectedKeywordIds.length > 0, // Only fetch when keywords are selected
  });

  // Auto-select active keywords when keywords are loaded
  useEffect(() => {
    if (keywords.data && keywords.data.length > 0) {
      const activeKeywordIds = keywords.data
        .filter((keyword) => keyword.active !== false) // Include keywords that are active (true or undefined)
        .map((keyword) => keyword.id);

      // Only update if the active keywords have changed
      if (
        JSON.stringify(activeKeywordIds.sort()) !==
        JSON.stringify(selectedKeywordIds.sort())
      ) {
        console.log("Auto-selecting active keywords:", activeKeywordIds);
        setSelectedKeywordIds(activeKeywordIds);
      }
    }
  }, [keywords.data]); // Only depend on keywords.data

  // Initialize last visit timestamp from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("threat-tracker-last-visit");
    setLastVisitTimestamp(stored);

    // Update last visit timestamp when component mounts
    const currentTime = new Date().toISOString();
    localStorage.setItem("threat-tracker-last-visit", currentTime);
  }, []);

  // Sync custom date inputs with originalDateRange filter
  useEffect(() => {
    if (fromDate && toDate) {
      setOriginalDateRange({ startDate: fromDate, endDate: toDate });
      setDateRange("Custom");
    }
  }, [fromDate, toDate]);

  // Check for selected threat article from dashboard
  useEffect(() => {
    const selectedThreatData = sessionStorage.getItem("selectedThreatArticle");
    if (selectedThreatData) {
      try {
        const selectedThreat = JSON.parse(selectedThreatData);
        setHighlightedArticleId(selectedThreat.id);

        window.scrollTo(0, 0);
        // Clear the session storage to prevent repeat highlighting
        sessionStorage.removeItem("selectedThreatArticle");
      } catch (error) {
        console.error("Error parsing selected threat article:", error);
        sessionStorage.removeItem("selectedThreatArticle");
      }
    }
  }, [toast]);

  // Sync local state with query data when it changes
  useEffect(() => {
    if (articles.data) {
      let sortedArticles = [...articles.data];

      // If there's a highlighted article, move it to the top
      if (highlightedArticleId) {
        const highlightedIndex = sortedArticles.findIndex(
          (article) => article.id === highlightedArticleId,
        );
        if (highlightedIndex > 0) {
          const highlightedArticle = sortedArticles.splice(
            highlightedIndex,
            1,
          )[0];
          sortedArticles.unshift(highlightedArticle);
        }
      }

      setLocalArticles(sortedArticles);
    }
  }, [articles.data, highlightedArticleId]);

  // Reset pagination when filters change or when an article is highlighted
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedKeywordIds, originalDateRange, highlightedArticleId, threatLevel, sortOrder]);

  // Click outside handler for autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setKeywordAutocompleteOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Mark article for capsule mutation
  const markArticleForCapsule = useMutation({
    mutationFn: async ({ id, marked }: { id: string; marked: boolean }) => {
      const endpoint = marked
        ? `/api/threat-tracker/articles/${id}/mark-for-capsule`
        : `/api/threat-tracker/articles/${id}/unmark-for-capsule`;
      return fetchWithAuth(endpoint, {
        method: "POST",
      });
    },
    onMutate: ({ id, marked }) => {
      // Add to pending operations
      setPendingItems((prev) => new Set(prev).add(id));
      // Optimistic update
      setLocalArticles((prev) =>
        prev.map((article) =>
          article.id === id
            ? { ...article, markedForCapsule: marked }
            : article,
        ),
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
      setPendingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/articles"],
      });
    },
    onError: (error, { id }) => {
      console.error("Error marking article:", error);
      toast({
        title: "Error updating article",
        description:
          "There was an error updating the article. Please try again.",
        variant: "destructive",
      });
      // Revert optimistic update
      queryClient.invalidateQueries({
        queryKey: ["/api/threat-tracker/articles"],
      });
      // Remove from pending operations
      setPendingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    },
  });

  // Send article to News Capsule
  const sendToCapsule = async (url: string) => {
    try {
      const response = await fetchWithAuth("/api/news-capsule/process-url", {
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
        description:
          "Failed to send article to News Capsule. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to handle keyword filtering
  const toggleKeywordFilter = (keywordId: string) => {
    setSelectedKeywordIds((prev) =>
      prev.includes(keywordId)
        ? prev.filter((id) => id !== keywordId)
        : [...prev, keywordId],
    );
  };


  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedKeywordIds([]);
    setThreatLevel("All");
    const newDateRange = "Today";
    setDateRange(newDateRange);
    setOriginalDateRange(getDateRangeFromLabel(newDateRange));
    setSortOrder("Newest First");
    setFromDate("");
    setToDate("");
  };

  // Function to handle marking for capsule
  const handleMarkForCapsule = (id: string, currentlyMarked: boolean) => {
    markArticleForCapsule.mutate({ id, marked: !currentlyMarked });
  };

  // Group keywords by category
  const keywordsByCategory = {
    threat: keywords.data?.filter((k) => k.category === "threat") || [],
    vendor: keywords.data?.filter((k) => k.category === "vendor") || [],
    client: keywords.data?.filter((k) => k.category === "client") || [],
    hardware: keywords.data?.filter((k) => k.category === "hardware") || [],
  };

  // Filter keywords for autocomplete based on search term and only show keywords detected in articles
  const filteredKeywords = useMemo(() => {
    if (!keywords.data || !articles.data) return [];

    // Get all detected keywords from articles
    const detectedKeywordTerms = new Set<string>();
    articles.data.forEach((article) => {
      if (article.detectedKeywords) {
        const detected = article.detectedKeywords as any;
        ["threats", "vendors", "clients", "hardware"].forEach((category) => {
          if (detected[category] && Array.isArray(detected[category])) {
            detected[category].forEach((term: string) => {
              detectedKeywordTerms.add(term?.toLowerCase());
            });
          } else if (
            detected[category] &&
            typeof detected[category] === "string"
          ) {
            // Handle case where it's stored as a string
            detected[category].split(",").forEach((term: string) => {
              detectedKeywordTerms.add(term?.trim().toLowerCase());
            });
          }
        });
      }
    });

    return keywords.data.filter((keyword) => {
      const matchesSearch =
        keywordSearchTerm === "" ||
        keyword.term?.toLowerCase().includes(keywordSearchTerm.toLowerCase());
      const notAlreadySelected = !selectedKeywordIds.includes(keyword.id);
      const hasBeenDetected = detectedKeywordTerms.has(
        keyword.term?.toLowerCase(),
      );
      return (
        matchesSearch && notAlreadySelected && keyword.active && hasBeenDetected
      );
    });
  }, [keywords.data, keywordSearchTerm, selectedKeywordIds, articles.data]);

  // Get selected keywords for display
  const selectedKeywords = useMemo(() => {
    if (!keywords.data) return [];
    return keywords.data.filter((k) => selectedKeywordIds.includes(k.id));
  }, [keywords.data, selectedKeywordIds]);

  // Count how many times each selected keyword appears in current filtered results
  const keywordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    selectedKeywords.forEach(keyword => {
      let count = 0;
      localArticles.forEach(article => {
        if (article.detectedKeywords) {
          const detected = article.detectedKeywords as any;
          ["threats", "vendors", "clients", "hardware"].forEach((category) => {
            if (detected[category]) {
              let categoryTerms: string[] = [];
              if (Array.isArray(detected[category])) {
                categoryTerms = detected[category];
              } else if (typeof detected[category] === "string") {
                categoryTerms = detected[category].split(",").map((term: string) => term.trim());
              }
              
              if (categoryTerms.some(term => term.toLowerCase() === keyword.term?.toLowerCase())) {
                count++;
                return; // Exit early to avoid double-counting same article
              }
            }
          });
        }
      });
      counts[keyword.id] = count;
    });
    
    return counts;
  }, [selectedKeywords, localArticles]);

  // Add keyword to selection
  const addKeywordToFilter = (keywordId: string) => {
    if (!selectedKeywordIds.includes(keywordId)) {
      setSelectedKeywordIds((prev) => [...prev, keywordId]);
    }
    setKeywordSearchTerm("");
    setKeywordAutocompleteOpen(false);
  };

  // Remove keyword from selection
  const removeKeywordFromFilter = (keywordId: string) => {
    setSelectedKeywordIds((prev) => prev.filter((id) => id !== keywordId));
  };

  // Calculate new articles count
  const newArticlesCount = useMemo(() => {
    if (!lastVisitTimestamp || !localArticles.length) return 0;

    const lastVisit = new Date(lastVisitTimestamp);
    return localArticles.filter((article) => {
      if (!article.scrapeDate) return false;
      const scrapeDate = new Date(article.scrapeDate);
      return scrapeDate > lastVisit;
    }).length;
  }, [lastVisitTimestamp, localArticles]);

  // Function to check if an article is new
  const isArticleNew = (article: ThreatArticle): boolean => {
    if (!lastVisitTimestamp || !article.scrapeDate) return false;
    const lastVisit = new Date(lastVisitTimestamp);
    const scrapeDate = new Date(article.scrapeDate);
    return scrapeDate > lastVisit;
  };

  // Computed property for sorted articles - handles both new article surfacing and sort order
  const sortedArticles = useMemo(() => {
    let articles = [...localArticles];
    
    // Apply threat level filtering
    if (threatLevel !== "All Threats") {
      articles = articles.filter((article) => {
        const securityScore = typeof article.securityScore === "string" 
          ? parseInt(article.securityScore, 10) 
          : article.securityScore || 0;
        
        switch (threatLevel) {
          case "Critical": return securityScore >= 8;
          case "High": return securityScore >= 6 && securityScore < 8;
          case "Medium": return securityScore >= 4 && securityScore < 6;
          case "Low": return securityScore < 4;
          default: return true;
        }
      });
    }
    
    // Apply sorting
    articles.sort((a, b) => {
      // First priority: surface new articles if enabled
      if (sortNewToTop) {
        const aIsNew = isArticleNew(a);
        const bIsNew = isArticleNew(b);
        if (aIsNew !== bIsNew) {
          return aIsNew ? -1 : 1;
        }
      }
      
      // Second priority: apply sort order
      const getDate = (article: any) => {
        const date = article.publishDate || article.scrapeDate;
        return date ? new Date(date).getTime() : 0;
      };
      
      switch (sortOrder) {
        case "Oldest First":
          return getDate(a) - getDate(b);
        case "Relevance":
          const aRelevance = typeof a.relevanceScore === "string" 
            ? parseInt(a.relevanceScore, 10) 
            : a.relevanceScore || 0;
          const bRelevance = typeof b.relevanceScore === "string" 
            ? parseInt(b.relevanceScore, 10) 
            : b.relevanceScore || 0;
          return bRelevance - aRelevance;
        case "Newest First":
        default:
          return getDate(b) - getDate(a);
      }
    });
    
    return articles;
  }, [localArticles, sortNewToTop, lastVisitTimestamp, threatLevel, sortOrder]);

  // Function to handle clicking the "New" button to surface new articles
  const handleSurfaceNewArticles = () => {
    setSortNewToTop(true);
  };

  // Calculate pagination values
  const totalArticles = sortedArticles.length;
  const totalPages = Math.ceil(totalArticles / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const paginatedArticles = sortedArticles.slice(startIndex, endIndex);

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

  return (
    <>
      {/* Unified Toolbar Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md mb-px transition-all duration-300">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sliders className="h-6 w-6 text-purple-400" />
              <span className="text-xl font-semibold text-white">Threat Control Panel</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-[#00FFFF]/20 text-[#00FFFF] border-[#00FFFF]/30 text-xs px-2 py-0.5">
                {totalArticles}
              </Badge>
              <span className="text-xs text-slate-400">Found Articles</span>
            </div>
          </div>

          {/* 3-Column Compact Layout */}
          <div className="grid gap-4 lg:grid-cols-3">
            
            {/* Column 1: Search & Filter */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Search & Filter</span>
              </div>
              
              <div className="space-y-2">
                    {/* Search input */}
                    <div className="relative">
                      <Input
                        placeholder="search keywords, threats..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-8 pl-8 pr-3 text-xs bg-slate-800/85 border-slate-600 text-slate-200 placeholder:text-slate-400 focus:border-[#00FFFF] focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[#00FFFF]"
                      />
                      <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
                    </div>
                    {/* Priority filter buttons and Clear All */}
                    <div className="grid grid-cols-3 gap-1">
                      {["All", "High Priority", "Clear All"].map((option) => (
                        <Button
                          key={option}
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (option === "Clear All") {
                              clearFilters();
                            } else {
                              setThreatLevel(option === "High Priority" ? "High" : "All");
                            }
                          }}
                          className={cn(
                            "w-full h-8 px-1 text-xs font-medium justify-center transition-all duration-200 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9333EA]/30",
                            option === "Clear All"
                              ? "border-slate-600 bg-slate-800/85 text-slate-200 hover:border-[#9333EA]/50 hover:text-white hover:bg-slate-800/85"
                              : (option === "All" && threatLevel === "All") || (option === "High Priority" && threatLevel === "High")
                              ? "border-[#9333EA] bg-[#9333EA]/20 text-[#A855F7] hover:bg-[#9333EA]/30 hover:text-white"
                              : "border-slate-600 bg-slate-800/85 text-slate-200 hover:border-[#9333EA]/50 hover:text-white hover:bg-slate-800/85"
                          )}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
              </div>
            </div>

            {/* Column 2: Date Range */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Date Range</span>
              </div>
              
              <div className="space-y-2">
                    {/* Horizontal buttons for Today/24hrs/48hrs/YTD */}
                    <div className="grid grid-cols-4 gap-1">
                      {["Today", "24hrs", "48hrs", "YTD"].map((range) => (
                        <Button
                          key={range}
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const actualRange = range === "YTD" ? "Year to Date" : range;
                            setDateRange(actualRange);
                            setOriginalDateRange(getDateRangeFromLabel(actualRange));
                          }}
                          className={cn(
                            "w-full h-8 px-1 text-xs font-medium justify-center transition-all duration-200 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9333EA]/30",
                            (range === "YTD" && dateRange === "Year to Date") || (range !== "YTD" && dateRange === range)
                              ? "border-[#9333EA] bg-[#9333EA]/20 text-[#A855F7] hover:bg-[#9333EA]/30 hover:text-white"
                              : "border-slate-600 bg-slate-800/85 text-slate-200 hover:border-[#9333EA]/50 hover:text-white hover:bg-slate-800/85"
                          )}
                        >
                          {range}
                        </Button>
                      ))}
                    </div>
                    {/* Custom date range inputs */}
                    <div className="grid grid-cols-2 gap-1">
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        placeholder="From Date"
                        className="w-full h-8 px-2 text-xs bg-slate-800/85 border-slate-600 text-slate-200 placeholder:text-slate-400 focus:border-[#00FFFF] focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[#00FFFF]"
                      />
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        placeholder="To Date"
                        className="w-full h-8 px-2 text-xs bg-slate-800/85 border-slate-600 text-slate-200 placeholder:text-slate-400 focus:border-[#00FFFF] focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[#00FFFF]"
                      />
                    </div>
              </div>
            </div>

            {/* Column 3: Sort Order */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Sort Order</span>
              </div>
              
              <div className="space-y-2">
                    {/* Horizontal buttons for Oldest/Newest First */}
                    <div className="grid grid-cols-2 gap-1">
                      {["Oldest First", "Newest First"].map((order) => (
                        <Button
                          key={order}
                          variant="ghost"
                          size="sm"
                          onClick={() => setSortOrder(order)}
                          className={cn(
                            "w-full h-8 px-2 text-xs font-medium justify-center transition-all duration-200 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9333EA]/30",
                            sortOrder === order
                              ? "border-[#9333EA] bg-[#9333EA]/20 text-[#A855F7] hover:bg-[#9333EA]/30 hover:text-white"
                              : "border-slate-600 bg-slate-800/85 text-slate-200 hover:border-[#9333EA]/50 hover:text-white hover:bg-slate-800/85"
                          )}
                        >
                          {order}
                        </Button>
                      ))}
                    </div>
                    {/* More Filters button - full width */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={cn(
                        "w-full h-8 px-3 text-xs font-medium justify-center transition-all duration-200 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9333EA]/30",
                        isFilterOpen
                          ? "border-[#9333EA] bg-[#9333EA]/20 text-[#A855F7] hover:bg-[#9333EA]/30 hover:text-white"
                          : "border-slate-600 bg-slate-800/85 text-slate-200 hover:border-[#9333EA]/50 hover:text-white hover:bg-slate-800/85"
                      )}
                    >
                      <Filter className="h-3 w-3 mr-1" />
                      More Filters
                      {isFilterOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                    </Button>
                </div>
            </div>
          </div>

          {/* Integrated Filter Options Panel */}
          {isFilterOpen && (
            <div className="grid grid-cols-1 gap-4 mt-4 pt-4 border-t border-slate-700/50">
              <div className="space-y-4">
                {/* Keyword Filter Section */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-purple-300 flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Filter by Keywords
                  </h4>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Type keyword to filter (e.g., malware, vulnerability)..."
                      className="pl-9 h-8 text-xs bg-slate-800/85 border-slate-600 text-slate-200 placeholder:text-slate-400 focus:border-[#00FFFF] focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[#00FFFF]"
                      value={keywordSearchTerm}
                      onChange={(e) => {
                        setKeywordSearchTerm(e.target.value);
                        // Auto-filter based on search term
                        if (e.target.value.trim()) {
                          const matchingKeywords = keywords.data?.filter(
                            (k) =>
                              k.term
                                ?.toLowerCase()
                                .includes(e.target.value?.toLowerCase()) &&
                              k.active &&
                              !selectedKeywordIds.includes(k.id),
                          );
                          if (matchingKeywords && matchingKeywords.length > 0) {
                            setKeywordAutocompleteOpen(true);
                          }
                        } else {
                          setKeywordAutocompleteOpen(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && filteredKeywords.length > 0) {
                          addKeywordToFilter(filteredKeywords[0].id);
                        }
                      }}
                    />
                    {/* Simple dropdown for matching keywords */}
                    {keywordAutocompleteOpen && filteredKeywords.length > 0 && (
                      <div
                        ref={dropdownRef}
                        className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
                      >
                        {filteredKeywords.slice(0, 5).map((keyword) => (
                          <div
                            key={keyword.id}
                            className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center gap-2"
                            onClick={() => addKeywordToFilter(keyword.id)}
                          >
                            <div
                              className={`h-2 w-2 rounded-full ${
                                keyword.category === "threat"
                                  ? "bg-red-500"
                                  : keyword.category === "vendor"
                                    ? "bg-blue-500"
                                    : keyword.category === "client"
                                      ? "bg-green-500"
                                      : "bg-orange-500"
                              }`}
                            />
                            <span className="text-sm">{keyword.term}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {keyword.category}
                            </span>
                          </div>
                        ))}

                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Keywords Display */}
                {selectedKeywords.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-purple-300">
                      Active Keyword Filters
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedKeywords.map((keyword) => (
                        <Badge
                          key={keyword.id}
                          variant="default"
                          className="cursor-pointer hover:bg-[#9333EA]/30 hover:text-white transition-colors bg-[#9333EA]/20 text-[#A855F7] border-[#9333EA]/30 px-3 py-1.5"
                          onClick={() => removeKeywordFromFilter(keyword.id)}
                        >
                          {keyword.term}
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-[#00FFFF]/20 text-[#00FFFF] rounded-full font-medium">
                            {keywordCounts[keyword.id] || 0}
                          </span>
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>


      {/* Articles Container - Separate from actions */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-6">
        <div className="space-y-6">
          {articles.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6 py-4">
              {/* Standardized skeleton items */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-md border border-slate-700/50 bg-gradient-to-b from-transparent to-black/10 backdrop-blur-sm overflow-hidden"
                >
                  <div className="h-1.5 w-full bg-slate-800/50 animate-pulse" />
                  <div className="p-4 sm:p-5">
                    <div className="h-5 w-4/5 bg-slate-800/50 animate-pulse rounded mb-3" />
                    <div className="h-3 w-3/4 bg-slate-800/50 animate-pulse rounded mb-3" />
                    <div className="h-3 w-1/2 bg-slate-800/50 animate-pulse rounded mb-4" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 bg-slate-800/50 animate-pulse rounded-full" />
                      <div className="h-6 w-20 bg-slate-800/50 animate-pulse rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : localArticles.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6 pt-4">
                {paginatedArticles.map((article, index) => (
                  <div
                    key={article.id}
                    className={cn(
                      "relative",
                      article.id === highlightedArticleId &&
                        "bg-primary/10 rounded-md",
                    )}
                  >
                    {isArticleNew(article) && (
                      <div className="absolute -top-1 -right-1 z-10">
                        <Badge className="bg-[#BF00FF] text-white hover:bg-[#BF00FF]/80 text-xs px-1.5 py-0.5 shadow-md">
                          NEW
                        </Badge>
                      </div>
                    )}
                    <ThreatArticleCard
                      article={article}
                      isPending={pendingItems.has(article.id)}
                      onKeywordClick={(keyword, category) => {
                        // Add the keyword to the filter
                        const keywordObj = keywords.data?.find(
                          (k) => k.term === keyword && k.category === category,
                        );
                        if (
                          keywordObj &&
                          !selectedKeywordIds.includes(keywordObj.id)
                        ) {
                          setSelectedKeywordIds((prev) => [
                            ...prev,
                            keywordObj.id,
                          ]);
                        }
                      }}
                      onSendToCapsule={sendToCapsule}
                      articleIndex={startIndex + index}
                      totalArticles={totalArticles}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t border-slate-700/50">
                  <div className="text-sm text-slate-400">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalArticles)}{" "}
                    of {totalArticles} articles
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowRight className="h-3 w-3 rotate-180" />
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          let pageNumber;
                          if (totalPages <= 5) {
                            pageNumber = i + 1;
                          } else if (currentPage <= 3) {
                            pageNumber = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNumber = totalPages - 4 + i;
                          } else {
                            pageNumber = currentPage - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNumber}
                              variant={
                                currentPage === pageNumber
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => goToPage(pageNumber)}
                              className="h-8 w-8 p-0 text-xs"
                            >
                              {pageNumber}
                            </Button>
                          );
                        },
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-full flex items-center justify-center mb-6">
                <Shield className="h-8 w-8 text-[#BF00FF]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                No threat articles found
              </h3>
              <p className="text-slate-400 text-center max-w-md mb-8 leading-relaxed">
                Start by enabling sources and keywords to monitor for security
                threats, or adjust your search filters to discover potential
                vulnerabilities.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  asChild
                  className="h-10 px-6 font-semibold bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] transition-all duration-200"
                >
                  <Link to="/dashboard/threat/sources">Enable Sources</Link>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="h-10 px-6 font-semibold border-slate-600 hover:bg-white/10 text-white transition-all duration-200"
                >
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
