import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import type { Report } from "@shared/db/schema/reports";
import type { CapsuleArticle } from "@shared/db/schema/news-capsule";

interface ReportWithArticles extends Report {
  articles: CapsuleArticle[];
}

interface ReportsManagerProps {
  reports: ReportWithArticles[];
  onReportSelect: (report: ReportWithArticles) => void;
  onDeleteReport: (reportId: string) => void;
  selectedReportId?: string;
  isLoading?: boolean;
  isDeleting?: boolean;
}

export function ReportsManager({ 
  reports, 
  onReportSelect, 
  onDeleteReport, 
  selectedReportId, 
  isLoading = false, 
  isDeleting = false 
}: ReportsManagerProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Auto-select first report if no report is selected
  useEffect(() => {
    if (reports.length > 0 && !selectedReportId) {
      onReportSelect(reports[0]);
    }
  }, [reports, selectedReportId, onReportSelect]);

  const handleReportSelect = (report: ReportWithArticles) => {
    onReportSelect(report);
  };

  const handleDeleteReport = (reportId: string) => {
    onDeleteReport(reportId);
    setShowDeleteConfirm(null);
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
    <div className="flex flex-col gap-2">
      {isLoading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No reports available</p>
      ) : (
        reports.map((report) => (
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
                  Report {formatDate(report.createdAt)} {report.topic ? `- ${report.topic}` : ''}
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
                          handleDeleteReport(report.id);
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
          ))
      )}
    </div>
  );
}