import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { serverUrl } from "@/utils/server-url";

// Store real articles at module level, limiting to most recent ones
// We'll limit to 10 recent articles to avoid memory issues
const MAX_STORED_ARTICLES = 10;
const storedArticles: ArticleSummary[] = [];
const storedSelectedArticles: ArticleSummary[] = [];

// List of demo URLs to ensure they're removed from storage
const demoUrls = [
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
  
  // Clean up hardcoded URLs and initialize empty state on component mount
  useEffect(() => {
    // Clear all localStorage and sessionStorage to start fresh
    try {
      localStorage.removeItem('newsProcessedArticles');
      localStorage.removeItem('processedArticles');
      sessionStorage.removeItem('processedArticles');
    } catch (e) {
      console.error("Failed to clear storage", e);
    }
    
    // Reset module-level arrays
    storedArticles.length = 0;
    storedSelectedArticles.length = 0;
    
    // Set initial empty state
    setProcessedArticles([]);
    setSelectedArticles([]);
  }, []);
  
  const clearUrl = () => {
    setUrl("");
    setError(null);
  };
  
  const processUrl = async () => {
    if (!url) {
      setError("Please enter a URL");
      return;
    }
    
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
  };
  
  const sendToExecutiveReport = async () => {
    if (selectedArticles.length === 0) {
      setError("No articles selected for the report");
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(serverUrl + "/api/news-capsule/add-to-report", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject(),
        },
        body: JSON.stringify({ 
          articleIds: selectedArticles.map(article => article.id) 
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add articles to report");
      }
      
      // Clear selected articles but keep processed ones
      setSelectedArticles([]);
      storedSelectedArticles.length = 0;
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
  };
  
  const removeProcessedArticle = (id: string) => {
    const newProcessedArticles = processedArticles.filter(article => article.id !== id);
    setProcessedArticles(newProcessedArticles);
    
    // Update module variable
    storedArticles.length = 0;
    storedArticles.push(...newProcessedArticles);
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
                <input
                  id="url-input"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  autoComplete="off"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md"
                />
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
                    <p className="text-sm">{article.microsoftConnection}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Source</p>
                    <p className="text-sm">{article.sourcePublication}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Target OS</p>
                    <p className="text-sm">{article.targetOS}</p>
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