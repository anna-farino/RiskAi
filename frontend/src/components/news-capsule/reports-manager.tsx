import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

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

export interface Report {
  id: string;
  createdAt: string;
  articles: ArticleSummary[];
  versionNumber?: number;
}

interface ReportsManagerProps {
  onReportSelect: (report: Report) => void;
  selectedReportId?: string;
}

export function ReportsManager({ onReportSelect, selectedReportId }: ReportsManagerProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Load reports from localStorage on component mount
  useEffect(() => {
    try {
      const savedReports = localStorage.getItem('newsCapsuleReports');
      if (savedReports) {
        const parsedReports = JSON.parse(savedReports);
        setReports(parsedReports);
        
        // Auto-select first report if no report is selected
        if (parsedReports.length > 0 && !selectedReportId) {
          onReportSelect(parsedReports[0]);
        } else if (selectedReportId) {
          // Find and select the report with the matching ID
          const selectedReport = parsedReports.find((r: Report) => r.id === selectedReportId);
          if (selectedReport) {
            onReportSelect(selectedReport);
          }
        }
      }
    } catch (err) {
      console.error("Error loading reports from localStorage:", err);
      setError("Failed to load saved reports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save reports to localStorage whenever they change
  useEffect(() => {
    if (reports.length > 0) {
      localStorage.setItem('newsCapsuleReports', JSON.stringify(reports));
    }
  }, [reports]);

  // Calculate version numbers for reports from the same day
  const getReportsWithVersions = () => {
    // Group reports by date (ignoring time)
    const reportsByDate: Record<string, Report[]> = {};
    
    reports.forEach(report => {
      const reportDate = new Date(report.createdAt);
      const dateKey = reportDate.toDateString();
      
      if (!reportsByDate[dateKey]) {
        reportsByDate[dateKey] = [];
      }
      
      reportsByDate[dateKey].push(report);
    });
    
    // Sort each day's reports by creation time and assign version numbers
    const reportsWithVersions = [...reports];
    
    Object.values(reportsByDate).forEach(dayReports => {
      // Sort by creation time (newest first)
      dayReports.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Assign version numbers
      dayReports.forEach((report, index) => {
        const version = dayReports.length - index;
        const reportIndex = reportsWithVersions.findIndex(r => r.id === report.id);
        if (reportIndex !== -1) {
          reportsWithVersions[reportIndex] = {
            ...reportsWithVersions[reportIndex], 
            versionNumber: version
          };
        }
      });
    });
    
    return reportsWithVersions;
  };

  const handleReportSelect = (report: Report) => {
    onReportSelect(report);
  };

  const deleteReport = (reportId: string) => {
    try {
      setIsDeleting(true);
      
      // Remove report from local state
      setReports(reports.filter(report => report.id !== reportId));
      
      // If the deleted report was selected, clear the selection
      if (selectedReportId === reportId) {
        // Find the next available report to select
        const remainingReports = reports.filter(report => report.id !== reportId);
        if (remainingReports.length > 0) {
          onReportSelect(remainingReports[0]);
        } else {
          onReportSelect(null as any); // No reports left
        }
      }
      
      setShowDeleteConfirm(null);
    } catch (err) {
      setError('Error deleting report: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeleting(false);
    }
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

  // Get reports with version numbers
  const reportsWithVersions = getReportsWithVersions();

  return (
    <div className="p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
      <h2 className="text-xl font-semibold mb-4">Reports</h2>
      
      {isLoading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-md text-red-400 text-sm">
          {error}
        </div>
      ) : reportsWithVersions.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No reports available</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reportsWithVersions.map((report) => (
            <div key={report.id} className="relative group">
              <button
                onClick={() => handleReportSelect(report)}
                className={`text-left w-full p-3 rounded-md transition-colors ${
                  selectedReportId === report.id
                    ? "bg-primary/20 border border-primary/30"
                    : "bg-slate-800/50 border border-slate-700/40 hover:bg-slate-800"
                }`}
              >
                <p className="font-medium">
                  Report {formatDate(report.createdAt)} {report.versionNumber && report.versionNumber > 1 ? `(Version: ${report.versionNumber})` : ''}
                </p>
                <p className="text-xs text-blue-400">
                  {formatTime(report.createdAt)}
                </p>
                <p className="text-xs text-slate-400">
                  {report.articles.length} articles
                </p>
              </button>
              
              {/* Delete button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(report.id);
                }}
                className="absolute right-2 top-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 bg-red-900/20 hover:bg-red-900/40 text-red-400 transition-opacity"
                title="Delete report"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              
              {/* Delete confirmation */}
              {showDeleteConfirm === report.id && (
                <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-slate-800/90 rounded-md z-10">
                  <div className="p-3 flex flex-col gap-2">
                    <p className="text-sm text-red-300">Delete this report?</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteReport(report.id);
                        }}
                        disabled={isDeleting}
                        className="text-xs px-3 py-1 rounded bg-red-900/60 hover:bg-red-800 text-white"
                      >
                        {isDeleting ? "Deleting..." : "Yes, Delete"}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(null);
                        }}
                        className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}