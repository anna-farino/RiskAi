import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";
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

// Store real articles at module level, allowing more articles for pagination
// Increased limit to support pagination functionality
const MAX_STORED_ARTICLES = 100;
const storedArticles: ArticleSummary[] = [];
const storedSelectedArticles: ArticleSummary[] = [];

// Store recent user-entered URLs (up to 5)
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

interface ArticleSummary {
  id: string;
  title: string;
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  sourcePublication: string;
  originalUrl: string;
  targetOS: string;
  createdAt: string;
  markedForReporting: boolean;
  markedForDeletion: boolean;

}

// Function to determine which app sent the article
const getSourceAppIndicator = (article: ArticleSummary) => {
  // Articles processed through News Capsule research page show 'NC'
  // Other manually entered articles show 'M'
  return { label: 'NC', color: 'bg-purple-600', textColor: 'text-purple-100' };
};



export default function Research() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedArticles, setProcessedArticles] = useState<ArticleSummary[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<ArticleSummary[]>([]);
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

  
  // Load saved URLs from localStorage and fetch articles from database
  useEffect(() => {
    // Load saved URLs from localStorage
    try {
      const savedUrlsStr = localStorage.getItem('userSavedUrls');
      if (savedUrlsStr) {
        const parsed = JSON.parse(savedUrlsStr);
        if (Array.isArray(parsed)) {
          // Filter out any excluded URLs
          const filteredUrls = parsed.filter(url => !excludedUrls.includes(url));
          setSavedUrls(filteredUrls);
          
          // Also update the module-level array
          recentUrls.length = 0;
          recentUrls.push(...filteredUrls);
        }
      }
      
      // Load selected articles from localStorage
      const savedSelectedStr = localStorage.getItem('savedSelectedArticles');
      if (savedSelectedStr) {
        try {
          const parsed = JSON.parse(savedSelectedStr);
          if (Array.isArray(parsed)) {
            // Remove duplicates before setting using title as criteria
            const uniqueSelected = parsed.filter((article, index, self) => 
              index === self.findIndex(a => a.title === article.title)
            );
            setSelectedArticles(uniqueSelected);
            
            // Update module-level array and save cleaned data
            storedSelectedArticles.length = 0;
            storedSelectedArticles.push(...uniqueSelected);
            localStorage.setItem('savedSelectedArticles', JSON.stringify(uniqueSelected));
          }
        } catch (e) {
          console.error("Failed to parse saved selected articles", e);
        }
      }
      
      // Load report topic
      const savedTopic = localStorage.getItem('reportTopic');
      if (savedTopic) {
        setReportTopic(savedTopic);
      }
    } catch (e) {
      console.error("Failed to load saved data", e);
    }
    
    // Fetch articles from database
    fetchArticlesFromDatabase();
  }, []);

  // Function to fetch articles from the database
  const fetchArticlesFromDatabase = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/news-capsule/articles`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject(),
        },
      });

      if (response.ok) {
        const articles = await response.json();
        console.log('Fetched articles from database:', articles.length);
        
        // Filter out articles marked for deletion and remove duplicates
        const activeArticles = articles.filter((article: any) => !article.markedForDeletion);
        const uniqueArticles = activeArticles.filter((article: any, index: number, self: any[]) => 
          index === self.findIndex((a: any) => a.title === article.title)
        );
        
        console.log('Setting processed articles:', uniqueArticles.length);
        setProcessedArticles(uniqueArticles);
        
        // Update module-level array and save cleaned data
        storedArticles.length = 0;
        storedArticles.push(...uniqueArticles);
        localStorage.setItem('savedArticleSummaries', JSON.stringify(uniqueArticles));
        
        if (uniqueArticles.length !== articles.length) {
          console.log('Automatically removed duplicates:', articles.length - uniqueArticles.length);
        }
      } else {
        console.error('Failed to fetch articles from database');
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    }
  };
  
  const clearUrl = () => {
    setUrl("");
    setError(null);
  };
  
  // Save URL to recent URLs list
  const saveUrl = (urlToSave: string) => {
    // Don't save empty URLs or excluded demo URLs
    if (!urlToSave || excludedUrls.includes(urlToSave)) return;
    
    // Create new array without the URL (if it already exists)
    const filteredUrls = savedUrls.filter(u => u !== urlToSave);
    
    // Add the URL to the beginning of the array
    const newSavedUrls = [urlToSave, ...filteredUrls].slice(0, MAX_RECENT_URLS);
    
    // Update state and localStorage
    setSavedUrls(newSavedUrls);
    
    // Update module level array
    recentUrls.length = 0;
    recentUrls.push(...newSavedUrls);
    
    // Save to localStorage
    try {
      localStorage.setItem('userSavedUrls', JSON.stringify(newSavedUrls));
    } catch (e) {
      console.error("Failed to save URLs", e);
    }
  };
  
  // Handle selection from dropdown
  const selectSavedUrl = (selectedUrl: string) => {
    setUrl(selectedUrl);
    setShowUrlDropdown(false);
  };
  
  const processUrl = async () => {
    if (!url) {
      setError(bulkMode ? "Please enter URLs (one per line)" : "Please enter a URL");
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Split the input based on mode - by lines for bulk mode, by commas for single mode
      const urls = bulkMode 
        ? url.split('\n').map(u => u.trim()).filter(u => u.length > 0)
        : url.split(',').map(u => u.trim()).filter(u => u.length > 0);
      
      if (urls.length === 0) {
        setError("Please enter valid URLs");
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
        
        // Update loading state with current progress
        setError(`Processing article ${i + 1} of ${urls.length}: ${singleUrl.substring(0, 50)}...`);
        
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
            
            // Show immediate success feedback
            setError(`Processed ${successCount} of ${urls.length} articles successfully`);
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
      
      // Add newly processed articles to the display immediately
      if (newArticles.length > 0) {
        setProcessedArticles(prev => {
          // Add new articles to the beginning, avoiding duplicates
          const existingIds = new Set(prev.map(a => a.id));
          const uniqueNewArticles = newArticles.filter(a => !existingIds.has(a.id));
          return [...uniqueNewArticles, ...prev];
        });
        
        // Update localStorage with new articles
        try {
          const updatedArticles = [...newArticles, ...processedArticles];
          const uniqueArticles = updatedArticles.filter((article, index, self) => 
            index === self.findIndex(a => a.id === article.id)
          );
          localStorage.setItem('savedArticleSummaries', JSON.stringify(uniqueArticles));
        } catch (e) {
          console.error("Failed to update localStorage", e);
        }
      }
      
      // Set detailed success or error message
      if (errorCount > 0) {
        if (successCount > 0) {
          setError(`Successfully processed ${successCount} of ${urls.length} articles. ${errorCount} failed to process.`);
        } else {
          setError(`Failed to process all ${urls.length} articles. Check console for details.`);
        }
      } else if (successCount > 0) {
        setError(null);
        console.log(`All ${successCount} articles processed successfully!`);
      }
      
      // Clear the input field
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectForReport = (article: ArticleSummary) => {
    // Check if article with same title already exists
    const alreadySelected = selectedArticles.some(selected => selected.title === article.title);
    
    if (alreadySelected) {
      console.log("Article already selected:", article.title);
      return; // Don't add duplicate
    }
    
    const newSelectedArticles = [...selectedArticles, article];
    setSelectedArticles(newSelectedArticles);
    
    // Update module variable
    storedSelectedArticles.length = 0;
    storedSelectedArticles.push(...newSelectedArticles);
    
    // Save selected articles to localStorage
    try {
      localStorage.setItem('savedSelectedArticles', JSON.stringify(newSelectedArticles));
    } catch (e) {
      console.error("Failed to save selected articles", e);
    }
  };
  
  const sendToExecutiveReport = async () => {
    if (selectedArticles.length === 0) {
      setError("No articles selected for the report");
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if localStorage already has reports
      let savedReports = [];
      let todaysReports = [];
      let versionNumber = 1;
      
      try {
        const localStorageReports = localStorage.getItem('newsCapsuleReports');
        if (localStorageReports) {
          savedReports = JSON.parse(localStorageReports);
          
          // Find reports from today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          todaysReports = savedReports.filter((report: any) => {
            const reportDate = new Date(report.createdAt);
            const reportDay = new Date(reportDate);
            reportDay.setHours(0, 0, 0, 0);
            return reportDay.getTime() === today.getTime();
          });
          
          // Find the highest version number among today's reports only
          const highestVersion = todaysReports.reduce((max: number, report: any) => {
            const reportVersion = parseInt(report.versionNumber) || 0;
            return reportVersion > max ? reportVersion : max;
          }, 0);
          
          // Set the next version number as one higher than the highest existing version
          versionNumber = highestVersion + 1;
          console.log("Next version number will be:", versionNumber, "highest found was:", highestVersion);
        }
      } catch (e) {
        console.error("Failed to check localStorage for reports", e);
        // Continue with empty arrays if localStorage fails
      }
      
      // Function to handle the actual report creation/update process
      const processReport = async (useExisting = false, reportId: string | null = null) => {
        let useExistingReport = useExisting;
        let existingReportId = reportId;
        
        try {
          // First try to save to server
          const response = await fetch(serverUrl + "/api/news-capsule/add-to-report", {
            method: "POST",
            credentials: 'include',
            headers: {
              "Content-Type": "application/json",
              ...csfrHeaderObject(),
            },
            body: JSON.stringify({ 
              articleIds: selectedArticles.map(article => article.id),
              useExistingReport: useExistingReport,
              existingReportId: existingReportId,
              versionNumber: versionNumber
            }),
            // Add a timeout to prevent long waiting
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log("Articles added to report on server:", result);
          }
        } catch (serverError) {
          console.error("Server error, will save locally only:", serverError);
          // Continue to save locally if server fails
        }
        
        // IMPORTANT: Always save to localStorage as a backup
        const newReportId = useExistingReport && existingReportId 
          ? existingReportId 
          : `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        if (useExistingReport && existingReportId) {
          // Update existing report in localStorage
          const reportIndex = savedReports.findIndex((r: any) => r.id === existingReportId);
          if (reportIndex !== -1) {
            // Combine articles, avoiding duplicates
            const existingArticles = savedReports[reportIndex].articles || [];
            const newArticles = selectedArticles;
            const combinedArticles = [...existingArticles];
            
            // Add only articles that don't already exist in the report
            for (const article of newArticles) {
              if (!combinedArticles.some((a: any) => a.id === article.id)) {
                combinedArticles.push(article);
              }
            }
            
            savedReports[reportIndex] = {
              ...savedReports[reportIndex],
              articles: combinedArticles
            };
          }
        } else {
          // Create new report
          const newReport = {
            id: newReportId,
            createdAt: new Date().toISOString(),
            articles: [...selectedArticles],
            versionNumber: versionNumber,
            topic: reportTopic.trim() || undefined
          };
          
          // Add to beginning of reports array
          savedReports.unshift(newReport);
        }
        
        // Save updated reports to localStorage
        localStorage.setItem('newsCapsuleReports', JSON.stringify(savedReports));
        console.log("Updated reports saved to localStorage:", savedReports.length);
        
        // Success message
        setSuccessMessage("Articles successfully added to report!");
        setShowSuccessDialog(true);
        setIsLoading(false);
      };
      
      // If there are today's reports, show a dialog to select which report to add to
      if (todaysReports.length > 0) {
        // First ask if user wants to add to existing or create new
        setConfirmTitle("Add to Existing Report?");
        setConfirmDescription("There are already reports for today. Would you like to add these articles to an existing report?");
        setConfirmAction(() => async () => {
          // User chose to add to existing report - add to the most recent one
          try {
            // Find the most recent report from today
            const existingReportId = todaysReports[0]?.id;
            
            // Find the existing report and add articles to it
            const existingReport = savedReports.find((r: any) => r.id === existingReportId);
            if (existingReport) {
              // Add new articles to existing report
              const updatedArticles = [...(existingReport.articles || []), ...selectedArticles];
              existingReport.articles = updatedArticles;
              existingReport.updatedAt = new Date().toISOString();
              
              // Update the reports array
              const updatedReports = savedReports.map((r: any) => 
                r.id === existingReportId ? existingReport : r
              );
              
              // Save to localStorage
              localStorage.setItem('newsCapsuleReports', JSON.stringify(updatedReports));
              
              // Clear selected articles
              setSelectedArticles([]);
              storedSelectedArticles.length = 0;
              localStorage.removeItem('savedSelectedArticles');
              
              // Show success message
              setSuccessMessage("Articles successfully added to existing report!");
              setShowSuccessDialog(true);
            }
          } catch (error) {
            console.error("Error adding to existing report:", error);
            setError("Failed to add articles to existing report");
          }
        });
        setShowConfirmDialog(true);
        return;
      }
      
      // If no reports today, create new one
      // Create the new report directly
      const newReportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newReport = {
        id: newReportId,
        createdAt: new Date().toISOString(),
        articles: [...selectedArticles],
        versionNumber: versionNumber,
        topic: reportTopic.trim() || undefined
      };
      
      // Add to beginning of reports array
      savedReports.unshift(newReport);
      
      // Save updated reports to localStorage
      localStorage.setItem('newsCapsuleReports', JSON.stringify(savedReports));
      console.log("Created new report with", selectedArticles.length, "articles, version", versionNumber);
      
      // Clear selected articles
      setSelectedArticles([]);
      storedSelectedArticles.length = 0;
      localStorage.removeItem('savedSelectedArticles');
      
      // Show success message
      setSuccessMessage("Articles successfully added to report!");
      setShowSuccessDialog(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  
  const removeSelectedArticle = (id: string) => {
    const newSelectedArticles = selectedArticles.filter(article => article.id !== id);
    setSelectedArticles(newSelectedArticles);
    
    // Update module variable
    storedSelectedArticles.length = 0;
    storedSelectedArticles.push(...newSelectedArticles);
    
    // Update localStorage to persist selection
    try {
      localStorage.setItem('savedSelectedArticles', JSON.stringify(newSelectedArticles));
    } catch (e) {
      console.error("Failed to update selected articles in storage", e);
    }
  };
  
  const removeProcessedArticle = async (id: string) => {
    // Optimistic update - remove from UI immediately
    const originalArticles = [...processedArticles];
    const optimisticArticles = processedArticles.filter(article => article.id !== id);
    setProcessedArticles(optimisticArticles);
    
    // Also remove from selected if present (optimistically)
    if (selectedArticles.some(article => article.id === id)) {
      removeSelectedArticle(id);
    }

    try {
      // Delete from database
      const response = await fetch(`${serverUrl}/api/news-capsule/articles/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject(),
        },
      });

      if (response.ok) {
        console.log('Article deleted successfully');
        // Update localStorage with the optimistic state
        try {
          localStorage.setItem('savedArticleSummaries', JSON.stringify(optimisticArticles));
        } catch (e) {
          console.error("Failed to update article summaries in storage", e);
        }
      } else {
        // Revert optimistic update on failure
        const responseText = await response.text();
        console.error('Failed to delete article from database:', response.status, responseText);
        setProcessedArticles(originalArticles);
      }
    } catch (error) {
      // Revert optimistic update on error
      console.error('Error deleting article:', error);
      setProcessedArticles(originalArticles);
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
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md"
                    aria-label="Clear input"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={processUrl}
                  disabled={isLoading}
                  className="px-4 py-2 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-md disabled:opacity-50"
                >
                  {isLoading ? "Processing..." : "Process"}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-md text-red-400">
                {error}
              </div>
            )}
          </div>
          
          {/* Processed Articles Display */}
          <div className="mt-6 flex flex-col gap-4">
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
                              storedSelectedArticles.length = 0;
                              storedSelectedArticles.push(...newSelected);
                              localStorage.setItem('savedSelectedArticles', JSON.stringify(newSelected));
                              console.log("Removed from selection:", article.title);
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
                          onClick={() => removeProcessedArticle(article.id)}
                          className="w-8 h-8 flex items-center justify-center bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-md border border-red-700/30"
                        >
                          ×
                        </button>
                      </div>
                      {(() => {
                        const indicator = getSourceAppIndicator(article);
                        return (
                          <span className={`px-2 py-1 text-xs font-bold rounded ${indicator.color} ${indicator.textColor}`}>
                            {indicator.label}
                          </span>
                        );
                      })()}
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
            </div>
          </div>
        </div>
        
        {/* Selected Articles Section - Right Side, Fixed */}
        <div className="w-80 flex-shrink-0 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="h-full overflow-y-auto p-5">
            {/* Action Buttons */}
            <button
              onClick={sendToExecutiveReport}
              disabled={selectedArticles.length === 0 || isLoading}
              className="mb-2 w-full px-4 py-2 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-md disabled:opacity-50 disabled:hover:bg-[#BF00FF] disabled:hover:text-white"
            >
              {isLoading ? "Processing..." : "Send to Executive Report"}
            </button>
            
            <button
              onClick={async () => {
                // Create a new report version - include selected articles if any exist
                try {
                  setIsLoading(true);
                  setError(null);
                  
                  // Check if localStorage already has reports
                  let savedReports = [];
                  let versionNumber = 1;
                  
                  try {
                    const localStorageReports = localStorage.getItem('newsCapsuleReports');
                    if (localStorageReports) {
                      savedReports = JSON.parse(localStorageReports);
                      
                      // Find reports from today
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      const todaysReports = savedReports.filter((report: any) => {
                        const reportDate = new Date(report.createdAt);
                        const reportDay = new Date(reportDate);
                        reportDay.setHours(0, 0, 0, 0);
                        return reportDay.getTime() === today.getTime();
                      });
                      
                      // Find the highest version number among today's reports only
                      const highestVersion = todaysReports.reduce((max: number, report: any) => {
                        const reportVersion = parseInt(report.versionNumber) || 0;
                        return reportVersion > max ? reportVersion : max;
                      }, 0);
                      
                      // Set the next version number as one higher than the highest existing version
                      versionNumber = highestVersion + 1;
                      console.log("Next version number will be:", versionNumber, "highest found was:", highestVersion);
                    }
                  } catch (e) {
                    console.error("Failed to check localStorage for reports", e);
                    // Continue with default values if localStorage fails
                  }
                  
                  // Create the new report - include selected articles if any exist
                  const newReportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                  const newReport = {
                    id: newReportId,
                    createdAt: new Date().toISOString(),
                    articles: [...selectedArticles], // Include selected articles
                    versionNumber: versionNumber,
                    topic: reportTopic.trim() || undefined
                  };
                  
                  // Add to beginning of reports array
                  savedReports.unshift(newReport);
                  
                  // Save updated reports to localStorage
                  localStorage.setItem('newsCapsuleReports', JSON.stringify(savedReports));
                  console.log("Created new report version", versionNumber, "with", selectedArticles.length, "articles");
                  
                  // Success message
                  if (selectedArticles.length > 0) {
                    setSuccessMessage(`Successfully created new Executive Report (Version ${versionNumber}) with ${selectedArticles.length} articles`);
                  } else {
                    setSuccessMessage(`Successfully created empty Executive Report (Version ${versionNumber}). Add articles from the Research page to populate it.`);
                  }
                  setShowSuccessDialog(true);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "An error occurred");
                } finally {
                  setIsLoading(false);
                }
              }}
              className="mb-4 w-full px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50"
            >
              New Report
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
                localStorage.setItem('reportTopic', e.target.value);
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
    </div>
  );
}
