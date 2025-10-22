import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFetch } from "@/hooks/use-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CapsuleArticle } from "@shared/db/schema/news-capsule";
import type { Report } from "@shared/db/schema/reports";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronUp, ChevronDown, Menu, X, Link2, Play, FileText, Settings2, Trash2, Globe, Search, BarChart3, FolderOpen } from "lucide-react";

interface ArticleSummary {
  id: string;
  title: string;
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  microsoftConnection: string;
  sourcePublication: string;
  originalUrl: string;
  targetOS: string;
  createdAt: string;
  markedForReporting: boolean;
  markedForDeletion: boolean;
}


interface ReportWithArticles extends Report {
  articles: CapsuleArticle[];
}

// Store recent user-entered URLs (up to 5) - in memory only
const MAX_RECENT_URLS = 5;
const recentUrls: string[] = [];

// List of demo URLs to exclude from saved suggestions
const excludedUrls = [
  "https://thehackernews.com/2025/04/cisa-and-fbi-warn-fast-flux-is-powering.html",
  "https://www.csoonline.com/article/3954647/big-hole-in-big-data-critical-deserialization-bug-in-apache-parquet-allows-rce.html",
  "https://thehackernews.com/2025/04/malicious-python-packages-on-pypi.html",
  "https://cyberpress.org/weaponized-pdfs-malicious-email-attacks/",
  "https://cyberpress.org/apache-traffic-server-bug/#google_vignette",
  "https://gbhackers.com/fortinet-zero-day-poc/"
];

// Function to determine which app sent the article
const getSourceAppIndicator = (article: CapsuleArticle) => {
  const output: { 
    label: 'NC' | 'NR' | 'TT', 
    color: string, 
    textColor: string
  } = {
    label: "NC",
    color: "bg-purple-600",
    textColor: "text-purple-100"
  }

  return { label: 'NC', color: 'bg-purple-600', textColor: 'text-purple-100' };
};



