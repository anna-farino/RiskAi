import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Report, ReportsManager } from "@/components/news-capsule/reports-manager";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [draggedArticle, setDraggedArticle] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
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

  // Export to JSON function
  const exportToJSON = () => {
    if (!selectedReport) return;
    
    const jsonData = {
      report: {
        id: selectedReport.id,
        createdAt: selectedReport.createdAt,
        versionNumber: selectedReport.versionNumber,
        topic: selectedReport.topic,
        articles: selectedReport.articles.map(article => ({
          id: article.id,
          title: article.title,
          threatName: article.threatName,
          vulnerabilityId: article.vulnerabilityId,
          summary: article.summary,
          impacts: article.impacts,
          attackVector: article.attackVector,
          microsoftConnection: article.microsoftConnection,
          sourcePublication: article.sourcePublication,
          originalUrl: article.originalUrl,
          targetOS: article.targetOS,
          createdAt: article.createdAt
        }))
      }
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}${selectedReport.versionNumber && selectedReport.versionNumber > 1 ? `_v${selectedReport.versionNumber}` : ''}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Executive Reports</h1>
        <p className="text-slate-300">
          View and manage compiled reports for executive review.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Reports List */}
        <div className="md:col-span-1">
          <ReportsManager 
            onReportSelect={handleReportSelect}
            selectedReportId={selectedReport?.id}
          />
        </div>
        
        {/* Report Details */}
        <div className="md:col-span-4 p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
          {selectedReport ? (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold">
                    Executive Report: {formatDate(selectedReport.createdAt)}
                    {selectedReport.versionNumber && selectedReport.versionNumber > 1 && 
                      <span className="ml-2 text-blue-400 text-sm">(Version: {selectedReport.versionNumber})</span>
                    }
                  </h2>
                  {selectedReport.topic && (
                    <p className="text-slate-300 text-sm mt-1">
                      <span className="font-medium">Report Topic:</span> {selectedReport.topic}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <button
                    className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-600 rounded-md flex items-center gap-2"
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                  >
                    Exports
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showExportDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-10">
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 rounded-t-md"
                        onClick={() => {
                          setShowExportDropdown(false);
                          // Export to Word functionality would go here
                          console.log("Export to Word clicked");
                        }}
                      >
                        Export to Word
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700"
                        onClick={() => {
                          setShowExportDropdown(false);
                          window.print();
                        }}
                      >
                        Print
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700"
                        onClick={() => {
                          setShowExportDropdown(false);
                          // Export as Text functionality would go here
                          console.log("Export as Text clicked");
                        }}
                      >
                        Export as Text
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 rounded-b-md"
                        onClick={() => {
                          setShowExportDropdown(false);
                          exportToJSON();
                        }}
                      >
                        Export to JSON
                      </button>
                    </div>
                  )}
                </div>
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
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-slate-800/50 border border-slate-700/40 rounded-lg"
                    >
                      <h3 className="text-lg font-medium mb-3">{article.title}</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Threat Name</p>
                          <p className="text-sm">{article.threatName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Vulnerability ID</p>
                          <p className="text-sm">{article.vulnerabilityId}</p>
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
                      
                      <div className="mt-4 space-y-3">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Summary</p>
                          <p className="text-sm leading-relaxed">{article.summary}</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Impacts</p>
                          <p className="text-sm leading-relaxed">{article.impacts}</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Attack Vector</p>
                          <p className="text-sm leading-relaxed">{article.attackVector}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-400">
              <p>Select a report to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}