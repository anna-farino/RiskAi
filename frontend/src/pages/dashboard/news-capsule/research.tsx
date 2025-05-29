import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";

// Store real articles at module level, allowing more articles for pagination
// Increased limit to support pagination functionality
const MAX_STORED_ARTICLES = 100;
const storedArticles: ArticleSummary[] = [];
const storedSelectedArticles: ArticleSummary[] = [];

// Store recent user-entered URLs (up to 10)
const MAX_RECENT_URLS = 10;
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
  microsoftConnection: string;
  sourcePublication: string;
  originalUrl: string;
  targetOS: string;
  createdAt: string;
  markedForReporting: boolean;
  markedForDeletion: boolean;
}

export default function Research() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedArticles, setProcessedArticles] = useState<ArticleSummary[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<ArticleSummary[]>([]);
  const [savedUrls, setSavedUrls] = useState<string[]>([]);
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [articlesPerPage] = useState(10);
  const [reportTopic, setReportTopic] = useState("");
  
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
            setSelectedArticles(parsed);
            
            // Update module-level array
            storedSelectedArticles.length = 0;
            storedSelectedArticles.push(...parsed);
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
        
        // Remove duplicates based on ID, title, and URL
        const uniqueArticles = articles.filter((article: any, index: number, self: any[]) => {
          const firstIndex = self.findIndex((a: any) => 
            a.id === article.id ||
            (a.title.toLowerCase().trim() === article.title.toLowerCase().trim() && a.originalUrl === article.originalUrl)
          );
          return firstIndex === index;
        });
        
        setProcessedArticles(uniqueArticles);
        
        // Update module-level array
        storedArticles.length = 0;
        storedArticles.push(...articles);
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
      
      // Create a counter for successful processing
      let successCount = 0;
      let errorCount = 0;
      let errorMessage = "";
      const newArticles: ArticleSummary[] = [];
      
      // Process each URL sequentially
      for (const singleUrl of urls) {
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
            errorCount++;
            errorMessage = `Failed to process ${errorCount} URL(s)`;
            continue; // Try the next URL
          }
          
          const data = await response.json();
          
          // Make sure we only store real articles by checking for required fields
          if (data && data.id && data.title) {
            successCount++;
            newArticles.push(data);
          }
        } catch (err) {
          errorCount++;
          errorMessage = `Failed to process ${errorCount} URL(s)`;
        }
      }
      
      // Update state with all new articles at once
      if (newArticles.length > 0) {
        // Add new articles to the front of the existing array
        const updatedProcessedArticles = [...newArticles, ...processedArticles];
        
        // Only keep the most recent articles (limited by MAX_STORED_ARTICLES)
        const limitedArticles = updatedProcessedArticles.slice(0, MAX_STORED_ARTICLES);
        
        setProcessedArticles(limitedArticles);
        
        // Update module variable
        storedArticles.length = 0; // Clear array without creating a new one
        storedArticles.push(...limitedArticles); // Add only the limited set
        
        // Save articles to localStorage so they persist between visits
        try {
          localStorage.setItem('savedArticleSummaries', JSON.stringify(limitedArticles));
        } catch (e) {
          console.error("Failed to save article summaries", e);
        }
      }
      
      // Set a success or partial success message
      if (errorCount > 0) {
        if (successCount > 0) {
          setError(`Successfully processed ${successCount} URL(s). ${errorMessage}`);
        } else {
          setError(errorMessage);
        }
      } else if (successCount > 0) {
        // Clear any previous errors if all URLs processed successfully
        setError(null);
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
          
          // Find the highest version number among today's reports
          const highestVersion = todaysReports.reduce((max: number, report: any) => {
            // Make sure to use the actual version number that was stored
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
              versionNumber: versionNumber,
              topic: reportTopic.trim() || undefined
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
            // Combine articles, avoiding duplicates based on title and URL
            const existingArticles = savedReports[reportIndex].articles || [];
            const newArticles = selectedArticles;
            const combinedArticles = [...existingArticles];
            
            // Add only articles that don't already exist in the report
            for (const article of newArticles) {
              const isDuplicate = combinedArticles.some((a: any) => 
                a.id === article.id ||
                a.title.toLowerCase().trim() === article.title.toLowerCase().trim() ||
                a.originalUrl === article.originalUrl
              );
              
              if (!isDuplicate) {
                combinedArticles.push(article);
              }
            }
            
            savedReports[reportIndex] = {
              ...savedReports[reportIndex],
              articles: combinedArticles
            };
          }
        } else {
          // Create new report - remove duplicates based on title and URL
          const uniqueArticles = selectedArticles.filter((article, index, self) => {
            const firstIndex = self.findIndex(a => 
              a.title.toLowerCase().trim() === article.title.toLowerCase().trim() ||
              a.originalUrl === article.originalUrl
            );
            return firstIndex === index;
          });
          
          const newReport = {
            id: newReportId,
            createdAt: new Date().toISOString(),
            articles: uniqueArticles,
            versionNumber: versionNumber,
            topic: reportTopic.trim() || undefined
          };
          
          console.log("Creating new report with topic:", reportTopic.trim() || "NO TOPIC");
          
          // Add to beginning of reports array
          savedReports.unshift(newReport);
        }
        
        // Save updated reports to localStorage
        localStorage.setItem('newsCapsuleReports', JSON.stringify(savedReports));
        console.log("Updated reports saved to localStorage:", savedReports.length);
        
        // Success message
        alert("Articles successfully added to report!");
        setIsLoading(false);
      };
      
      // If there are today's reports, show a dialog to select which report to add to
      if (todaysReports.length > 0) {
        // First ask if user wants to add to existing or create new
        const useExistingReport = window.confirm(
          "There are already reports for today. Would you like to add these articles to an existing report? Click OK to add to an existing report, or Cancel to create a new version."
        );
        
        if (useExistingReport) {
          // If there's only one report today, use that
          if (todaysReports.length === 1) {
            await processReport(true, todaysReports[0].id);
          } else {
            // Multiple reports exist, create a selection dialog
            return new Promise<void>((resolve) => {
              const selectDialog = document.createElement('div');
              selectDialog.style.position = 'fixed';
              selectDialog.style.top = '0';
              selectDialog.style.left = '0';
              selectDialog.style.width = '100%';
              selectDialog.style.height = '100%';
              selectDialog.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
              selectDialog.style.zIndex = '9999';
              selectDialog.style.display = 'flex';
              selectDialog.style.alignItems = 'center';
              selectDialog.style.justifyContent = 'center';
              
              // Create dialog content
              const dialogContent = document.createElement('div');
              dialogContent.style.backgroundColor = '#1e293b';
              dialogContent.style.border = '1px solid #475569';
              dialogContent.style.borderRadius = '8px';
              dialogContent.style.padding = '24px';
              dialogContent.style.width = '500px';
              dialogContent.style.maxWidth = '90%';
              
              // Create dialog title
              const title = document.createElement('h3');
              title.textContent = 'Select a Report to Add Articles To';
              title.style.fontSize = '18px';
              title.style.fontWeight = 'bold';
              title.style.marginBottom = '16px';
              title.style.color = 'white';
              
              // Create description
              const description = document.createElement('p');
              description.textContent = 'Choose which report version you want to add these articles to:';
              description.style.fontSize = '14px';
              description.style.marginBottom = '16px';
              description.style.color = '#e2e8f0';
              
              // Create select element
              const select = document.createElement('select');
              select.style.width = '100%';
              select.style.padding = '8px 12px';
              select.style.backgroundColor = '#0f172a';
              select.style.color = 'white';
              select.style.border = '1px solid #475569';
              select.style.borderRadius = '4px';
              select.style.marginBottom = '20px';
              
              // Sort reports with newest on top
              const sortedReports = [...todaysReports].sort((a: any, b: any) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              
              // Add options for each report
              sortedReports.forEach((report: any) => {
                const option = document.createElement('option');
                option.value = report.id;
                
                const createdDate = new Date(report.createdAt);
                const time = `${createdDate.getHours().toString().padStart(2, '0')}:${createdDate.getMinutes().toString().padStart(2, '0')}`;
                const versionText = report.versionNumber && report.versionNumber > 1 ? 
                  `Version ${report.versionNumber}` : 'Version 1';
                
                option.textContent = `${time} - ${versionText} (${report.articles ? report.articles.length : 0} articles)`;
                select.appendChild(option);
              });
              
              // Create button container
              const buttonContainer = document.createElement('div');
              buttonContainer.style.display = 'flex';
              buttonContainer.style.gap = '12px';
              buttonContainer.style.justifyContent = 'flex-end';
              
              // Create cancel button (creates new report)
              const cancelButton = document.createElement('button');
              cancelButton.textContent = 'Create New Version';
              cancelButton.style.padding = '8px 16px';
              cancelButton.style.backgroundColor = '#334155';
              cancelButton.style.color = 'white';
              cancelButton.style.border = 'none';
              cancelButton.style.borderRadius = '4px';
              cancelButton.style.cursor = 'pointer';
              
              // Create select button
              const selectButton = document.createElement('button');
              selectButton.textContent = 'Add to Selected Report';
              selectButton.style.padding = '8px 16px';
              selectButton.style.backgroundColor = '#2563eb';
              selectButton.style.color = 'white';
              selectButton.style.border = 'none';
              selectButton.style.borderRadius = '4px';
              selectButton.style.cursor = 'pointer';
              
              // Add event listeners
              cancelButton.addEventListener('click', async () => {
                document.body.removeChild(selectDialog);
                await processReport(false, null);
                resolve();
              });
              
              selectButton.addEventListener('click', async () => {
                const selectedReportId = select.value;
                document.body.removeChild(selectDialog);
                
                if (selectedReportId) {
                  await processReport(true, selectedReportId);
                  resolve();
                }
              });
              
              // Assemble dialog
              buttonContainer.appendChild(cancelButton);
              buttonContainer.appendChild(selectButton);
              dialogContent.appendChild(title);
              dialogContent.appendChild(description);
              dialogContent.appendChild(select);
              dialogContent.appendChild(buttonContainer);
              selectDialog.appendChild(dialogContent);
              
              // Add dialog to document
              document.body.appendChild(selectDialog);
            });
          }
        } else {
          // Create new report
          await processReport(false, null);
        }
      } else {
        // No reports today, create a new one
        await processReport(false, null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
        console.error('Failed to delete article from database');
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* URL Input Section */}
        <div className="md:col-span-2 p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Submit Article URLs</h2>
          
          <div className="flex flex-col gap-4">
            {/* Bulk URL Mode Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setBulkMode(false)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  !bulkMode 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Single URL
              </button>
              <button
                onClick={() => setBulkMode(true)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  bulkMode 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Bulk URLs
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="url-input" className="text-sm text-slate-400">
                {bulkMode ? 'Article URLs (one per line)' : 'Article URL'}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  {bulkMode ? (
                    <textarea
                      id="url-input"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/article1&#10;https://example.com/article2&#10;https://example.com/article3"
                      rows={6}
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
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md disabled:opacity-50"
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      // Confirm before clearing all
                      if (!window.confirm('This will delete all processed articles from the database. Are you sure?')) {
                        return;
                      }
                      
                      // Clear UI immediately
                      setProcessedArticles([]);
                      storedArticles.length = 0;
                      localStorage.removeItem('savedArticleSummaries');
                      setCurrentPage(1);
                      
                      // Delete all articles from database using bulk delete
                      try {
                        const response = await fetch(`${serverUrl}/api/news-capsule/articles`, {
                          method: 'DELETE',
                          credentials: 'include',
                          headers: {
                            ...csfrHeaderObject(),
                          },
                        });
                        
                        if (!response.ok) {
                          const errorText = await response.text();
                          console.error(`Failed to delete all articles from database. Status: ${response.status}, Error: ${errorText}`);
                        } else {
                          console.log('All articles successfully deleted from database');
                        }
                      } catch (error) {
                        console.error('Error clearing articles from database:', error);
                      }
                    }}
                    className="px-3 py-1 text-sm bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-md border border-red-700/30"
                  >
                    Clear All
                  </button>
                  {processedArticles.length > articlesPerPage && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">
                        Page {currentPage} of {Math.ceil(processedArticles.length / articlesPerPage)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {processedArticles
              .slice((currentPage - 1) * articlesPerPage, currentPage * articlesPerPage)
              .map((article) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-slate-800/50 border border-slate-700/40 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-medium">{article.title}</h3>
                    <div className="flex gap-2">
                      {selectedArticles.some(selected => selected.id === article.id) ? (
                        <button
                          onClick={() => removeSelectedArticle(article.id)}
                          className="px-3 py-1 text-sm bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-md border border-blue-700/30"
                        >
                          Article In Report
                        </button>
                      ) : (
                        <button
                          onClick={() => selectForReport(article)}
                          className="px-3 py-1 text-sm bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-md border border-green-700/30"
                        >
                          Add to Report
                        </button>
                      )}
                      <button
                        onClick={() => removeProcessedArticle(article.id)}
                        className="px-3 py-1 text-sm bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-md border border-red-700/30"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              ))}
          </div>
          
        </div>
        
        {/* Selected Articles Section */}
        <div className="p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
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
              placeholder="Enter a topic for this report..."
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              This topic will appear in the Executive Report below the title
            </p>
          </div>
          
          <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto">
            {selectedArticles.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No articles selected yet
              </p>
            ) : (
              selectedArticles.map((article) => (
                <div 
                  key={article.id}
                  className="p-3 bg-slate-800/50 border border-slate-700/40 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium mb-1">{article.title}</h4>
                    <button
                      onClick={() => removeSelectedArticle(article.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
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
          
          <button
            onClick={sendToExecutiveReport}
            disabled={selectedArticles.length === 0 || isLoading}
            className="mt-4 w-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md disabled:opacity-50"
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
                    
                    // Find the highest version number among today's reports
                    const highestVersion = todaysReports.reduce((max: number, report: any) => {
                      // Make sure to use the actual version number that was stored
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
                  alert(`Successfully created new Executive Report (Version ${versionNumber}) with ${selectedArticles.length} articles`);
                } else {
                  alert(`Successfully created empty Executive Report (Version ${versionNumber}). Add articles from the Research page to populate it.`);
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "An error occurred");
              } finally {
                setIsLoading(false);
              }
            }}
            className="mt-2 w-full px-4 py-2 bg-slate-700 text-white hover:bg-slate-600 rounded-md disabled:opacity-50"
          >
            New Report
          </button>
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
    </div>
  );
}