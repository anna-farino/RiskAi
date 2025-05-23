import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";

// Store real articles at module level, limiting to most recent ones
// We'll limit to 10 recent articles to avoid memory issues
const MAX_STORED_ARTICLES = 10;
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
  
  // Load saved URLs and article summaries from localStorage
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
      
      // Load saved article summaries from localStorage
      const savedArticlesStr = localStorage.getItem('savedArticleSummaries');
      if (savedArticlesStr) {
        try {
          const parsed = JSON.parse(savedArticlesStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProcessedArticles(parsed);
            
            // Update module-level array
            storedArticles.length = 0;
            storedArticles.push(...parsed);
          }
        } catch (e) {
          console.error("Failed to parse saved article summaries", e);
        }
      }
      
      // Load selected articles
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
    } catch (e) {
      console.error("Failed to load saved data", e);
    }
  }, []);
  
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
      setError("Please enter a URL");
      return;
    }
    
    // Save this URL to our recent URLs
    saveUrl(url);
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(serverUrl + "/api/news-capsule/process-url", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject(),
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to process article");
      }
      
      const data = await response.json();
      
      // Make sure we only store real articles by checking for required fields
      if (data && data.id && data.title) {
        // Update both state and module variables - add to front of array
        const newProcessedArticles = [data, ...processedArticles];
        
        // Only keep the most recent articles (limited by MAX_STORED_ARTICLES)
        const limitedArticles = newProcessedArticles.slice(0, MAX_STORED_ARTICLES);
        
        setProcessedArticles(limitedArticles);
        
        // Update module variable
        storedArticles.length = 0; // Clear array without creating a new one
        storedArticles.push(...limitedArticles); // Add only the limited set
        
        // Save articles to localStorage so they persist between visits
        try {
          localStorage.setItem('savedArticleSummaries', JSON.stringify(limitedArticles));
        } catch (e) {
          console.error("Failed to save article summaries", e)
        }
      }
      
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
      
      // Check for today's existing reports first
      const checkResponse = await fetch(serverUrl + "/api/news-capsule/reports", {
        method: "GET",
        credentials: 'include',
        headers: {
          ...csfrHeaderObject(),
        },
      });
      
      if (!checkResponse.ok) {
        throw new Error("Failed to check for existing reports");
      }
      
      const existingReports = await checkResponse.json();
      
      // Find reports from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaysReports = existingReports.filter(report => {
        const reportDate = new Date(report.createdAt);
        return reportDate >= today;
      });
      
      let useExistingReport = false;
      let existingReportId = null;
      let versionNumber = 1;
      
      // If there are today's reports, ask if user wants to add to existing or create new
      if (todaysReports.length > 0) {
        useExistingReport = window.confirm(
          "There's already a report for today. Would you like to add these articles to the existing report? Click OK to add to existing report, or Cancel to create a new version."
        );
        
        if (useExistingReport) {
          existingReportId = todaysReports[0].id;
        } else {
          // Count how many reports exist today to determine version number
          versionNumber = todaysReports.length + 1;
        }
      }
      
      // Send to API with proper parameters
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
      });
      
      if (!response.ok) {
        throw new Error("Failed to add articles to report");
      }
      
      const result = await response.json();
      console.log("Articles added to report:", result);
      
      // Success message
      alert("Articles successfully added to report!");
      
      // Don't clear selected articles - leave them in the selection column
      // Just show a success message to confirm they were added to the report
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
  
  const removeProcessedArticle = (id: string) => {
    const newProcessedArticles = processedArticles.filter(article => article.id !== id);
    setProcessedArticles(newProcessedArticles);
    
    // Update module variable
    storedArticles.length = 0;
    storedArticles.push(...newProcessedArticles);
    
    // Update localStorage to persist article list
    try {
      localStorage.setItem('savedArticleSummaries', JSON.stringify(newProcessedArticles));
    } catch (e) {
      console.error("Failed to update article summaries in storage", e);
    }
    
    // Also remove from selected if present
    if (selectedArticles.some(article => article.id === id)) {
      removeSelectedArticle(id);
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
          <h2 className="text-xl font-semibold mb-4">Submit Article URL</h2>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="url-input" className="text-sm text-slate-400">
                Article URL
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
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
            {processedArticles.length > 0 && <h3 className="text-lg font-medium">Processed Articles</h3>}
            
            {processedArticles.map((article) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-slate-800/50 border border-slate-700/40 rounded-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium">{article.title}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => selectForReport(article)}
                      className="px-3 py-1 text-sm bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-md border border-green-700/30"
                    >
                      Select for Report
                    </button>
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
          
          <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto">
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
        </div>
      </div>
    </div>
  );
}