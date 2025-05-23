import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { format } from "date-fns";
import { serverUrl } from "@/utils/server-url";
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
}

interface Report {
  id: string;
  createdAt: string;
  articles: ArticleSummary[];
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchReports();
  }, []);
  
  const fetchReports = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(serverUrl + "/api/news-capsule/reports", {
        method: "GET",
        credentials: 'include',
        headers: {
          ...csfrHeaderObject(),
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }
      
      const data = await response.json();
      console.log("Reports data:", data);
      
      // Check if we got any reports
      if (data.length === 0) {
        toast({
          title: "No reports found",
          description: "Create reports by sending articles from the Research page",
          variant: "default",
        });
      }
      
      setReports(data);
      
      // Auto-select the most recent report if it exists
      if (data.length > 0) {
        setSelectedReport(data[0]);
        console.log("Selected report articles:", data[0].articles);
      }
    } catch (err) {
      console.error("Error fetching reports:", err);
      setError("Unable to load reports. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReportSelect = (report: Report) => {
    setSelectedReport(report);
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };
  
  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "h:mm a");
    } catch {
      return "";
    }
  };
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Executive Reports</h1>
        <p className="text-slate-300">
          View and manage compiled reports for executive review.
        </p>
      </div>
      
      {isLoading && (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}
      
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-md text-red-400">
          {error}
        </div>
      )}
      
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Reports List */}
          <div className="md:col-span-1 p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">Reports</h2>
            
            {reports.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No reports available</p>
            ) : (
              <div className="flex flex-col gap-2">
                {reports.map((report) => (
                  <div key={report.id} className="relative group">
                    <button
                      onClick={() => handleReportSelect(report)}
                      className={`text-left w-full p-3 rounded-md transition-colors ${
                        selectedReport?.id === report.id
                          ? "bg-primary/20 border border-primary/30"
                          : "bg-slate-800/50 border border-slate-700/40 hover:bg-slate-800"
                      }`}
                    >
                      <p className="font-medium">
                        Report {formatDate(report.createdAt)}
                      </p>
                      <p className="text-xs text-blue-400">
                        {formatTime(report.createdAt)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {report.articles.length} articles
                      </p>
                    </button>
                    {/* Delete functionality will be added back after fixing page loading */}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Report Details */}
          <div className="md:col-span-4 p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
            {selectedReport ? (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">
                    Executive Report: {formatDate(selectedReport.createdAt)}
                  </h2>
                  <button
                    className="px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded-md"
                    onClick={() => {
                      // Logic to export or print the report could go here
                      window.print();
                    }}
                  >
                    Export
                  </button>
                </div>
                
                {selectedReport.articles.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">This report contains no articles</p>
                ) : (
                  <div className="space-y-6">
                    {selectedReport.articles.map((article, index) => (
                      <motion.div
                        key={article.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 bg-slate-800/50 border border-slate-700/40 rounded-lg"
                      >
                        <h3 className="text-lg font-medium mb-2">{article.title}</h3>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-slate-400">Threat Name</p>
                            <p className="text-sm">{article.threatName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Vulnerability ID</p>
                            <p className="text-sm">{article.vulnerabilityId}</p>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-xs text-slate-400 mb-1">Summary</p>
                          <p className="text-sm">{article.summary}</p>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-xs text-slate-400 mb-1">Impacts</p>
                          <p className="text-sm">{article.impacts}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-400">Attack Vector</p>
                            <p className="text-sm">{article.attackVector}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Source</p>
                            <p className="text-sm">{article.sourcePublication}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Target OS</p>
                            <p className="text-sm">{article.targetOS}</p>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-700/40">
                          <a 
                            href={article.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View original article
                          </a>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[40vh]">
                <p className="text-slate-400">Select a report to view its details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}