export default function Research() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fetchWithAuth = useFetch();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Load selected articles from localStorage on component mount
  const [selectedArticles, setSelectedArticles] = useState<CapsuleArticle[]>(() => {
    const saved = localStorage.getItem('news-capsule-selected-articles');
    return saved ? JSON.parse(saved) : [];
  });
  const [savedUrls, setSavedUrls] = useState<string[]>([]);
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const [bulkMode, setBulkMode] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [articlesPerPage] = useState(6);
  const [reportTopic, setReportTopic] = useState("");
  
  // Filter and sort state
  const [sortMode, setSortMode] = useState<'newest' | 'a-z' | null>(null);
  const [selectionFilter, setSelectionFilter] = useState<'selected' | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'all'>('all');
  const [contentFilter, setContentFilter] = useState<'with-cve' | 'all'>('all');
  const [keywordSearch, setKeywordSearch] = useState("");
  const [activeKeywords, setActiveKeywords] = useState("");
  
  // Phase 2: Enhanced state management for responsive behavior
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isViewportMobile, setIsViewportMobile] = useState(false);
  const [showSelectedArticlesOverlay, setShowSelectedArticlesOverlay] = useState(false);
  
  
  // Dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  
  // State for add to existing report dialog
  const [showAddToExistingDialog, setShowAddToExistingDialog] = useState(false);
  const [todaysReports, setTodaysReports] = useState<ReportWithArticles[]>([]);
  
  // State for delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<CapsuleArticle | null>(null);
  
  // State for clear all articles dialog
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  // Sync selectedArticles with localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('news-capsule-selected-articles', JSON.stringify(selectedArticles));
  }, [selectedArticles]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortMode, selectionFilter, timeFilter, contentFilter, activeKeywords]);

  // Phase 2: Responsive viewport detection
  useEffect(() => {
    const checkViewport = () => {
      const isMobile = window.innerWidth < 1024;
      setIsViewportMobile(isMobile);
      if (isMobile) {
        setIsSidebarCollapsed(false); // Always expanded on mobile
      }
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Fetch articles from database
  const { data: processedArticles = [], isLoading: articlesLoading, refetch: refetchArticles } = useQuery<CapsuleArticle[]>({
    queryKey: ["/api/news-capsule/articles"],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/news-capsule/articles', {
        method: "GET",
      });
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    },
  });

  // Fetch reports to check if any exist for today
  const { data: allReports = [] } = useQuery<ReportWithArticles[]>({
    queryKey: ["/api/news-capsule/reports"],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/news-capsule/reports', {
        method: "GET",
      });
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
  });

  // Apply filters and sorting to articles
  const filteredAndSortedArticles = React.useMemo(() => {
    let result = [...processedArticles];

    // Apply keyword search filter
    if (activeKeywords.trim()) {
      const keywords = activeKeywords.toLowerCase().split(/\s+/).filter(k => k.length > 0);
      result = result.filter(article => {
        const searchableText = [
          article.title,
          article.threatName,
          article.vulnerabilityId,
          article.summary,
          article.impacts,
          article.attackVector,
          article.sourcePublication,
          article.targetOS
        ].join(' ').toLowerCase();
        
        return keywords.some(keyword => searchableText.includes(keyword));
      });
    }

    // Apply selection filter
    if (selectionFilter === 'selected') {
      const selectedIds = new Set(selectedArticles.map(a => a.id));
      result = result.filter(article => selectedIds.has(article.id));
    }

    // Apply time filter
    if (timeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result = result.filter(article => {
        const articleDate = new Date(article.createdAt);
        articleDate.setHours(0, 0, 0, 0);
        return articleDate.getTime() === today.getTime();
      });
    } else if (timeFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      result = result.filter(article => new Date(article.createdAt) >= weekAgo);
    }

    // Apply content filter
    if (contentFilter === 'with-cve') {
      result = result.filter(article => 
        article.vulnerabilityId && 
        article.vulnerabilityId.trim() !== '' && 
        article.vulnerabilityId.toLowerCase() !== 'n/a'
      );
    }

    // Apply sorting
    if (sortMode === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortMode === 'a-z') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [processedArticles, selectionFilter, timeFilter, contentFilter, sortMode, selectedArticles, activeKeywords]);

  // Create report mutation
  const createReportMutation = useMutation({
    mutationFn: async ({ articleIds, topic }: { articleIds: string[]; topic?: string }) => {
      const response = await fetchWithAuth('/api/news-capsule/add-to-report', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          articleIds,
          topic,
          useExistingReport: false,
        }),
      });
      if (!response.ok) throw new Error('Failed to create report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-capsule/reports"] });
      setSelectedArticles([]);
      localStorage.removeItem('news-capsule-selected-articles'); // Clear localStorage
      setReportTopic(""); // Clear topic field
      setSuccessMessage("Articles successfully added to report!");
      setShowSuccessDialog(true);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create report",
      });
    },
  });

  // Add to existing report mutation
  const addToExistingReportMutation = useMutation({
    mutationFn: async ({ articleIds, reportId, topic }: { articleIds: string[]; reportId: string; topic?: string }) => {
      const response = await fetchWithAuth('/api/news-capsule/add-to-report', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          articleIds,
          topic,
          useExistingReport: true,
          existingReportId: reportId,
        }),
      });
      if (!response.ok) throw new Error('Failed to add articles to existing report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-capsule/reports"] });
      setSelectedArticles([]);
      localStorage.removeItem('news-capsule-selected-articles'); // Clear localStorage
      setReportTopic(""); // Clear topic field
      setSuccessMessage("Articles successfully added to existing report!");
      setShowSuccessDialog(true);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add articles to existing report",
      });
    },
  });
  

  
  // Helper function to check if reports exist for today
  const getTodaysReports = () => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    return allReports.filter(report => {
      const reportDate = new Date(report.createdAt);
      return reportDate >= todayStart && reportDate < todayEnd;
    });
  };

  const clearUrl = () => {
    setUrl("");
  };
  
  // Save URL to recent URLs list
  const saveUrl = (urlToSave: string) => {
    // Don't save empty URLs or excluded demo URLs
    if (!urlToSave || excludedUrls.includes(urlToSave)) return;
    
    // Create new array without the URL (if it already exists)
    const filteredUrls = savedUrls.filter(u => u !== urlToSave);
    
    // Add the URL to the beginning of the array
    const newSavedUrls = [urlToSave, ...filteredUrls].slice(0, MAX_RECENT_URLS);
    
    // Update state only
    setSavedUrls(newSavedUrls);
    
    // Update module level array
    recentUrls.length = 0;
    recentUrls.push(...newSavedUrls);
  };
  
  // Handle selection from dropdown
  const selectSavedUrl = (selectedUrl: string) => {
    setUrl(selectedUrl);
    setShowUrlDropdown(false);
  };
  
  const processUrl = async () => {
    if (!url) {
      toast({
        variant: "destructive",
        title: "Error",
        description: bulkMode ? "Please enter URLs (one per line)" : "Please enter a URL",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Split the input based on mode - by lines for bulk mode, by commas for single mode
      const urls = bulkMode 
        ? url.split('\n').map(u => u.trim()).filter(u => u.length > 0)
        : url.split(',').map(u => u.trim()).filter(u => u.length > 0);
      
      if (urls.length === 0) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please enter valid URLs",
        });
        setIsLoading(false);
        return;
      }
      
      // Save each URL to our recent URLs list
      urls.forEach(singleUrl => {
        saveUrl(singleUrl);
      });
      
      // Create detailed tracking for bulk processing
      let successCount = 0;
      let errorCount = 0;
      const successfulUrls: string[] = [];
      const failedUrls: string[] = [];
      const newArticles: ArticleSummary[] = [];
      
      // Process each URL sequentially with immediate feedback
      for (let i = 0; i < urls.length; i++) {
        const singleUrl = urls[i];
        
        // Update loading state with current progress (could show progress toast here if needed)
        
        try {
          const response = await fetchWithAuth('/api/news-capsule/process-url', {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: singleUrl }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error(`Failed to process URL ${singleUrl}:`, errorData);
            errorCount++;
            failedUrls.push(singleUrl);
            continue; // Try the next URL
          }
          
          const data = await response.json();
          
          // Make sure we only store real articles by checking for required fields
          if (data && data.id && data.title) {
            successCount++;
            successfulUrls.push(singleUrl);
            newArticles.push(data);
            console.log(`Successfully processed: ${data.title}`);
          } else {
            console.error(`Invalid article data received for URL ${singleUrl}:`, data);
            errorCount++;
            failedUrls.push(singleUrl);
          }
        } catch (err) {
          console.error(`Error processing URL ${singleUrl}:`, err);
          errorCount++;
          failedUrls.push(singleUrl);
        }
      }
      
      // Refetch articles after processing
      if (newArticles.length > 0) {
        refetchArticles();
      }
      
      // Show detailed success or error toast
      if (errorCount > 0) {
        if (successCount > 0) {
          toast({
            variant: "destructive",
            title: "Partial Success",
            description: `Successfully processed ${successCount} of ${urls.length} articles. ${errorCount} failed to process.`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Processing Failed",
            description: `Failed to process all ${urls.length} articles. Check console for details.`,
          });
        }
      } else if (successCount > 0) {
        toast({
          title: "Success",
          description: `All ${successCount} articles processed successfully!`,
        });
      }
      
      // Clear the input field
      setUrl("");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectForReport = (article: CapsuleArticle) => {
    // Use functional update to avoid race conditions when clicking multiple articles quickly
    setSelectedArticles(prev => {
      // Check if article with same id already exists
      const alreadySelected = prev.some(selected => selected.id === article.id);
      
      if (alreadySelected) {
        console.log("Article already selected:", article.title);
        return prev; // Return unchanged if duplicate
      }
      
      // Add article to selection
      return [...prev, article];
    });
  };
  
  const sendToExecutiveReport = () => {
    if (selectedArticles.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No articles selected for the report",
      });
      return;
    }
    
    const articleIds = selectedArticles.map(article => article.id);
    const topic = reportTopic.trim() || undefined;
    
    // Check if reports exist for today
    const reportsForToday = getTodaysReports();
    
    if (reportsForToday.length > 0) {
      // Reports exist for today, show dialog
      setTodaysReports(reportsForToday);
      setShowAddToExistingDialog(true);
    } else {
      // No reports for today, create new report
      createReportMutation.mutate({ articleIds, topic });
    }
  };
  
  const removeSelectedArticle = (id: string) => {
    // Use functional update to ensure we have the latest state
    setSelectedArticles(prev => prev.filter(article => article.id !== id));
  };
  
  // Delete article mutation
  const deleteArticleMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetchWithAuth(`/api/news-capsule/articles/${articleId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete article');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-capsule/articles"] });
    },
    onError: (error, articleId) => {
      // Revert optimistic update on error
      queryClient.setQueryData(["/api/news-capsule/articles"], (oldData: CapsuleArticle[] | undefined) => {
        if (!oldData || !articleToDelete) return oldData;
        // Add the article back to the list
        return [...oldData, articleToDelete];
      });
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete article",
      });
    },
  });

  const removeProcessedArticle = (article: CapsuleArticle) => {
    setArticleToDelete(article);
    setShowDeleteDialog(true);
  };

  const confirmDeleteArticle = async () => {
    if (!articleToDelete) return;
    
    // Perform optimistic update - remove article from list immediately
    queryClient.setQueryData(["/api/news-capsule/articles"], (oldData: CapsuleArticle[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.filter(article => article.id !== articleToDelete.id);
    });
    
    // Also remove from selected if present
    if (selectedArticles.some(article => article.id === articleToDelete.id)) {
      removeSelectedArticle(articleToDelete.id);
    }
    
    try {
      await deleteArticleMutation.mutateAsync(articleToDelete.id);
      // Close dialog on success
      setShowDeleteDialog(false);
      setArticleToDelete(null);
    } catch (error) {
      // Close dialog on error (error is already handled in mutation)
      setShowDeleteDialog(false);
      setArticleToDelete(null);
    }
  };

  // Clear all articles mutation
  const clearAllArticlesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth('/api/news-capsule/articles/clear-all', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to clear all articles');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-capsule/articles"] });
      setSelectedArticles([]);
      localStorage.removeItem('news-capsule-selected-articles');
      toast({
        title: "Success",
        description: "Articles from prior to today have been cleared",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear all articles",
      });
    },
  });

  // Calculate articles from prior to today
  const getArticlesPriorToToday = () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    return processedArticles.filter(article => {
      const articleDate = new Date(article.createdAt);
      return articleDate < startOfToday;
    });
  };

  const articlesPriorToToday = getArticlesPriorToToday();
  const priorArticlesCount = articlesPriorToToday.length;

  const handleClearAllArticles = () => {
    setShowClearAllDialog(true);
  };

  const confirmClearAllArticles = async () => {
    try {
      await clearAllArticlesMutation.mutateAsync();
      setShowClearAllDialog(false);
    } catch (error) {
      setShowClearAllDialog(false);
    }
  };

  // Helper functions for new filter buttons
  const handleSelectAllVisible = () => {
    const startIdx = (currentPage - 1) * articlesPerPage;
    const endIdx = currentPage * articlesPerPage;
    const visibleArticles = filteredAndSortedArticles.slice(startIdx, endIdx);
    
    visibleArticles.forEach(article => {
      if (!selectedArticles.some(selected => selected.id === article.id)) {
        selectForReport(article);
      }
    });
  };

  const handleClearSelection = () => {
    setSelectedArticles([]);
    localStorage.removeItem('news-capsule-selected-articles');
  };

  const handleBulkDelete = async () => {
    if (selectedArticles.length === 0) {
      toast({
        variant: "destructive",
        title: "No Selection",
        description: "Please select articles to delete",
      });
      return;
    }

    // Confirmation before deleting
    if (!confirm(`Are you sure you want to delete ${selectedArticles.length} selected article(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      // Optimistically remove articles from UI
      const articlesToDelete = [...selectedArticles];
      queryClient.setQueryData(["/api/news-capsule/articles"], (oldData: CapsuleArticle[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(article => !articlesToDelete.some(selected => selected.id === article.id));
      });

      // Clear selection
      setSelectedArticles([]);
      localStorage.removeItem('news-capsule-selected-articles');

      // Delete each article
      let successCount = 0;
      let errorCount = 0;

      for (const article of articlesToDelete) {
        try {
          await deleteArticleMutation.mutateAsync(article.id);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to delete article: ${article.title}`, error);
        }
      }

      if (errorCount === 0) {
        toast({
          title: "Success",
          description: `Deleted ${successCount} article(s) successfully`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Partial Success",
          description: `Deleted ${successCount} article(s), ${errorCount} failed`,
        });
      }

      // Refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/news-capsule/articles"] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete articles",
      });
    }
  };

  const handleCopyUrls = () => {
    if (selectedArticles.length === 0) {
      toast({
        variant: "destructive",
        title: "No Selection",
        description: "Please select articles first",
      });
      return;
    }

    const urls = selectedArticles.map(article => article.originalUrl).join('\n');
    navigator.clipboard.writeText(urls).then(() => {
      toast({
        title: "URLs Copied",
        description: `${selectedArticles.length} article URLs copied to clipboard`,
      });
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy URLs to clipboard",
      });
    });
  };

  const handleSearchKeywords = () => {
    const trimmedKeywords = keywordSearch.trim();
    if (!trimmedKeywords) {
      toast({
        variant: "destructive",
        title: "No Keywords",
        description: "Please enter keywords to search",
      });
      return;
    }
    
    setActiveKeywords(trimmedKeywords);
    toast({
      title: "Search Applied",
      description: `Filtering articles by: ${trimmedKeywords}`,
    });
  };
  
  return (
    <>
      {/* Unified Toolbar Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md mb-px transition-all duration-300">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <FileText className="h-6 w-6 text-purple-400" />
            <span className="text-xl font-semibold text-white">Article Tools and Processing</span>
          </div>

          {/* 3-Column Compact Layout */}
          <div className="grid gap-4 lg:grid-cols-3">
            
            {/* Column 1: URL Processing */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">URL Processing</span>
              </div>
              
              <div className="space-y-2">
                {/* Process URLs Button - Row 1 */}
                <button
                  onClick={processUrl}
                  disabled={isLoading}
                  className="w-full h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading ? "Processing..." : "Process URLs"}
                </button>

                {/* URL Input - Height matches 2 button rows in Column 3 */}
                <div className="relative">
                  <textarea
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onFocus={() => setShowUrlDropdown(true)}
                    onBlur={() => setTimeout(() => setShowUrlDropdown(false), 200)}
                    placeholder="Enter single URL or multiple URLs&#10;https://example.com/article1&#10;https://example.com/article2"
                    className="w-full h-[72px] px-3 py-2 text-xs bg-slate-800/50 border border-slate-600/50 rounded-md resize-none focus:outline-none focus:border-purple-500/50 text-slate-200"
                  />
                  
                  {/* URL Dropdown */}
                  {showUrlDropdown && savedUrls.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-md overflow-hidden z-20 max-h-32 overflow-y-auto shadow-xl">
                      {savedUrls.map((savedUrl, index) => (
                        <button
                          key={index}
                          onClick={() => selectSavedUrl(savedUrl)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-700 truncate border-b border-slate-700/50 last:border-b-0"
                        >
                          {savedUrl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Clear Button */}
                {url && (
                  <button
                    onClick={() => setUrl("")}
                    className="w-full h-8 px-3 text-xs font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded border border-slate-600/50 transition-colors flex items-center justify-center"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Column 2: Keyword Filter */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Keyword Filter</span>
              </div>
              
              <div className="space-y-2">
                {/* Search Keywords Button - Row 1 */}
                <button
                  onClick={handleSearchKeywords}
                  disabled={!keywordSearch.trim()}
                  className="w-full h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  Search Keywords
                </button>

                {/* Keyword Input - Height matches 2 button rows in Column 3 */}
                <textarea
                  value={keywordSearch}
                  onChange={(e) => setKeywordSearch(e.target.value)}
                  placeholder="Enter keywords to search (e.g., ransomware, CVE-2024, Windows)&#10;Separate multiple keywords with spaces"
                  className="w-full h-[72px] px-3 py-2 text-xs bg-slate-800/50 border border-slate-600/50 rounded-md resize-none focus:outline-none focus:border-purple-500/50 text-slate-200"
                />

                {/* Clear Button */}
                {keywordSearch && (
                  <button
                    onClick={() => {
                      setKeywordSearch("");
                      setActiveKeywords("");
                    }}
                    className="w-full h-8 px-3 text-xs font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded border border-slate-600/50 transition-colors flex items-center justify-center"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Column 3: Article Selection Tools */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Article Selection Tools</span>
              </div>
              
              {/* 2x3 Grid Layout */}
              <div className="grid grid-cols-2 gap-2">
                {/* Row 1, Col 1: Select All Visible Button */}
                <button
                  onClick={handleSelectAllVisible}
                  disabled={filteredAndSortedArticles.length === 0}
                  className="h-8 px-2 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  Select All Visible
                </button>

                {/* Row 1, Col 2: Clear Selection Button */}
                <button
                  onClick={handleClearSelection}
                  disabled={selectedArticles.length === 0}
                  className="h-8 px-2 text-xs font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded border border-slate-600/50 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  Clear Selection
                </button>

                {/* Row 2, Col 1: Selection Counter Badge */}
                <div className="h-8 px-2 flex items-center justify-center bg-slate-800/50 border border-slate-600/50 rounded-md">
                  <span className="text-xs font-medium text-purple-300">
                    ({selectedArticles.length}) {selectedArticles.length === 1 ? 'article' : 'articles'} selected
                  </span>
                </div>

                {/* Row 2, Col 2: Create Report Button */}
                <button
                  onClick={sendToExecutiveReport}
                  disabled={selectedArticles.length === 0}
                  className="h-8 px-2 text-xs font-medium bg-[#00FFFF]/20 hover:bg-[#00FFFF]/30 text-[#00FFFF] hover:text-white rounded border border-[#00FFFF]/40 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  Create Report
                </button>

                {/* Row 3, Col 1: Copy URLs Button */}
                <button
                  onClick={handleCopyUrls}
                  disabled={selectedArticles.length === 0}
                  className="h-8 px-2 text-xs font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded border border-slate-600/50 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  Copy Article URLs
                </button>

                {/* Row 3, Col 2: Bulk Delete Button */}
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedArticles.length === 0}
                  className="h-8 px-2 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white rounded border border-red-500/50 hover:border-gray-400 transition-colors disabled:opacity-50 flex items-center justify-center focus:outline-none focus-visible:ring-0"
                >
                  Bulk Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Button - positioned next to back-to-top button */}
      {isViewportMobile && (
        <button
          onClick={() => setShowSelectedArticlesOverlay(true)}
          className="fixed bottom-4 right-[170px] sm:bottom-6 sm:right-[170px] z-[55] w-14 h-14 bg-[#00FFFF]/80 backdrop-blur-sm border border-[#00FFFF]/50 hover:bg-[#BF00FF] text-black hover:text-white rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
        >
          <Menu className="w-6 h-6" />
          {selectedArticles.length > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-[#BF00FF] text-white text-xs font-bold rounded-full flex items-center justify-center">
              {selectedArticles.length}
            </span>
          )}
        </button>
      )}
      
      <div className="flex flex-col gap-4 lg:gap-6 min-h-screen overflow-x-hidden">
      
        {/* Articles Container */}
        <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Processed Articles</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">
                {filteredAndSortedArticles?.length || 0} articles
              </span>
              <button
                onClick={handleClearAllArticles}
                disabled={priorArticlesCount === 0 || clearAllArticlesMutation.isPending}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white rounded-md border border-red-500/40 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear Past ({priorArticlesCount}) Articles
              </button>
              <button
                onClick={sendToExecutiveReport}
                disabled={selectedArticles.length === 0 || createReportMutation.isPending || addToExistingReportMutation.isPending}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded-md border border-purple-500/40 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Create Report ({selectedArticles.length})
              </button>
            </div>
          </div>
          {articlesLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-slate-600 border-t-purple-500 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400">Loading articles...</p>
            </div>
          ) : filteredAndSortedArticles.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No articles match your filters. Try adjusting the filters above.</p>
            </div>
          ) : (
            <>
              {/* Top Pagination Controls */}
              {filteredAndSortedArticles.length > articlesPerPage && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mb-6 p-4 bg-slate-800/30 border border-slate-700/40 rounded-md">
                  <div className="flex items-center gap-3 order-2 sm:order-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                    >
                      Previous
                    </button>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredAndSortedArticles.length / articlesPerPage)))}
                      disabled={currentPage === Math.ceil(filteredAndSortedArticles.length / articlesPerPage)}
                      className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                    >
                      Next
                    </button>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 order-1 sm:order-2">
                    <span className="text-sm text-slate-400">
                      Page {currentPage} of {Math.ceil(filteredAndSortedArticles.length / articlesPerPage)}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.ceil(filteredAndSortedArticles.length / articlesPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          const totalPages = Math.ceil(filteredAndSortedArticles.length / articlesPerPage);
                          const isMobile = window.innerWidth < 640;
                          const range = isMobile ? 1 : 2;
                          return page === 1 || page === totalPages || Math.abs(page - currentPage) <= range;
                        })
                        .map((page, index, visiblePages) => {
                          const prevPage = visiblePages[index - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;
                          
                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && <span className="text-slate-400 px-1 text-xs">...</span>}
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`px-2 py-1 rounded-md min-w-[28px] text-xs transition-colors ${
                                  currentPage === page
                                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                                    : 'bg-slate-700 text-white hover:bg-slate-600'
                                }`}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(() => {
                  const startIdx = (currentPage - 1) * articlesPerPage;
                  const endIdx = currentPage * articlesPerPage;
                  const articlesToShow = filteredAndSortedArticles.slice(startIdx, endIdx);
                  
                  return articlesToShow.map((article, index) => (
                    <motion.div
                      key={`article-${article.id}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 bg-slate-800/50 border border-slate-700/40 rounded-md hover:border-slate-600/60 transition-colors"
                    >
                      <div className="flex flex-col gap-4">
                        {/* Action buttons at top */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              // Use functional update to check and toggle selection atomically
                              setSelectedArticles(prev => {
                                const isSelected = prev.some(selected => selected.id === article.id);
                                if (isSelected) {
                                  // Remove from selection
                                  return prev.filter(selected => selected.id !== article.id);
                                } else {
                                  // Check if already selected to prevent duplicates
                                  if (prev.some(selected => selected.id === article.id)) {
                                    return prev;
                                  }
                                  // Add to selection
                                  return [...prev, article];
                                }
                              });
                            }}
                            className={`px-3 py-1.5 text-xs rounded-md border transition-all duration-200 ${
                              selectedArticles.some(selected => selected.id === article.id) 
                                ? "bg-cyan-500/20 hover:bg-purple-500/30 text-cyan-300 border-cyan-500/50 hover:border-purple-500/50 hover:text-[#00FFFF]" 
                                : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/50 hover:border-purple-400/60 hover:text-[#00FFFF]"
                            }`}
                          >
                            {selectedArticles.some(selected => selected.id === article.id) ? "Selected for Report" : "Select for Report"}
                          </button>
                          <button
                            onClick={() => removeProcessedArticle(article)}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white rounded-md border border-red-500/50 hover:border-gray-400 transition-all duration-200 text-xs flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Article
                          </button>
                        </div>
                        
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium leading-tight text-slate-100 mb-1">{article.title}</h3>
                            <p className="text-xs text-purple-400">
                              Article processed {new Date(article.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric',
                              })}, {new Date(article.createdAt).toLocaleTimeString('en-US', { 
                                hour: '2-digit',
                                minute: '2-digit'
                              }).replace(/\s/g, '')}
                            </p>
                            <a 
                              href={article.originalUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-[#00FFFF] hover:text-cyan-300 mt-1 inline-block transition-colors"
                            >
                              {(() => {
                                try {
                                  const url = new URL(article.originalUrl);
                                  return url.hostname.replace(/^www\./, '');
                                } catch {
                                  return article.originalUrl;
                                }
                              })()}
                            </a>
                          </div>
                        </div>
                        
                        {/* Article details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Threat Name</p>
                            <p className="text-sm text-slate-200 break-words">{article.threatName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Vulnerability ID</p>
                            <p className="text-sm text-slate-200 break-words">{article.vulnerabilityId}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-xs text-slate-400 mb-1">Summary</p>
                            <p className="text-sm text-slate-200 leading-relaxed">{article.summary}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-xs text-slate-400 mb-1">Impacts</p>
                            <p className="text-sm text-slate-200 leading-relaxed">{article.impacts}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Attack Vector</p>
                            <p className="text-sm text-slate-200 break-words">{article.attackVector}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Target OS</p>
                            <p className="text-sm text-slate-200 break-words">{article.targetOS}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Source</p>
                            <p className="text-sm text-slate-200 break-words">{article.sourcePublication}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ));
                })()}
              </div>
            </>
          )}
        </div>
        
        {/* Selected Articles Section - Full Width */}
        <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-6 w-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Selected Articles</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={sendToExecutiveReport}
                disabled={selectedArticles.length === 0 || createReportMutation.isPending || addToExistingReportMutation.isPending}
                className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded-md border border-purple-500/40 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {(createReportMutation.isPending || addToExistingReportMutation.isPending) ? "Processing..." : "Send to Report"}
              </button>
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-md text-sm text-purple-400 font-medium">
                {selectedArticles.length}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {selectedArticles.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No articles selected yet</p>
                <p className="text-xs mt-1">Select articles from the list above</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {selectedArticles.map((article, index) => (
                  <motion.div
                    key={`selected-${article.id}-${index}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 bg-slate-800/50 border border-slate-700/40 rounded-md hover:border-slate-600/60 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h4 className="text-xs font-medium flex-1 leading-tight text-slate-100 line-clamp-2">{article.title}</h4>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => removeSelectedArticle(article.id)}
                          className="w-5 h-5 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-sm transition-colors flex-shrink-0"
                        >
                          ×
                        </button>
                        <span className="text-xs text-slate-400 px-1.5 py-0.5 border border-slate-600 rounded text-center text-xs">
                          NC
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-1.5 break-words line-clamp-1">
                      {article.threatName}
                    </p>
                    <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Pagination Controls - Mobile Responsive */}
      {processedArticles.length > articlesPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-4 lg:mt-6 p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md">
          {/* Mobile: Stack vertically, Desktop: Horizontal layout */}
          <div className="flex items-center gap-3 order-2 sm:order-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-3 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Previous
            </button>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(processedArticles.length / articlesPerPage)))}
              disabled={currentPage === Math.ceil(processedArticles.length / articlesPerPage)}
              className="px-4 py-3 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Next
            </button>
          </div>
          
          {/* Page indicator - Show on top for mobile */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 order-1 sm:order-2">
            <span className="text-xs sm:text-sm text-slate-400 text-center">
              Page {currentPage} of {Math.ceil(processedArticles.length / articlesPerPage)}
            </span>
            
            {/* Page number buttons - Hide some on mobile */}
            <div className="flex items-center gap-1 sm:gap-2">
              {Array.from({ length: Math.ceil(processedArticles.length / articlesPerPage) }, (_, i) => i + 1)
                .filter(page => {
                  const totalPages = Math.ceil(processedArticles.length / articlesPerPage);
                  // On mobile, show fewer page numbers
                  const isMobile = window.innerWidth < 640;
                  const range = isMobile ? 1 : 2;
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= range;
                })
                .map((page, index, visiblePages) => {
                  const prevPage = visiblePages[index - 1];
                  const showEllipsis = prevPage && page - prevPage > 1;
                  
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && <span className="text-slate-400 px-1 sm:px-2 text-xs sm:text-sm">...</span>}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-2 sm:px-3 py-2 sm:py-3 rounded-md min-w-[36px] sm:min-w-[44px] text-xs sm:text-sm touch-manipulation ${
                          currentPage === page
                            ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                            : 'bg-slate-700 text-white hover:bg-slate-600'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Selected Articles Overlay */}
      <AnimatePresence>
        {showSelectedArticlesOverlay && isViewportMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30"
            onClick={() => setShowSelectedArticlesOverlay(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 500 }}
              className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700/50 rounded-t-2xl max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Selected Articles ({selectedArticles.length})</h3>
                <button
                  onClick={() => setShowSelectedArticlesOverlay(false)}
                  className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-md touch-manipulation transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                {/* Mobile Action Buttons */}
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => {
                      sendToExecutiveReport();
                      setShowSelectedArticlesOverlay(false);
                    }}
                    disabled={selectedArticles.length === 0 || createReportMutation.isPending || addToExistingReportMutation.isPending}
                    className="flex-1 px-4 py-3 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white rounded-md disabled:opacity-50 min-h-[48px] touch-manipulation"
                  >
                    {(createReportMutation.isPending || addToExistingReportMutation.isPending) ? "Processing..." : "Send to Report"}
                  </button>
                  
                  <button
                    onClick={() => {
                      const articleIds = selectedArticles.map(article => article.id);
                      const topic = reportTopic.trim() || undefined;
                      createReportMutation.mutate({ articleIds, topic });
                      setShowSelectedArticlesOverlay(false);
                    }}
                    disabled={createReportMutation.isPending || addToExistingReportMutation.isPending}
                    className="flex-1 px-4 py-3 bg-slate-700 text-white hover:bg-slate-600 hover:text-[#00FFFF] rounded-md disabled:opacity-50 min-h-[48px] touch-manipulation"
                  >
                    New Report
                  </button>
                </div>

                {/* Report Topic Field */}
                <div className="mb-4">
                  <label className="block text-sm text-slate-300 mb-2">
                    Report Topic (Optional)
                  </label>
                  <input
                    type="text"
                    value={reportTopic}
                    onChange={(e) => setReportTopic(e.target.value)}
                    placeholder="Enter a topic (Optional)"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#BF00FF]/50 min-h-[48px]"
                  />
                </div>

                {/* Selected Articles List */}
                {selectedArticles.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-8">
                    No articles selected yet
                  </p>
                ) : (
                  selectedArticles.map((article, index) => (
                    <div 
                      key={`mobile-selected-${article.id}-${index}`}
                      className="p-4 bg-slate-800/50 border border-slate-700/40 rounded-md"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <h4 className="text-base font-medium mb-2 flex-1 leading-tight">{article.title}</h4>
                        <button
                          onClick={() => removeSelectedArticle(article.id)}
                          className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md touch-manipulation"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">
                        {article.threatName}
                      </p>
                      <p className="text-sm line-clamp-2 leading-relaxed">
                        {article.summary}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Success</DialogTitle>
            <DialogDescription>
              {successMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Create New Version
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              confirmAction();
              setShowConfirmDialog(false);
            }}>
              Add to Existing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Existing Report Dialog */}
      <AlertDialog open={showAddToExistingDialog} onOpenChange={setShowAddToExistingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add to Existing Report?</AlertDialogTitle>
            <AlertDialogDescription>
              There are already reports for today. Would you like to add these articles to an existing report?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowAddToExistingDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddToExistingDialog(false);
                const articleIds = selectedArticles.map(article => article.id);
                const topic = reportTopic.trim() || undefined;
                createReportMutation.mutate({ articleIds, topic });
              }}
            >
              No, create new
            </Button>
            <AlertDialogAction 
              onClick={() => {
                setShowAddToExistingDialog(false);
                const articleIds = selectedArticles.map(article => article.id);
                const topic = reportTopic.trim() || undefined;
                // Add to the first (most recent) report for today
                const mostRecentReport = todaysReports[0];
                if (mostRecentReport) {
                  addToExistingReportMutation.mutate({ articleIds, reportId: mostRecentReport.id, topic });
                }
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Article Confirmation Dialog */}
      <AlertDialog 
        open={showDeleteDialog} 
        onOpenChange={(open) => {
          // Prevent closing dialog while deletion is in progress
          if (!open && deleteArticleMutation.isPending) {
            return;
          }
          setShowDeleteDialog(open);
          if (!open) {
            setArticleToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this article? This action cannot be undone.
              {articleToDelete && (
                <div className="mt-2 p-2 bg-slate-800 rounded text-sm">
                  <strong>{articleToDelete.title}</strong>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowDeleteDialog(false);
                setArticleToDelete(null);
              }}
              disabled={deleteArticleMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <Button 
              onClick={confirmDeleteArticle}
              disabled={deleteArticleMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteArticleMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Deleting...
                </div>
              ) : (
                "Yes"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Articles Confirmation Dialog */}
      <AlertDialog 
        open={showClearAllDialog} 
        onOpenChange={(open) => {
          if (!open && clearAllArticlesMutation.isPending) {
            return;
          }
          setShowClearAllDialog(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Articles</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {priorArticlesCount} article{priorArticlesCount !== 1 ? 's' : ''} from prior to today? This action cannot be undone. Articles sent today will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setShowClearAllDialog(false)}
              disabled={clearAllArticlesMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <Button 
              onClick={confirmClearAllArticles}
              disabled={clearAllArticlesMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {clearAllArticlesMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Clearing...
                </div>
              ) : (
                "Yes, Clear All"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
