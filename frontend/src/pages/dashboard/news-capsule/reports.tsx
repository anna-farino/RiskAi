import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { formatDateOnly } from "@/utils/date-utils";
import { useParams } from "react-router-dom";

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { X as XIcon, GripVerticalIcon, EditIcon, SaveIcon, PlusIcon, ChevronUp, ChevronDown, BarChart3, FolderOpen, FileText } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetch } from "@/hooks/use-fetch";
import type { Report } from "@shared/db/schema/reports";
import type { CapsuleArticle } from "@shared/db/schema/news-capsule";
import { useToast } from "@/hooks/use-toast";
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


interface ReportWithArticles extends Report {
  articles: CapsuleArticle[];
}

// Helper function to format dates properly
const formatDate = (dateValue: any): string => {
  try {
    // Handle both Date objects and string dates
    if (dateValue instanceof Date) {
      return format(dateValue, "MMM d, yyyy");
    }
    if (typeof dateValue === 'string') {
      // Try parsing as Date first
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, "MMM d, yyyy");
      }
    }
    return formatDateOnly(dateValue, "MMM d, yyyy");
  } catch (error) {
    return "Unknown date";
  }
};

export default function Reports() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fetchWithAuth = useFetch();
  const { reportId: urlReportId } = useParams<{ reportId?: string }>();
  const [selectedReport, setSelectedReport] = useState<ReportWithArticles | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [executiveNotes, setExecutiveNotes] = useState<Record<string, string>>({});
  const [showAddNote, setShowAddNote] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'today' | 'week' | 'ytd'>('all');
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [checkReportFromDashboard, setCheckReportFromDashboard] = useState(false);
  
  // Remove sidebar-related mobile responsive state
  

  // Load reports query
  const { data: reports = [], isLoading: reportsLoading, error: reportsError } = useQuery<ReportWithArticles[]>({
    queryKey: ["/api/news-capsule/reports"],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/news-capsule/reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
  });

  // Filter reports based on selected filter
  const filteredReports = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let filtered;
    switch (reportFilter) {
      case 'today':
        filtered = reports.filter(report => new Date(report.createdAt) >= startOfToday);
        break;
      case 'week':
        filtered = reports.filter(report => new Date(report.createdAt) >= startOfWeek);
        break;
      case 'ytd':
        filtered = reports.filter(report => new Date(report.createdAt) >= startOfYear);
        break;
      case 'all':
      default:
        filtered = reports;
    }

    // If a report is highlighted (from dashboard click), move it to the top of the list
    if (highlightedReportId) {
      const highlightedIndex = filtered.findIndex(r => r.id === highlightedReportId);
      if (highlightedIndex > 0) {
        const reordered = [...filtered];
        const [highlighted] = reordered.splice(highlightedIndex, 1);
        reordered.unshift(highlighted);
        return reordered;
      }
    }

    return filtered;
  }, [reports, reportFilter, highlightedReportId]);

  // Auto-select first report when none selected (but not if we're checking for a dashboard selection)
  useEffect(() => {
    if (filteredReports.length > 0 && !selectedReport && !checkReportFromDashboard) {
      setSelectedReport(filteredReports[0]);
    }
  }, [filteredReports, selectedReport, checkReportFromDashboard]);
  
  // Dialog state for confirmations
  const [showDeleteReportDialog, setShowDeleteReportDialog] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ReportWithArticles | null>(null);
  const [showRemoveArticleDialog, setShowRemoveArticleDialog] = useState(false);
  const [articleToRemove, setArticleToRemove] = useState<{ reportId: string; articleId: string; articleTitle: string; isLastArticle?: boolean } | null>(null);

  // Check for report from URL parameter (dashboard navigation)
  useEffect(() => {
    // If no URL report ID, just finish the check
    if (!urlReportId) {
      if (checkReportFromDashboard) {
        setCheckReportFromDashboard(false);
      }
      return;
    }
    
    if (!checkReportFromDashboard || reports.length === 0) return;
    
    try {
      window.scrollTo(0, 0);
      const report = reports.find(r => String(r.id) === String(urlReportId));
      if (report) {
        console.log('URL report found and selected:', report.id);
        setSelectedReport(report);
        setHighlightedReportId(report.id);
      } else {
        console.warn(`Report with ID ${urlReportId} not found in reports list`);
      }
    } catch (error) {
      console.error('Error selecting URL report:', error);
    } finally {
      setCheckReportFromDashboard(false);
    }
  }, [checkReportFromDashboard, reports, urlReportId]);

  // Initialize dashboard check
  useEffect(() => {
    setTimeout(() => setCheckReportFromDashboard(true), 10);
  }, []);

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetchWithAuth(`/api/news-capsule/reports/${reportId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to delete report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-capsule/reports"] });
    },
    onError: (error, reportId) => {
      // Revert optimistic update on error
      queryClient.setQueryData(["/api/news-capsule/reports"], (oldData: ReportWithArticles[] | undefined) => {
        if (!oldData || !reportToDelete) return oldData;
        // Add the report back to the list
        return [...oldData, reportToDelete];
      });
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete report",
      });
    },
  });

  const handleReportSelect = (report: ReportWithArticles) => {
    setSelectedReport(report);
    // Clear highlight when manually selecting a different report
    if (highlightedReportId && report.id !== highlightedReportId) {
      setHighlightedReportId(null);
    }
  };

  // Load executive notes for the selected report
  const loadExecutiveNotes = async (reportId: string) => {
    try {
      const response = await fetchWithAuth(`/api/news-capsule/executive-notes/${reportId}`, {
        method: 'GET'
      });
      if (response.ok) {
        const data = await response.json();
        const notesMap: Record<string, string> = {};
        data.notes.forEach((note: any) => {
          notesMap[note.articleId] = note.note;
        });
        setExecutiveNotes(notesMap);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load executive notes",
      });
    }
  };

  // Save or update an executive note
  const saveExecutiveNote = async (articleId: string, note: string) => {
    if (!selectedReport) return;

    try {
      const response = await fetchWithAuth('/api/news-capsule/executive-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          reportId: selectedReport.id,
          note
        })
      });

      if (response.ok) {
        setExecutiveNotes(prev => ({ ...prev, [articleId]: note }));
        setEditingNote(null);
        setShowAddNote(null);
        setNoteText('');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save executive note",
      });
    }
  };

  // Start editing a note
  const startEditingNote = (articleId: string) => {
    setEditingNote(articleId);
    setNoteText(executiveNotes[articleId] || '');
  };

  // Cancel editing a note
  const cancelEditingNote = () => {
    setEditingNote(null);
    setShowAddNote(null);
    setNoteText('');
  };

  // Remove article from report mutation
  const removeArticleFromReportMutation = useMutation({
    mutationFn: async ({ reportId, articleId }: { reportId: string; articleId: string }) => {
      const response = await fetchWithAuth(`/api/news-capsule/reports/${reportId}/articles/${articleId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to remove article from report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-capsule/reports"] });
    },
    onError: (error, variables) => {
      // Revert optimistic update on error
      queryClient.setQueryData(["/api/news-capsule/reports"], (oldData: ReportWithArticles[] | undefined) => {
        if (!oldData || !articleToRemove) return oldData;
        
        return oldData.map(report => {
          if (report.id === variables.reportId) {
            // Find the article that was removed and add it back
            const articleToAdd = { id: variables.articleId } as CapsuleArticle; // Simplified, real data would come from articleToRemove
            return {
              ...report,
              articles: [...report.articles, articleToAdd]
            };
          }
          return report;
        });
      });
      
      // Also update selected report if it's the one affected
      if (selectedReport && selectedReport.id === variables.reportId && articleToRemove) {
        const articleToAdd = { id: variables.articleId } as CapsuleArticle;
        setSelectedReport({
          ...selectedReport,
          articles: [...selectedReport.articles, articleToAdd]
        });
      }
      
      toast({
        variant: "destructive",
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to remove article from report",
      });
    },
  });

  // Show confirmation dialog for deleting report
  const confirmDeleteReport = (report: ReportWithArticles) => {
    setReportToDelete(report);
    setShowDeleteReportDialog(true);
  };

  // Handle delete report with optimistic update
  const handleDeleteReport = async () => {
    if (!reportToDelete) return;

    // Perform optimistic update - remove report from list immediately
    queryClient.setQueryData(["/api/news-capsule/reports"], (oldData: ReportWithArticles[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.filter(report => report.id !== reportToDelete.id);
    });

    // Clear selected report if it's the one being deleted
    if (selectedReport?.id === reportToDelete.id) {
      setSelectedReport(null);
    }

    try {
      await deleteReportMutation.mutateAsync(reportToDelete.id);
      setShowDeleteReportDialog(false);
      setReportToDelete(null);
    } catch (error) {
      setShowDeleteReportDialog(false);
      setReportToDelete(null);
    }
  };

  // Show confirmation dialog for removing article from report
  const confirmRemoveArticleFromReport = (articleId: string) => {
    if (!selectedReport) return;
    const article = selectedReport.articles.find(a => a.id === articleId);
    const isLastArticle = selectedReport.articles.length === 1;
    setArticleToRemove({ 
      reportId: selectedReport.id, 
      articleId, 
      articleTitle: article?.title || 'Unknown Article',
      isLastArticle 
    });
    setShowRemoveArticleDialog(true);
  };

  // Handle remove article from report with optimistic update
  const handleRemoveArticleFromReport = async () => {
    if (!articleToRemove) return;

    if (articleToRemove.isLastArticle) {
      // If this is the last article, delete the entire report instead
      queryClient.setQueryData(["/api/news-capsule/reports"], (oldData: ReportWithArticles[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(report => report.id !== articleToRemove.reportId);
      });

      // Clear selected report since we're deleting it
      if (selectedReport?.id === articleToRemove.reportId) {
        setSelectedReport(null);
      }

      try {
        await deleteReportMutation.mutateAsync(articleToRemove.reportId);
        setShowRemoveArticleDialog(false);
        setArticleToRemove(null);
      } catch (error) {
        setShowRemoveArticleDialog(false);
        setArticleToRemove(null);
      }
    } else {
      // Normal article removal
      queryClient.setQueryData(["/api/news-capsule/reports"], (oldData: ReportWithArticles[] | undefined) => {
        if (!oldData) return oldData;
        
        return oldData.map(report => {
          if (report.id === articleToRemove.reportId) {
            return {
              ...report,
              articles: report.articles.filter(article => article.id !== articleToRemove.articleId)
            };
          }
          return report;
        });
      });

      // Also update selected report if it's the one affected
      if (selectedReport && selectedReport.id === articleToRemove.reportId) {
        setSelectedReport({
          ...selectedReport,
          articles: selectedReport.articles.filter(article => article.id !== articleToRemove.articleId)
        });
      }

      try {
        await removeArticleFromReportMutation.mutateAsync({ 
          reportId: articleToRemove.reportId, 
          articleId: articleToRemove.articleId 
        });
        setShowRemoveArticleDialog(false);
        setArticleToRemove(null);
      } catch (error) {
        setShowRemoveArticleDialog(false);
        setArticleToRemove(null);
      }
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

  // Export to JSON function
  const exportToJSON = () => {
    if (!selectedReport) return;
    
    const jsonData = {
      report: {
        id: selectedReport.id,
        createdAt: selectedReport.createdAt,
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
          createdAt: article.createdAt,
          executiveNote: executiveNotes[article.id] || null
        }))
      }
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Executive_Report_${String(selectedReport.createdAt).replace(/,|\s/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-6">

      {/* Unified Toolbar Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md -mb-[12px] transition-all duration-300 mx-4 lg:mx-0">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="h-6 w-6 text-purple-400" />
            <span className="text-xl font-semibold text-white">Reports Library and Tools</span>
          </div>

          {/* 3-Column Compact Layout */}
          <div className="grid gap-4 lg:grid-cols-3">
            
            {/* Column 1: Recent Reports */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">Recent Reports</span>
                </div>
                <div className="text-xs text-purple-300">
                  <span>{filteredReports.length} reports</span>
                </div>
              </div>
              
              {/* Recent Reports - 2x2 Grid */}
              <div>
                {filteredReports.length === 0 ? (
                  <div className="text-center py-3 text-slate-400">
                    <p className="text-xs">No reports available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {[...filteredReports]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 4)
                      .map((report) => (
                        <button
                          key={report.id}
                          className={`h-8 px-3 text-xs font-medium rounded border transition-all duration-200 ${
                            selectedReport?.id === report.id
                              ? 'bg-[#9333EA]/20 border-[#9333EA]/50 text-purple-300'
                              : report.id === highlightedReportId
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-slate-800/50 border-slate-600/50 hover:bg-slate-700/50 text-slate-300 hover:text-white'
                          }`}
                          onClick={() => handleReportSelect(report)}
                        >
                          <div className="flex items-center justify-center h-full">
                            <span className="truncate text-center text-xs">
                              {format(new Date(report.createdAt), 'MMM dd h:mm a')}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Quick Actions & Filters */}
            <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Quick Actions</span>
              </div>
              
              {/* 2x2 Grid of Action Buttons */}
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setReportFilter('all')}
                  className={`h-8 px-3 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                    reportFilter === 'all'
                      ? 'bg-[#9333EA]/30 border-[#9333EA]/60 text-white'
                      : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border-purple-500/40'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setReportFilter('today')}
                  className={`h-8 px-3 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                    reportFilter === 'today'
                      ? 'bg-[#9333EA]/30 border-[#9333EA]/60 text-white'
                      : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border-purple-500/40'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setReportFilter('week')}
                  className={`h-8 px-3 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                    reportFilter === 'week'
                      ? 'bg-[#9333EA]/30 border-[#9333EA]/60 text-white'
                      : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border-purple-500/40'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setReportFilter('ytd')}
                  className={`h-8 px-3 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                    reportFilter === 'ytd'
                      ? 'bg-[#9333EA]/30 border-[#9333EA]/60 text-white'
                      : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border-purple-500/40'
                  }`}
                >
                  YTD
                </button>
              </div>
            </div>

            {/* Column 3: Export Actions */}
            <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Export Report</span>
              </div>
              
              {selectedReport ? (
                <>
                  {/* Export Buttons - 2x2 Grid */}
                  <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={async () => {
                          try {
                            const container = document.createElement('div');
                            container.style.position = 'absolute';
                            container.style.left = '-9999px';
                            container.style.top = '0';
                            container.style.width = '7in';
                            container.style.background = 'white';
                            container.style.fontFamily = 'Cambria, serif';
                            container.style.fontSize = '11pt';
                            container.style.lineHeight = '1.3';
                            container.style.color = 'black';
                            container.style.padding = '20px';
                            
                            let htmlContent = `
                              <div style="font-family: Cambria, serif; font-size: 11pt; line-height: 1.3; color: black; max-width: 100%;">
                                <h1 style="text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 24px;">RisqAI News Capsule Reporting</h1>
                                <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 16px;">Executive Report: ${String(selectedReport.createdAt)}</h2>
                            `;
                            
                            if (selectedReport.topic) {
                              htmlContent += `<p style="margin-bottom: 16px;"><strong>Report Topic:</strong> ${selectedReport.topic}</p>`;
                            }
                            
                            selectedReport.articles.forEach((article, index) => {
                              htmlContent += `
                                <div style="page-break-inside: avoid; page-break-before: ${index > 0 ? 'auto' : 'avoid'}; margin-bottom: 32px; border: 1px solid #e0e0e0; padding: 20px; background-color: #fafafa;">
                                  <h3 style="font-size: 13pt; font-weight: bold; margin-bottom: 16px; color: #222; border-bottom: 2px solid #007bff; padding-bottom: 8px;">Article ${index + 1}: ${article.title}</h3>
                                  
                                  <div style="margin-bottom: 16px;">
                                    <p style="margin-bottom: 6px; font-size: 10pt;"><strong>Threat Name:</strong> ${article.threatName}</p>
                                    <p style="margin-bottom: 6px; font-size: 10pt;"><strong>Vulnerability ID:</strong> ${article.vulnerabilityId}</p>
                                    <p style="margin-bottom: 6px; font-size: 10pt;"><strong>Target OS:</strong> ${article.targetOS}</p>
                                    <p style="margin-bottom: 6px; font-size: 10pt;"><strong>Source:</strong> ${article.sourcePublication}</p>
                                  </div>
                                  
                                  <div style="margin-bottom: 16px;">
                                    <h4 style="font-weight: bold; margin: 12px 0 8px 0; color: #444; font-size: 11pt;">Summary:</h4>
                                    <p style="margin-bottom: 12px; line-height: 1.5; text-align: justify;">${article.summary}</p>
                                  </div>
                                  
                                  <div style="margin-bottom: 16px;">
                                    <h4 style="font-weight: bold; margin: 12px 0 8px 0; color: #444; font-size: 11pt;">Impacts:</h4>
                                    <p style="margin-bottom: 12px; line-height: 1.5; text-align: justify;">${article.impacts}</p>
                                  </div>
                                  
                                  <div style="margin-bottom: 16px;">
                                    <h4 style="font-weight: bold; margin: 12px 0 8px 0; color: #444; font-size: 11pt;">Attack Vector:</h4>
                                    <p style="margin-bottom: 12px; line-height: 1.5; text-align: justify;">${article.attackVector}</p>
                                  </div>
                              `;              
                              htmlContent += `
                                  <div style="border-top: 1px solid #ccc; padding-top: 8px; margin-top: 16px;">
                                    <p style="margin-bottom: 0; font-size: 9pt; color: #888;"><strong>Source URL:</strong> ${article.originalUrl}</p>
                                  </div>
                                </div>`;
                            });
                            
                            htmlContent += '</div>';
                            container.innerHTML = htmlContent;
                            document.body.appendChild(container);
                            
                            const canvas = await html2canvas(container, {
                              scale: 2,
                              useCORS: true,
                              backgroundColor: '#ffffff'
                            });
                            
                            const pdf = new jsPDF('p', 'mm', 'a4');
                            const pageWidth = 210;
                            const pageHeight = 297;
                            const margins = { top: 25, bottom: 25, left: 20, right: 20 };
                            const contentWidth = pageWidth - margins.left - margins.right;
                            const contentHeight = pageHeight - margins.top - margins.bottom;
                            
                            const imgWidth = contentWidth;
                            const imgHeight = (canvas.height * imgWidth) / canvas.width;
                            let heightLeft = imgHeight;
                            let position = 0;
                            
                            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margins.left, margins.top + position, imgWidth, imgHeight);
                            heightLeft -= contentHeight;
                            
                            while (heightLeft >= 0) {
                              position = heightLeft - imgHeight;
                              pdf.addPage();
                              pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margins.left, margins.top + position, imgWidth, imgHeight);
                              heightLeft -= contentHeight;
                            }
                            
                            pdf.save(`Executive_Report_${String(selectedReport.createdAt).replace(/,|\s/g, '_')}.pdf`);
                            document.body.removeChild(container);
                            
                          } catch (error) {
                            toast({
                              variant: "destructive",
                              title: "Export Error",
                              description: "Error creating PDF. Please try again.",
                            });
                          }
                        }}
                        className="flex-1 h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors flex items-center justify-center"
                      >
                        PDF
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const sections = [];
                            
                            sections.push(
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: "RisqAI News Capsule Reporting",
                                    font: "Cambria",
                                    size: 28,
                                    bold: true,
                                    color: "000000"
                                  })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 240 }
                              })
                            );
                            
                            sections.push(
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: `Executive Report: ${String(selectedReport.createdAt)}`,
                                    font: "Cambria",
                                    size: 22
                                  })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 120 }
                              })
                            );
                            
                            if (selectedReport.topic) {
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Report Topic: ",
                                      font: "Cambria",
                                      size: 22,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: selectedReport.topic,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
                                  alignment: AlignmentType.CENTER,
                                  spacing: { after: 120 }
                                })
                              );
                            }
                            
                            selectedReport.articles.forEach((article, index) => {
                              // Article Title
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.title,
                                      font: "Cambria",
                                      size: 24,
                                      bold: true
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 120 }
                                })
                              );
                              
                              // Threat Name
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Threat Name: ",
                                      font: "Cambria",
                                      size: 20,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.threatName,
                                      font: "Cambria",
                                      size: 20
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 60 }
                                })
                              );
                              
                              // Vulnerability ID
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Vulnerability ID: ",
                                      font: "Cambria",
                                      size: 20,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.vulnerabilityId,
                                      font: "Cambria",
                                      size: 20
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 60 }
                                })
                              );
                              
                              // Target OS
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Target OS: ",
                                      font: "Cambria",
                                      size: 20,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.targetOS,
                                      font: "Cambria",
                                      size: 20
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 60 }
                                })
                              );
                              
                              // Source Publication
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Source: ",
                                      font: "Cambria",
                                      size: 20,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.sourcePublication,
                                      font: "Cambria",
                                      size: 20
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 120 }
                                })
                              );
                              
                              // Summary Section
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Summary:",
                                      font: "Cambria",
                                      size: 20,
                                      bold: true
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 40 }
                                })
                              );
                              
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.summary,
                                      font: "Cambria",
                                      size: 20
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 100 }
                                })
                              );
                              
                              // Impacts Section
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Impacts:",
                                      font: "Cambria",
                                      size: 20,
                                      bold: true
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 40 }
                                })
                              );
                              
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.impacts,
                                      font: "Cambria",
                                      size: 20
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 100 }
                                })
                              );
                              
                              // Attack Vector Section
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Attack Vector:",
                                      font: "Cambria",
                                      size: 20,
                                      bold: true
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 40 }
                                })
                              );
                              
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.attackVector,
                                      font: "Cambria",
                                      size: 20
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 100 }
                                })
                              );
                              
                              // Executive Note Section (conditional)
                              if (executiveNotes[article.id]) {
                                sections.push(
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: "Executive Note:",
                                        font: "Cambria",
                                        size: 20,
                                        bold: true
                                      })
                                    ],
                                    alignment: AlignmentType.LEFT,
                                    spacing: { after: 40 }
                                  })
                                );
                                
                                sections.push(
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: executiveNotes[article.id],
                                        font: "Cambria",
                                        size: 20
                                      })
                                    ],
                                    alignment: AlignmentType.LEFT,
                                    spacing: { after: 100 }
                                  })
                                );
                              }
                              
                              // Original URL Section
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Original URL:",
                                      font: "Cambria",
                                      size: 18,
                                      bold: true
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 40 }
                                })
                              );
                              
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.originalUrl,
                                      font: "Cambria",
                                      size: 18
                                    })
                                  ],
                                  alignment: AlignmentType.LEFT,
                                  spacing: { after: 360 }
                                })
                              );
                            });
                            
                            const doc = new Document({
                              sections: [
                                {
                                  properties: {},
                                  children: sections
                                }
                              ]
                            });
                            
                            const blob = await Packer.toBlob(doc);
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `Executive_Report_${String(selectedReport.createdAt).replace(/,|\s/g, '_')}.docx`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (error) {
                            toast({
                              variant: "destructive",
                              title: "Export Error",
                              description: "Error creating Word document. Please try again.",
                            });
                          }
                        }}
                        className="flex-1 h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors flex items-center justify-center"
                      >
                        Word
                      </button>
                      <button
                        onClick={() => {
                          // Generate text content
                          let textContent = "RisqAI News Capsule Reporting\n";
                          textContent += "=".repeat(50) + "\n\n";
                          
                          textContent += `Executive Report: ${String(selectedReport.createdAt)}\n\n`;
                          
                          if (selectedReport.topic) {
                            textContent += `Report Topic: ${selectedReport.topic}\n\n`;
                          }
                          
                          textContent += "Articles:\n";
                          textContent += "-".repeat(30) + "\n\n";
                          
                          selectedReport.articles.forEach((article, index) => {
                            textContent += `Article ${index + 1}: ${article.title}\n`;
                            textContent += "=".repeat(article.title.length + 12) + "\n\n";
                            
                            textContent += `Threat Name: ${article.threatName}\n`;
                            textContent += `Vulnerability ID: ${article.vulnerabilityId}\n`;
                            textContent += `Target OS: ${article.targetOS}\n`;
                            textContent += `Source: ${article.sourcePublication}\n\n`;
                            
                            textContent += "Summary:\n";
                            textContent += article.summary + "\n\n";
                            
                            textContent += "Impacts:\n";
                            textContent += article.impacts + "\n\n";
                            
                            textContent += "Attack Vector:\n";
                            textContent += article.attackVector + "\n\n";
                            
                            if (executiveNotes[article.id]) {
                              textContent += "Executive Note:\n";
                              textContent += executiveNotes[article.id] + "\n\n";
                            }
                            
                            textContent += `Original URL: ${article.originalUrl}\n\n`;
                            textContent += "-".repeat(50) + "\n\n";
                          });
                          
                          const blob = new Blob([textContent], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `Executive_Report_${String(selectedReport.createdAt).replace(/,|\s/g, '_')}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex-1 h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors flex items-center justify-center"
                      >
                        TXT
                      </button>
                      <button
                        onClick={exportToJSON}
                        className="flex-1 h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors flex items-center justify-center"
                      >
                        JSON
                      </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-slate-400">
                  <FileText className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">Select report to export</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Executive Report Content - Full Width */}
      <div className="w-full bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-md overflow-hidden mx-4 lg:mx-0">
          <div className="min-h-[300px] lg:h-full overflow-y-auto p-4 sm:p-5">
            {reportsLoading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
                <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 text-sm">Loading report...</p>
              </div>
            ) : selectedReport ? (
            <div>
              <div className="mb-6">
                <h2 className="text-lg sm:text-xl font-semibold">
                  Executive Report: {format(new Date(selectedReport.createdAt), 'MMM dd, yyyy • h:mm a')}
                </h2>
                {selectedReport.topic && (
                  <p className="text-slate-300 text-sm mt-1">
                    <span className="font-medium">Report Topic:</span> {selectedReport.topic}
                  </p>
                )}
              </div>
              
              {selectedReport.articles.length === 0 ? (
                <p className="text-sm text-slate-400 italic">This report contains no articles</p>
              ) : (
                <div>
                  {/* Report Summary - only show if more than one article */}
                  {selectedReport.articles.length > 1 && (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-slate-300">Report Summary</h4>
                          <p className="text-xs text-slate-400 mt-1">{selectedReport.articles.length} articles in this report</p>
                        </div>
                        <button
                          onClick={() => confirmDeleteReport(selectedReport)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white rounded border border-red-500/40 transition-colors"
                        >
                          Delete Report
                        </button>
                      </div>
                      <ol className="grid grid-cols-2 gap-2">
                        {selectedReport.articles.map((article, index) => (
                          <li key={article.id}>
                            <button
                              onClick={() => {
                                const articleElement = document.getElementById(`article-${article.id}`);
                                if (articleElement) {
                                  articleElement.scrollIntoView({ 
                                    behavior: 'smooth',
                                    block: 'start'
                                  });
                                }
                              }}
                              className="w-full text-left text-xs font-normal bg-purple-500/20 hover:bg-purple-500/30 text-white hover:text-white border border-purple-500/40 px-2 py-2 rounded transition-colors truncate block whitespace-nowrap overflow-hidden"
                              title={`${index + 1}. ${article.title}`}
                            >
                              {index + 1}. {article.title}
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {selectedReport.articles.map((article, index) => (
                    <motion.div
                      key={article.id}
                      id={`article-${article.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative pb-6 mb-6 ${index < selectedReport.articles.length - 1 ? 'border-b border-slate-700/30' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
                        <h3 className="text-base sm:text-lg font-medium flex-1 leading-tight">{article.title}</h3>
                        <button
                          onClick={() => confirmRemoveArticleFromReport(article.id)}
                          className="self-end sm:self-start p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Remove article from report"
                        >
                          <XIcon className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

      {/* Delete Report Confirmation Dialog */}
      <AlertDialog 
        open={showDeleteReportDialog} 
        onOpenChange={(open) => {
          if (!open && deleteReportMutation.isPending) {
            return;
          }
          setShowDeleteReportDialog(open);
          if (!open) {
            setReportToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
              {reportToDelete && (
                <div className="mt-2 p-2 bg-slate-800 rounded text-sm">
                  <strong>Report from {String(reportToDelete.createdAt)}</strong>
                  {reportToDelete.topic && <div className="text-slate-400">Topic: {reportToDelete.topic}</div>}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowDeleteReportDialog(false);
                setReportToDelete(null);
              }}
              disabled={deleteReportMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <Button 
              onClick={handleDeleteReport}
              disabled={deleteReportMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteReportMutation.isPending ? (
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

      {/* Remove Article from Report Confirmation Dialog */}
      <AlertDialog 
        open={showRemoveArticleDialog} 
        onOpenChange={(open) => {
          if (!open && removeArticleFromReportMutation.isPending) {
            return;
          }
          setShowRemoveArticleDialog(open);
          if (!open) {
            setArticleToRemove(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {articleToRemove?.isLastArticle ? "Delete Report" : "Remove Article from Report"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {articleToRemove?.isLastArticle ? (
                <>
                  This is the only article in this report. Removing it will delete the entire report. This action cannot be undone.
                  {articleToRemove && (
                    <div className="mt-2 p-2 bg-slate-800 rounded text-sm">
                      <strong>{articleToRemove.articleTitle}</strong>
                      <div className="text-slate-400 text-xs mt-1">
                        This will delete the entire report
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  Are you sure you want to remove this article from the report? This action cannot be undone.
                  {articleToRemove && (
                    <div className="mt-2 p-2 bg-slate-800 rounded text-sm">
                      <strong>{articleToRemove.articleTitle}</strong>
                    </div>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowRemoveArticleDialog(false);
                setArticleToRemove(null);
              }}
              disabled={removeArticleFromReportMutation.isPending || deleteReportMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <Button 
              onClick={handleRemoveArticleFromReport}
              disabled={removeArticleFromReportMutation.isPending || deleteReportMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {(removeArticleFromReportMutation.isPending || deleteReportMutation.isPending) ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {articleToRemove?.isLastArticle ? "Deleting..." : "Removing..."}
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
