import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ReportsManager } from "@/components/news-capsule/reports-manager";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { X as XIcon, GripVerticalIcon, EditIcon, SaveIcon, PlusIcon } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { serverUrl } from "@/utils/server-url";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csfrHeaderObject } from "@/utils/csrf-header";
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
import { use } from "passport";

interface ReportWithArticles extends Report {
  articles: CapsuleArticle[];
}

export default function Reports() {
  const fetchWithTokens = useFetch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<ReportWithArticles | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [executiveNotes, setExecutiveNotes] = useState<Record<string, string>>({});
  const [showAddNote, setShowAddNote] = useState<string | null>(null);
  
  // Mobile responsive state - matching research page structure
  const [showReportLibrary, setShowReportLibrary] = useState(false);
  const [isViewportMobile, setIsViewportMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Responsive viewport detection - matching research page
  useEffect(() => {
    const checkViewport = () => {
      const isMobile = window.innerWidth < 1024;
      setIsViewportMobile(isMobile);
      if (isMobile) {
        setIsSidebarCollapsed(false); // Always expanded on mobile
      }
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);
  
  // Dialog state for confirmations
  const [showDeleteReportDialog, setShowDeleteReportDialog] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ReportWithArticles | null>(null);
  const [showRemoveArticleDialog, setShowRemoveArticleDialog] = useState(false);
  const [articleToRemove, setArticleToRemove] = useState<{ reportId: string; articleId: string; articleTitle: string; isLastArticle?: boolean } | null>(null);
  const [checkReportFromDashboard, setCheckReportFromDashboard] = useState(false)



  // Fetch reports from database
  const { data: reports = [], isLoading: reportsLoading } = useQuery<ReportWithArticles[]>({
    queryKey: ["/api/news-capsule/reports"],
    queryFn: async () => {
      const response = await fetchWithTokens(`/api/news-capsule/reports`, {
        method: "GET",
      });
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
  });

  setTimeout(()=> setCheckReportFromDashboard(true), 10)
  console.log(selectedReport)
  useEffect(()=>{
    const reportFromDashboard = sessionStorage.getItem('selectedCapsuleReport')
    if (!reportFromDashboard || !checkReportFromDashboard) return
    try {
      window.scrollTo(0,0)
      const report = JSON.parse(reportFromDashboard)
      console.log("Report in sessionStorage", report)
      setSelectedReport(report)
    } catch (error) {
      console.error(error)
    } finally {
      sessionStorage.removeItem('selectedCapsuleReport')
      setCheckReportFromDashboard(false)
    }
  },[checkReportFromDashboard])

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetchWithTokens(`/api/news-capsule/reports/${reportId}`, {
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
    //loadExecutiveNotes(report.id);
    
    // Close mobile library overlay when report is selected
    if (isViewportMobile) {
      setShowReportLibrary(false);
    }
  };

  // Load executive notes for the selected report
  const loadExecutiveNotes = async (reportId: string) => {
    try {
      const response = await fetchWithTokens(`/api/news-capsule/executive-notes/${reportId}`, {
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
      const response = await fetchWithTokens('/api/news-capsule/executive-notes', {
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
      const response = await fetchWithTokens(`/api/news-capsule/reports/${reportId}/articles/${articleId}`, {
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
    link.download = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* Mobile Floating Action Button - positioned to match research page */}
      {isViewportMobile && (
        <button
          onClick={() => setShowReportLibrary(true)}
          className="fixed bottom-4 right-[170px] sm:bottom-6 sm:right-[170px] z-[55] w-14 h-14 bg-[#00FFFF]/80 backdrop-blur-sm border border-[#00FFFF]/50 hover:bg-[#BF00FF] text-black hover:text-white rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {reports.length > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-[#BF00FF] text-white text-xs font-bold rounded-full flex items-center justify-center">
              {reports.length}
            </span>
          )}
        </button>
      )}

      <div className="flex flex-col gap-2 px-4 lg:px-0">
        <h1 className="text-xl sm:text-2xl font-bold">Executive Reports</h1>
        <p className="text-sm sm:text-base text-slate-300">
          View and manage compiled reports for executive review.
        </p>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0 flex-1 px-4 lg:px-0">
        {/* Report Library - Adaptive Sidebar matching research page */}
        <div className="relative transition-all duration-300 ease-in-out bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden order-first lg:order-last w-full lg:w-80 lg:flex-shrink-0">
          {/* Report Count Header */}
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">Report Library</h3>
              <span className="text-[#00FFFF] font-semibold text-lg">
                {reports.length}
              </span>
            </div>
          </div>

          <div className="min-h-[400px] lg:h-full overflow-y-auto p-4 sm:p-5">
            <ReportsManager 
              reports={reports}
              onReportSelect={handleReportSelect}
              onDeleteReport={(reportId) => {
                const report = reports.find(r => r.id === reportId);
                if (report) confirmDeleteReport(report);
              }}
              selectedReportId={selectedReport?.id}
              isLoading={reportsLoading}
              isDeleting={deleteReportMutation.isPending}
            />
          </div>
        </div>
        
        {/* Executive Report Content - Flexible Width matching research page */}
        <div className={`w-full transition-all duration-300 ease-in-out bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden ${
          isViewportMobile ? 'lg:flex-1' : isSidebarCollapsed ? 'lg:flex-[2]' : 'lg:flex-1'
        }`}>
          <div className="min-h-[300px] lg:h-full overflow-y-auto p-4 sm:p-5">
            {reportsLoading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
                <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 text-sm">Loading report...</p>
              </div>
            ) : selectedReport ? (
            <div>
              <div className={`flex ${isViewportMobile ? 'flex-col gap-4' : 'justify-between items-center'} mb-6`}>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">
                    Executive Report: {formatDate(selectedReport.createdAt)}
                  </h2>
                  {selectedReport.topic && (
                    <p className="text-slate-300 text-sm mt-1">
                      <span className="font-medium">Report Topic:</span> {selectedReport.topic}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <button
                    className="px-4 py-3 text-sm bg-blue-700 hover:bg-blue-600 rounded-md flex items-center gap-2 min-h-[44px] touch-manipulation"
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                  >
                    Exports
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showExportDropdown && (
                    <div className={`absolute ${isViewportMobile ? 'right-0 left-0' : 'right-0'} mt-2 ${isViewportMobile ? 'w-full' : 'w-48'} bg-slate-800 border border-slate-700 rounded-md shadow-lg z-20`}>
                      <button
                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-700 rounded-t-md rounded-b-none min-h-[44px] touch-manipulation"
                        onClick={async () => {
                          setShowExportDropdown(false);
                          try {
                            // Create document sections
                            const sections = [];
                            
                            // Header
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
                                    text: `Executive Report: ${formatDate(selectedReport.createdAt)}`,
                                    font: "Cambria",
                                    size: 22
                                  })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 120 }
                              })
                            );
                            
                            // Topic if present
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
                            
                            // Articles
                            selectedReport.articles.forEach((article, index) => {
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.title,
                                      font: "Cambria",
                                      size: 22,
                                      bold: true
                                    })
                                  ],
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
                                      size: 22,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.threatName,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
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
                                      size: 22,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.vulnerabilityId,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
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
                                      size: 22,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.targetOS,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
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
                                      size: 22,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.sourcePublication,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
                                  spacing: { after: 120 }
                                })
                              );
                              
                              // Summary
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Summary:",
                                      font: "Cambria",
                                      size: 22,
                                      bold: true
                                    })
                                  ],
                                  spacing: { after: 60 }
                                })
                              );
                              
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.summary,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
                                  spacing: { after: 120 }
                                })
                              );
                              
                              // Impacts
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Impacts:",
                                      font: "Cambria",
                                      size: 22,
                                      bold: true
                                    })
                                  ],
                                  spacing: { after: 60 }
                                })
                              );
                              
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.impacts,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
                                  spacing: { after: 120 }
                                })
                              );
                              
                              // Attack Vector
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Attack Vector:",
                                      font: "Cambria",
                                      size: 22,
                                      bold: true
                                    })
                                  ],
                                  spacing: { after: 60 }
                                })
                              );
                              
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: article.attackVector,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
                                  spacing: { after: 120 }
                                })
                              );
                              
                              // Executive Note if exists
                              if (executiveNotes[article.id]) {
                                sections.push(
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: "Executive Note:",
                                        font: "Cambria",
                                        size: 22,
                                        bold: true
                                      })
                                    ],
                                    spacing: { after: 60 }
                                  })
                                );
                                
                                sections.push(
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: executiveNotes[article.id],
                                        font: "Cambria",
                                        size: 22
                                      })
                                    ],
                                    spacing: { after: 120 }
                                  })
                                );
                              }
                              
                              // Original URL
                              sections.push(
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: "Original URL: ",
                                      font: "Cambria",
                                      size: 22,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: article.originalUrl,
                                      font: "Cambria",
                                      size: 22
                                    })
                                  ],
                                  spacing: { after: 360 }
                                })
                              );
                            });
                            
                            // Create document
                            const doc = new Document({
                              sections: [
                                {
                                  properties: {},
                                  children: sections
                                }
                              ]
                            });
                            
                            // Generate and download
                            const blob = await Packer.toBlob(doc);
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}.docx`;
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
                      >
                        Export to Word
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 rounded-none"
                        onClick={async () => {
                          setShowExportDropdown(false);
                          try {
                            // Create a new window with the report content
                            const printWindow = window.open('', '_blank', 'width=800,height=600');
                            if (!printWindow) {
                              toast({
                                variant: "destructive",
                                title: "Print Error",
                                description: "Could not open print window. Please check your browser's popup settings.",
                              });
                              return;
                            }

                            // Generate clean HTML content for printing
                            let printContent = `
                              <!DOCTYPE html>
                              <html>
                              <head>
                                <meta charset="utf-8">
                                <title>RisqAI News Capsule Reporting</title>
                                <style>
                                  @page {
                                    size: letter;
                                    margin: 1in;
                                  }
                                  
                                  body {
                                    font-family: Cambria, "Times New Roman", serif;
                                    font-size: 11pt;
                                    line-height: 1.4;
                                    color: black;
                                    background: white;
                                    margin: 0;
                                    padding: 20px;
                                    max-width: 100%;
                                  }
                                  
                                  h1 {
                                    text-align: center;
                                    font-size: 18pt;
                                    font-weight: bold;
                                    margin-bottom: 24pt;
                                    page-break-after: avoid;
                                  }
                                  
                                  h2 {
                                    font-size: 14pt;
                                    font-weight: bold;
                                    margin: 18pt 0 12pt 0;
                                    page-break-after: avoid;
                                  }
                                  
                                  h3 {
                                    font-size: 12pt;
                                    font-weight: bold;
                                    margin: 12pt 0 8pt 0;
                                    page-break-after: avoid;
                                  }
                                  
                                  .article {
                                    margin-bottom: 32pt;
                                    page-break-inside: avoid;
                                    border-bottom: 1px solid #ccc;
                                    padding-bottom: 16pt;
                                  }
                                  
                                  .article:last-child {
                                    border-bottom: none;
                                  }
                                  
                                  .article-header {
                                    margin-bottom: 12pt;
                                  }
                                  
                                  .metadata {
                                    display: grid;
                                    grid-template-columns: 1fr 1fr;
                                    gap: 8pt;
                                    margin-bottom: 12pt;
                                  }
                                  
                                  .metadata-item {
                                    margin-bottom: 6pt;
                                  }
                                  
                                  .metadata-label {
                                    font-weight: bold;
                                    color: #333;
                                  }
                                  
                                  .section {
                                    margin-bottom: 12pt;
                                  }
                                  
                                  .section-title {
                                    font-weight: bold;
                                    margin-bottom: 4pt;
                                    color: #333;
                                  }
                                  
                                  .section-content {
                                    text-align: justify;
                                    line-height: 1.5;
                                  }
                                  
                                  .executive-note {
                                    background-color: #f5f5f5;
                                    border-left: 4pt solid #007bff;
                                    padding: 8pt;
                                    margin: 8pt 0;
                                  }
                                  
                                  .url {
                                    font-size: 9pt;
                                    color: #666;
                                    word-break: break-all;
                                  }
                                  
                                  @media print {
                                    body {
                                      font-size: 10pt;
                                    }
                                    
                                    .article {
                                      page-break-inside: avoid;
                                    }
                                  }
                                </style>
                              </head>
                              <body>
                                <h1>RisqAI News Capsule Reporting</h1>
                                <h2>Executive Report: ${formatDate(selectedReport.createdAt)}</h2>
                            `;

                            if (selectedReport.topic) {
                              printContent += `<p><strong>Report Topic:</strong> ${selectedReport.topic}</p>`;
                            }

                            selectedReport.articles.forEach((article, index) => {
                              printContent += `
                                <div class="article">
                                  <div class="article-header">
                                    <h3>Article ${index + 1}: ${article.title}</h3>
                                  </div>
                                  
                                  <div class="metadata">
                                    <div class="metadata-item">
                                      <span class="metadata-label">Threat Name:</span> ${article.threatName}
                                    </div>
                                    <div class="metadata-item">
                                      <span class="metadata-label">Vulnerability ID:</span> ${article.vulnerabilityId}
                                    </div>
                                    <div class="metadata-item">
                                      <span class="metadata-label">Target OS:</span> ${article.targetOS}
                                    </div>
                                    <div class="metadata-item">
                                      <span class="metadata-label">Source:</span> ${article.sourcePublication}
                                    </div>
                                  </div>
                                  
                                  <div class="section">
                                    <div class="section-title">Summary:</div>
                                    <div class="section-content">${article.summary}</div>
                                  </div>
                                  
                                  <div class="section">
                                    <div class="section-title">Impacts:</div>
                                    <div class="section-content">${article.impacts}</div>
                                  </div>
                                  
                                  <div class="section">
                                    <div class="section-title">Attack Vector:</div>
                                    <div class="section-content">${article.attackVector}</div>
                                  </div>
                              `;

                              if (executiveNotes[article.id]) {
                                printContent += `
                                  <div class="section">
                                    <div class="section-title">Executive Note:</div>
                                    <div class="executive-note">${executiveNotes[article.id]}</div>
                                  </div>
                                `;
                              }

                              printContent += `
                                  <div class="section">
                                    <div class="section-title">Source URL:</div>
                                    <div class="url">${article.originalUrl}</div>
                                  </div>
                                </div>
                              `;
                            });

                            printContent += `
                              </body>
                              </html>
                            `;

                            // Write content to new window and print
                            printWindow.document.write(printContent);
                            printWindow.document.close();
                            
                            // Wait for content to load then print
                            printWindow.onload = () => {
                              setTimeout(() => {
                                printWindow.print();
                                printWindow.close();
                              }, 500);
                            };
                            
                          } catch (error) {
                            toast({
                              variant: "destructive",
                              title: "Print Error",
                              description: "Error generating print preview. Please try again.",
                            });
                          }
                        }}
                      >
                        Print
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 rounded-none"
                        onClick={async () => {
                          setShowExportDropdown(false);
                          try {
                            // Create a temporary container for PDF generation
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
                                <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 16px;">Executive Report: ${formatDate(selectedReport.createdAt)}</h2>
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
                              
                              if (executiveNotes[article.id]) {
                                htmlContent += `
                                  <div style="margin-bottom: 16px;">
                                    <h4 style="font-weight: bold; margin: 12px 0 8px 0; color: #444; font-size: 11pt;">Executive Note:</h4>
                                    <p style="margin-bottom: 12px; line-height: 1.5; background-color: #e3f2fd; padding: 12px; border-left: 4px solid #1976d2; text-align: justify;">${executiveNotes[article.id]}</p>
                                  </div>
                                `;
                              }
                              
                              htmlContent += `
                                  <div style="border-top: 1px solid #ccc; padding-top: 8px; margin-top: 16px;">
                                    <p style="margin-bottom: 0; font-size: 9pt; color: #888;"><strong>Source URL:</strong> ${article.originalUrl}</p>
                                  </div>
                                </div>`;
                            });
                            
                            htmlContent += '</div>';
                            container.innerHTML = htmlContent;
                            document.body.appendChild(container);
                            
                            // Generate PDF using html2canvas and jsPDF
                            const canvas = await html2canvas(container, {
                              scale: 2,
                              useCORS: true,
                              backgroundColor: '#ffffff'
                            });
                            
                            const pdf = new jsPDF('p', 'mm', 'a4');
                            const pageWidth = 210; // A4 width in mm
                            const pageHeight = 297; // A4 height in mm
                            const margins = { top: 25, bottom: 25, left: 20, right: 20 }; // 1 inch = 25.4mm
                            const contentWidth = pageWidth - margins.left - margins.right;
                            const contentHeight = pageHeight - margins.top - margins.bottom;
                            
                            const imgWidth = contentWidth;
                            const imgHeight = (canvas.height * imgWidth) / canvas.width;
                            let heightLeft = imgHeight;
                            let position = 0;
                            
                            // Add first page with margins
                            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margins.left, margins.top + position, imgWidth, imgHeight);
                            heightLeft -= contentHeight;
                            
                            while (heightLeft >= 0) {
                              position = heightLeft - imgHeight;
                              pdf.addPage();
                              pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margins.left, margins.top + position, imgWidth, imgHeight);
                              heightLeft -= contentHeight;
                            }
                            
                            // Download the PDF
                            pdf.save(`Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}.pdf`);
                            
                            // Clean up
                            document.body.removeChild(container);
                            
                          } catch (error) {
                            toast({
                              variant: "destructive",
                              title: "Export Error",
                              description: "Error creating PDF. Please try again.",
                            });
                          }
                        }}
                      >
                        Export to PDF
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 rounded-none"
                        onClick={() => {
                          setShowExportDropdown(false);
                          // Generate text content
                          let textContent = "RisqAI News Capsule Reporting\n";
                          textContent += "=".repeat(50) + "\n\n";
                          
                          textContent += `Executive Report: ${formatDate(selectedReport.createdAt)}\n\n`;
                          
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
                            
                            // Add executive note if exists
                            if (executiveNotes[article.id]) {
                              textContent += "Executive Note:\n";
                              textContent += executiveNotes[article.id] + "\n\n";
                            }
                            
                            textContent += `Original URL: ${article.originalUrl}\n\n`;
                            textContent += "-".repeat(50) + "\n\n";
                          });
                          
                          // Create and download text file
                          const blob = new Blob([textContent], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        Export as Text
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 rounded-t-none rounded-b-md"
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
                      className={`relative pb-6 mb-6 ${index < selectedReport.articles.length - 1 ? 'border-b border-slate-700/30' : ''}`}
                    >
                      <div className={`flex ${isViewportMobile ? 'flex-col gap-3' : 'items-start gap-3'} mb-4`}>
                        <h3 className="text-base sm:text-lg font-medium flex-1 leading-tight">{article.title}</h3>
                        <button
                          onClick={() => confirmRemoveArticleFromReport(article.id)}
                          className={`${isViewportMobile ? 'self-end' : ''} p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-full transition-colors min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center`}
                          title="Remove article from report"
                        >
                          <XIcon className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className={`grid ${isViewportMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3 sm:gap-4`}>
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
                  <strong>Report from {formatDate(reportToDelete.createdAt)}</strong>
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

      {/* Mobile Report Library Overlay - matching research page pattern */}
      <AnimatePresence>
        {showReportLibrary && isViewportMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30"
            onClick={() => setShowReportLibrary(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 500 }}
              className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700/50 rounded-t-2xl max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Report Library ({reports.length})</h3>
                <button
                  onClick={() => setShowReportLibrary(false)}
                  className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg touch-manipulation transition-colors"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                <ReportsManager 
                  reports={reports}
                  onReportSelect={handleReportSelect}
                  onDeleteReport={(reportId) => {
                    const report = reports.find(r => r.id === reportId);
                    if (report) confirmDeleteReport(report);
                  }}
                  selectedReportId={selectedReport?.id}
                  isLoading={reportsLoading}
                  isDeleting={deleteReportMutation.isPending}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
