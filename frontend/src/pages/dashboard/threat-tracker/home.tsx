import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { ArticleCard } from "@/components/ui/article-card";
import { apiRequest } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import type {
  ThreatArticle,
  ThreatKeyword,
} from "@shared/db/schema/threat-tracker/index";
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
  FileText,
  Star,
  Play,
  PlayCircle,
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
  const [keywordAutocompleteOpen, setKeywordAutocompleteOpen] =
    useState<boolean>(false);
  const [keywordSearchTerm, setKeywordSearchTerm] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local state for optimistic UI updates
  const [localArticles, setLocalArticles] = useState<ThreatArticle[]>([]);
  // Track pending operations for visual feedback
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  // Track last visit timestamp for "new" badge functionality
  const [lastVisitTimestamp, setLastVisitTimestamp] = useState<string | null>(null);
  // Track sorting state for surfacing new articles
  const [sortNewToTop, setSortNewToTop] = useState<boolean>(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const articlesPerPage = 20;
  // Track selected article from dashboard
  const [highlightedArticleId, setHighlightedArticleId] = useState<string | null>(null);

  // Check scrape job status for scan all sources functionality
  const checkScrapeStatus = useQuery<{ running: boolean }>({
    queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${serverUrl}/api/threat-tracker/scrape/status`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              ...csfrHeaderObject(),
            },
          },
        );
        if (!response.ok) {
          console.warn(
            "Scrape status API returned non-ok response:",
            response.status,
          );
          return { running: false };
        }

        const data = await response.json();
        return data || { running: false };
      } catch (error) {
        console.error("Error fetching scrape status:", error);
        return { running: false };
      }
    },
    refetchInterval: 5000, // Poll every 5 seconds
    initialData: { running: false },
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Fetch keywords for filter dropdown
  const keywords = useQuery<ThreatKeyword[]>({
    queryKey: [`${serverUrl}/api/threat-tracker/keywords`],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${serverUrl}/api/threat-tracker/keywords`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              ...csfrHeaderObject(),
            },
          },
        );
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
    queryKey: [
      `${serverUrl}/api/threat-tracker/articles`,
      searchTerm,
      selectedKeywordIds,
      dateRange,
    ],
    queryFn: async () => {
      try {
        const queryString = buildQueryString();
        const url = `${serverUrl}/api/threat-tracker/articles${queryString ? `?${queryString}` : ""}`;

        console.log("Fetching articles with URL:", url);

        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: {
            ...csfrHeaderObject(),
          },
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
  });

  // Initialize last visit timestamp from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('threat-tracker-last-visit');
    setLastVisitTimestamp(stored);

    // Update last visit timestamp when component mounts
    const currentTime = new Date().toISOString();
    localStorage.setItem('threat-tracker-last-visit', currentTime);
  }, []);

  // Check for selected threat article from dashboard
  useEffect(() => {
    const selectedThreatData = sessionStorage.getItem('selectedThreatArticle');
    if (selectedThreatData) {
      try {
        const selectedThreat = JSON.parse(selectedThreatData);
        setHighlightedArticleId(selectedThreat.id);
        
        window.scrollTo(0,0)
        // Clear the session storage to prevent repeat highlighting
        sessionStorage.removeItem('selectedThreatArticle');

      } catch (error) {
        console.error("Error parsing selected threat article:", error);
        sessionStorage.removeItem('selectedThreatArticle');
      }
    }
  }, [toast]);

  // Sync local state with query data when it changes
  useEffect(() => {
    if (articles.data) {
      let sortedArticles = [...articles.data];
      
      // If there's a highlighted article, move it to the top
      if (highlightedArticleId) {
        const highlightedIndex = sortedArticles.findIndex(article => article.id === highlightedArticleId);
        if (highlightedIndex > 0) {
          const highlightedArticle = sortedArticles.splice(highlightedIndex, 1)[0];
          sortedArticles.unshift(highlightedArticle);
        }
      }
      
      setLocalArticles(sortedArticles);
    }
  }, [articles.data, highlightedArticleId]);

  // Reset pagination when filters change or when an article is highlighted
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedKeywordIds, dateRange, highlightedArticleId]);

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

  // Delete article mutation
  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(
        "DELETE",
        `${serverUrl}/api/threat-tracker/articles/${id}`,
      );
    },
    onMutate: (id) => {
      // Optimistic update - remove article from local state
      setLocalArticles((prev) => prev.filter((article) => article.id !== id));
      // Add to pending operations
      setPendingItems((prev) => new Set(prev).add(id));
    },
    onSuccess: (_, id) => {
      toast({
        title: "Article deleted",
        description: "The article has been successfully deleted.",
      });
      // Remove from pending operations
      setPendingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/articles`],
      });
    },
    onError: (error, id) => {
      console.error("Error deleting article:", error);
      toast({
        title: "Error deleting article",
        description:
          "There was an error deleting the article. Please try again.",
        variant: "destructive",
      });
      // Revert optimistic update
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/articles`],
      });
      // Remove from pending operations
      setPendingItems((prev) => {
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
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/articles`],
      });
    },
    onError: (error) => {
      console.error("Error deleting all articles:", error);
      toast({
        title: "Error deleting articles",
        description:
          "There was an error deleting all articles. Please try again.",
        variant: "destructive",
      });
      // Revert optimistic update
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/articles`],
      });
    },
  });

  // Mark article for capsule mutation
  const markArticleForCapsule = useMutation({
    mutationFn: async ({ id, marked }: { id: string; marked: boolean }) => {
      const endpoint = marked
        ? `${serverUrl}/api/threat-tracker/articles/${id}/mark-for-capsule`
        : `${serverUrl}/api/threat-tracker/articles/${id}/unmark-for-capsule`;
      return apiRequest("POST", endpoint);
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
        queryKey: [`${serverUrl}/api/threat-tracker/articles`],
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
        queryKey: [`${serverUrl}/api/threat-tracker/articles`],
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
      const response = await fetch(
        `${serverUrl}/api/news-capsule/process-url`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...csfrHeaderObject(),
          },
          body: JSON.stringify({ url }),
        },
      );

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

  // Scrape all sources mutation
  const scrapeAllSources = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `${serverUrl}/api/threat-tracker/scrape/all`);
    },
    onSuccess: () => {
      toast({
        title: "Scan for new threats started",
        description:
          "The system is now scanning all active sources for threats.",
      });
      // Start polling for status updates
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`],
      });
    },
    onError: (error) => {
      console.error("Error starting scan:", error);
      toast({
        title: "Error starting scan",
        description:
          "There was an error starting the scan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stop scrape job mutation
  const stopScrapeJob = useMutation({
    mutationFn: async () => {
      try {
        console.log("Attempting to stop global scan...");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(
          `${serverUrl}/api/threat-tracker/scrape/stop`,
          {
            method: "POST",
            headers: {
              ...csfrHeaderObject(),
              "Content-Type": "application/json",
            },
            credentials: "include",
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        console.log("Stop request response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Stop request failed with:", errorText);
          throw new Error(`Failed to stop scan: ${response.statusText}`);
        }

        try {
          const data = await response.json();
          console.log("Stop job succeeded with data:", data);
          return data || { success: true, message: "Scan stopped" };
        } catch (e) {
          console.log("No JSON response, assuming success");
          return { success: true, message: "Scan stopped" };
        }
      } catch (error) {
        console.error("Stop scan error:", error);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            "Stop request timed out. The scan may still be stopping.",
          );
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Stop global scan succeeded:", data);
      toast({
        title: "Scan stopped",
        description: "The scan has been stopped successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: [`${serverUrl}/api/threat-tracker/scrape/status`],
      });
    },
    onError: (error) => {
      console.error("Error stopping scan:", error);
      toast({
        title: "Error stopping scan",
        description:
          "There was an error stopping the scan. Please try again.",
        variant: "destructive",
      });
    },
  });

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
              detectedKeywordTerms.add(term.toLowerCase());
            });
          } else if (
            detected[category] &&
            typeof detected[category] === "string"
          ) {
            // Handle case where it's stored as a string
            detected[category].split(",").forEach((term: string) => {
              detectedKeywordTerms.add(term.trim().toLowerCase());
            });
          }
        });
      }
    });

    return keywords.data.filter((keyword) => {
      const matchesSearch =
        keywordSearchTerm === "" ||
        keyword.term.toLowerCase().includes(keywordSearchTerm.toLowerCase());
      const notAlreadySelected = !selectedKeywordIds.includes(keyword.id);
      const hasBeenDetected = detectedKeywordTerms.has(
        keyword.term.toLowerCase(),
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
    return localArticles.filter(article => {
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

  // Computed property for sorted articles - surface new articles to top when sortNewToTop is true
  const sortedArticles = useMemo(() => {
    if (!sortNewToTop) return localArticles;
    
    return [...localArticles].sort((a, b) => {
      const aIsNew = isArticleNew(a);
      const bIsNew = isArticleNew(b);
      
      // If both are new or both are not new, maintain original order
      if (aIsNew === bIsNew) return 0;
      
      // New articles come first
      return aIsNew ? -1 : 1;
    });
  }, [localArticles, sortNewToTop, lastVisitTimestamp]);

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
      {/* Header and Actions Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-4">
        <div className="flex flex-col gap-6 md:gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-wider relative">
              <span className="bg-gradient-to-r from-[#BF00FF] via-[#BF00FF]/90 to-[#00FFFF] bg-clip-text text-transparent" 
                    style={{ 
                      backgroundImage: 'linear-gradient(to right, #BF00FF, #BF00FF 40%, #00FFFF)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}>
                Threat Tracker
              </span>
            </h1>
            <p className="text-muted-foreground max-w-3xl">
              Monitor cybersecurity threats affecting your vendors, clients, and
              hardware/software to stay ahead of potential vulnerabilities.
            </p>
          </div>

          {/* Unified Control Strip */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 p-4 bg-slate-800/30 rounded-md border border-slate-700/40">
            
            {/* Left side - Threat counter and status indicators */}
            <div className="flex flex-wrap items-center gap-4 text-slate-300 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-[#BF00FF]" />
                <span className="text-sm font-semibold text-[#BF00FF]">
                  {localArticles.length} Potential Threats
                </span>
              </div>

              {newArticlesCount > 0 && !sortNewToTop && (
                <button
                  onClick={handleSurfaceNewArticles}
                  className="flex items-center gap-1.5 bg-[#BF00FF]/10 hover:bg-[#BF00FF]/20 rounded-md px-2 py-1 border border-[#BF00FF]/20 hover:border-[#BF00FF]/30 transition-all duration-200 cursor-pointer group"
                  title={`Click to surface ${newArticlesCount} new articles to top`}
                >
                  <Star className="h-3 w-3 text-[#BF00FF]" />
                  <span className="text-xs font-medium text-[#BF00FF]">
                    {newArticlesCount} New
                  </span>
                </button>
              )}
              {sortNewToTop && (
                <button
                  onClick={() => setSortNewToTop(false)}
                  className="flex items-center gap-1.5 bg-[#00FFFF]/10 hover:bg-[#00FFFF]/20 rounded-md px-2 py-1 border border-[#00FFFF]/20 hover:border-[#00FFFF]/30 transition-all duration-200 cursor-pointer group"
                  title="Click to return to chronological order"
                >
                  <Check className="h-3 w-3 text-[#00FFFF]" />
                  <span className="text-xs font-medium text-[#00FFFF]">
                    Sorted
                  </span>
                </button>
              )}
            </div>

            {/* Center - Search bar */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors" />
              <Input
                placeholder="Search threat articles..."
                className="pl-12 pr-4 h-11 w-full text-base font-medium bg-slate-800/60 border-slate-600/50 hover:border-slate-500/70 focus:border-[#BF00FF]/60 focus:ring-2 focus:ring-[#BF00FF]/20 text-white placeholder:text-slate-400 rounded-full transition-all duration-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-11 px-4 font-semibold flex items-center gap-1.5 flex-shrink-0 transition-all duration-200",
                  "border-slate-600/50 hover:border-slate-500/70 hover:bg-white/10 text-white",
                  selectedKeywordIds.length > 0 && 
                  "bg-[#BF00FF]/20 border-[#BF00FF]/50 text-[#BF00FF] hover:bg-[#BF00FF]/30 hover:border-[#BF00FF]/60"
                )}
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <Filter className="h-4 w-4" />
                Filters
                {selectedKeywordIds.length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-[#00FFFF]/20 text-[#00FFFF] border-[#00FFFF]/30">
                    {selectedKeywordIds.length}
                  </Badge>
                )}
              </Button>
              
              {highlightedArticleId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-4 font-semibold border-[#00FFFF]/50 bg-[#00FFFF]/10 text-[#00FFFF] hover:bg-[#00FFFF]/20 transition-all duration-200"
                  onClick={() => setHighlightedArticleId(null)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Selection
                </Button>
              )}

              {/* Scan for New Threats Button */}
              <Button
                onClick={() => {
                  if (checkScrapeStatus?.data?.running) {
                    stopScrapeJob.mutate();
                  } else {
                    scrapeAllSources.mutate();
                  }
                }}
                disabled={scrapeAllSources.isPending || stopScrapeJob.isPending}
                size="sm"
                className={cn(
                  "h-11 px-4 font-semibold transition-all duration-200",
                  checkScrapeStatus?.data?.running
                    ? "bg-red-600 hover:bg-red-600/80 text-white"
                    : "bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF]"
                )}
              >
                {scrapeAllSources.isPending || stopScrapeJob.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : checkScrapeStatus?.data?.running ? (
                  <X className="mr-2 h-4 w-4" />
                ) : (
                  <Shield className="mr-2 h-4 w-4" />
                )}
                {checkScrapeStatus?.data?.running
                  ? "Stop Scan"
                  : "Scan For New Threats"}
              </Button>
            </div>
          </div>

        {/* Filters section */}
        {isFilterOpen && (
          <div className="p-6 border border-slate-700/50 rounded-md bg-slate-900/50 mt-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-medium">Filter Options</h3>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-11 px-4 font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  Clear all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFilterOpen(false)}
                  className="h-11 w-11 p-0 text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Simple Keyword Filter */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                  Filter by Keywords
                </h4>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type keyword to filter (e.g., malware, vulnerability)..."
                    className="pl-9"
                    value={keywordSearchTerm}
                    onChange={(e) => {
                      setKeywordSearchTerm(e.target.value);
                      // Auto-filter based on search term
                      if (e.target.value.trim()) {
                        const matchingKeywords = keywords.data?.filter(
                          (k) =>
                            k.term
                              .toLowerCase()
                              .includes(e.target.value.toLowerCase()) &&
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
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                    Active Keyword Filters
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedKeywords.map((keyword) => (
                      <Badge
                        key={keyword.id}
                        variant="default"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        onClick={() => removeKeywordFromFilter(keyword.id)}
                      >
                        {keyword.term}
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
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="space-y-6">
          {articles.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6 py-4">
              {/* Standardized skeleton items */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-700/50 bg-gradient-to-b from-transparent to-black/10 backdrop-blur-sm overflow-hidden"
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
                <div key={article.id} className={cn(
                  "relative",
                  article.id === highlightedArticleId && "bg-primary/10 rounded-xl"
                )}>
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
                    onDelete={() => handleDeleteArticle(article.id)}
                    onKeywordClick={(keyword, category) => {
                      // Add the keyword to the filter
                      const keywordObj = keywords.data?.find(
                        (k) => k.term === keyword && k.category === category,
                      );
                      if (
                        keywordObj &&
                        !selectedKeywordIds.includes(keywordObj.id)
                      ) {
                        setSelectedKeywordIds((prev) => [...prev, keywordObj.id]);
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
                    Showing {startIndex + 1}-{Math.min(endIndex, totalArticles)} of {totalArticles} articles
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
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNumber)}
                            className="h-8 w-8 p-0 text-xs"
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
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

              {/* Clear All Button - Bottom of page */}
              {totalArticles > 0 && (
                <div className="flex justify-center pt-6 mt-6 border-t border-slate-700/30">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-9 px-4 font-semibold transition-all duration-200"
                        disabled={deleteAllArticles.isPending}
                      >
                        {deleteAllArticles.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete All Articles ({totalArticles})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action will permanently delete all {totalArticles} threat articles.
                          This cannot be undone.
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
                Start by adding sources and keywords to monitor for security
                threats, or adjust your search filters to discover potential vulnerabilities.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  asChild
                  className="h-10 px-6 font-semibold bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] transition-all duration-200"
                >
                  <Link to="/dashboard/threat/sources">Add Sources</Link>
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
