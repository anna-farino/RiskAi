import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
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
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<CapsuleArticle[]>([]);
  const [savedUrls, setSavedUrls] = useState<string[]>([]);
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const [bulkMode, setBulkMode] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [articlesPerPage] = useState(10);
  const [reportTopic, setReportTopic] = useState("");
  
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

  // Fetch articles from database
  const { data: processedArticles = [], isLoading: articlesLoading, refetch: refetchArticles } = useQuery<CapsuleArticle[]>({
    queryKey: ["/api/news-capsule/articles"],
    queryFn: async () => {
      const response = await fetch(`${serverUrl}/api/news-capsule/articles`, {
        method: "GET",
        credentials: "include",
        headers: {
          ...csfrHeaderObject(),
        },
      });
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    },
  });

  // Fetch reports to check if any exist for today
  const { data: allReports = [] } = useQuery<ReportWithArticles[]>({
    queryKey: ["/api/news-capsule/reports"],
    queryFn: async () => {
      const response = await fetch(`${serverUrl}/api/news-capsule/reports`, {
        method: "GET",
        credentials: "include",
        headers: {
          ...csfrHeaderObject(),
        },
      });
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
  });

  // Create report mutation
  const createReportMutation = useMutation({
    mutationFn: async ({ articleIds, topic }: { articleIds: string[]; topic?: string }) => {
      const response = await fetch(`${serverUrl}/api/news-capsule/add-to-report`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject(),
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
      const response = await fetch(`${serverUrl}/api/news-capsule/add-to-report`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject(),
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
          const response = await fetch(serverUrl + "/api/news-capsule/process-url", {
            method: "POST",
            credentials: 'include',
            headers: {
              "Content-Type": "application/json",
              ...csfrHeaderObject(),
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
    // Check if article with same title already exists
    const alreadySelected = selectedArticles.some(selected => selected.title === article.title);
    
    if (alreadySelected) {
      console.log("Article already selected:", article.title);
      return; // Don't add duplicate
    }
    
    const newSelectedArticles = [...selectedArticles, article];
    setSelectedArticles(newSelectedArticles);
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
    const newSelectedArticles = selectedArticles.filter(article => article.id !== id);
    setSelectedArticles(newSelectedArticles);
  };
  
  // Delete article mutation
  const deleteArticleMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetch(`${serverUrl}/api/news-capsule/articles/${articleId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject(),
        },
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
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Capsule Research</h1>
        <p className="text-slate-300">
          Analyze articles for executive reporting by submitting URLs for processing.
        </p>
      </div>
      
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* URL Input Section - Left Side, Independent Scroll */}
        <div className="flex-1 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="h-full overflow-y-auto p-5">
            <h2 className="text-xl font-semibold mb-4">Add One or Multiple URLs</h2>
            
            <div className="flex flex-col gap-4">


            <div className="flex flex-col gap-2">
              <label htmlFor="url-input" className="text-sm text-slate-400">
                {bulkMode ? 'Enter URL\'s Below' : 'Article URL'}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  {bulkMode ? (
                    <textarea
                      id="url-input"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/article1&#10;https://example.com/article2&#10;https://example.com/article3"
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md resize-vertical"
                    />
                  ) : (
                    <input
                      id="url-input"
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onFocus={() => setShowUrlDropdown(true)}
                      onBlur={() => setTimeout(() => setShowUrlDropdown(false), 200)}
                      placeholder="https://example.com/article"
                      autoComplete="off"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md"
                    />
                  )}
                  
                  {/* Dropdown for saved URLs */}
                  {showUrlDropdown && savedUrls.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md overflow-hidden z-10 max-h-60 overflow-y-auto">
                      {savedUrls.map((savedUrl, index) => (
                        <button
                          key={index}
                          onClick={() => selectSavedUrl(savedUrl)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 truncate"
                        >
                          {savedUrl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {url && (
                  <button
                    type="button"
                    onClick={clearUrl}
                    className="px-3 max-h-10 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md"
                    aria-label="Clear input"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={processUrl}
                  disabled={isLoading}
                  className="px-4 max-h-10 py-2 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-md disabled:opacity-50"
                >
                  {isLoading ? "Processing..." : "Process"}
                </button>
              </div>
            </div>
          </div>
          
          {/* Processed Articles Display */}
          <div className="mt-6 flex flex-col gap-4">
            {articlesLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 text-sm">Loading articles...</p>
              </div>
            ) : (
              <>
                {processedArticles.length > 0 && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">
                      Processed Articles ({processedArticles.length})
                    </h3>
                    {processedArticles.length > articlesPerPage && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">
                          Page {currentPage} of {Math.ceil(processedArticles.length / articlesPerPage)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                {(() => {
                  const startIdx = (currentPage - 1) * articlesPerPage;
                  const endIdx = currentPage * articlesPerPage;
                  const articlesToShow = processedArticles.slice(startIdx, endIdx);
                  console.log(`Displaying articles ${startIdx}-${endIdx} of ${processedArticles.length}:`, articlesToShow.length);
                  console.log('Sample article titles:', articlesToShow.slice(0, 3).map(a => a.title));
                  return articlesToShow.map((article, index) => (
                <motion.div
                  key={`article-${article.id}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-slate-800/50 border border-slate-700/40 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium flex-1">{article.title}</h3>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const isSelected = selectedArticles.some(selected => selected.title === article.title);
                            if (isSelected) {
                              // Remove from selected articles
                              const newSelected = selectedArticles.filter(selected => selected.title !== article.title);
                              setSelectedArticles(newSelected);
                            } else {
                              // Add to selected articles
                              selectForReport(article);
                            }
                          }}
                          className={`w-32 px-3 py-1 text-sm rounded-md border ${
                            selectedArticles.some(selected => selected.title === article.title) 
                              ? "bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border-blue-700/30" 
                              : "bg-green-900/30 hover:bg-green-900/50 text-green-400 border-green-700/30"
                          }`}
                        >
                          {selectedArticles.some(selected => selected.title === article.title) ? "Entered in Report" : "Select for Report"}
                        </button>
                        <button
                          onClick={() => removeProcessedArticle(article)}
                          className="w-8 h-8 flex items-center justify-center bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-md border border-red-700/30"
                        >
                          ×
                        </button>
                      </div>
                      {
                        //(() => {
                        //const indicator = getSourceAppIndicator(article);
                        //return (
                        //  <span className={`px-2 py-1 text-xs font-bold rounded ${indicator.color} ${indicator.textColor}`}>
                        //    {indicator.label}
                        //  </span>
                        //);
                        //})()
                      }
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Threat Name</p>
                      <p className="text-sm">{article.threatName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Vulnerability ID</p>
                      <p className="text-sm">{article.vulnerabilityId}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-400 mb-1">Summary</p>
                      <p className="text-sm">{article.summary}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-400 mb-1">Impacts</p>
                      <p className="text-sm">{article.impacts}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Attack Vector</p>
                      <p className="text-sm">{article.attackVector}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Target OS</p>
                      <p className="text-sm">{article.targetOS}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Source</p>
                      <p className="text-sm">{article.sourcePublication}</p>
                    </div>
                  </div>
                </motion.div>
              ));
                })()}
              </>
            )}
            </div>
          </div>
        </div>
        
        {/* Selected Articles Section - Right Side, Fixed */}
        <div className="w-80 flex-shrink-0 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="h-full overflow-y-auto p-5">
            {/* Action Buttons */}
            <button
              onClick={sendToExecutiveReport}
              disabled={selectedArticles.length === 0 || createReportMutation.isPending || addToExistingReportMutation.isPending}
              className="mb-2 w-full px-4 py-2 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-md disabled:opacity-50 disabled:hover:bg-[#BF00FF] disabled:hover:text-white"
            >
              {(createReportMutation.isPending || addToExistingReportMutation.isPending) ? "Processing..." : "Send to Executive Report"}
            </button>
            
            <button
              onClick={() => {
                const articleIds = selectedArticles.map(article => article.id);
                const topic = reportTopic.trim() || undefined;
                createReportMutation.mutate({ articleIds, topic });
              }}
              disabled={createReportMutation.isPending || addToExistingReportMutation.isPending}
              className="mb-4 w-full px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50"
            >
              {(createReportMutation.isPending || addToExistingReportMutation.isPending) ? "Creating..." : "New Report"}
            </button>
            
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Selected Articles</h2>
              <span className="text-sm text-slate-400">
                {selectedArticles.length} selected
              </span>
            </div>
          
          {/* Report Topic Field */}
          <div className="mb-4">
            <label htmlFor="reportTopic" className="block text-sm text-slate-300 mb-2">
              Report Topic (Optional)
            </label>
            <input
              id="reportTopic"
              type="text"
              value={reportTopic}
              onChange={(e) => {
                setReportTopic(e.target.value);
              }}
              placeholder="Enter a topic (Optional)"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              This topic will appear in the Executive Report below the title
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            {selectedArticles.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No articles selected yet
              </p>
            ) : (
              selectedArticles.map((article, index) => (
                <div 
                  key={`selected-${article.id}-${index}`}
                  className="p-3 bg-slate-800/50 border border-slate-700/40 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium mb-1 flex-1">{article.title}</h4>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => removeSelectedArticle(article.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                      {(() => {
                        const indicator = getSourceAppIndicator(article);
                        return (
                          <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${indicator.color} ${indicator.textColor}`}>
                            {indicator.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    {article.threatName}
                  </p>
                  <p className="text-xs line-clamp-2">
                    {article.summary}
                  </p>
                </div>
              ))
            )}
          </div>
          </div>
        </div>
      </div>
      
      {/* Pagination Controls - At the bottom of the research page */}
      {processedArticles.length > articlesPerPage && (
        <div className="flex items-center justify-center gap-4 mt-6 p-4 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 mr-2">
              Page {currentPage} of {Math.ceil(processedArticles.length / articlesPerPage)}
            </span>
            {Array.from({ length: Math.ceil(processedArticles.length / articlesPerPage) }, (_, i) => i + 1)
              .filter(page => {
                const totalPages = Math.ceil(processedArticles.length / articlesPerPage);
                return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
              })
              .map((page, index, visiblePages) => {
                const prevPage = visiblePages[index - 1];
                const showEllipsis = prevPage && page - prevPage > 1;
                
                return (
                  <React.Fragment key={page}>
                    {showEllipsis && <span className="text-slate-400 px-2">...</span>}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-md min-w-[40px] ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                );
              })}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(processedArticles.length / articlesPerPage)))}
            disabled={currentPage === Math.ceil(processedArticles.length / articlesPerPage)}
            className="px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

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
    </div>
  );
}
