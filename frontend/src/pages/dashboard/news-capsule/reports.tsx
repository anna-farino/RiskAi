import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Report, ReportsManager } from "@/components/news-capsule/reports-manager";

interface ArticleNotes {
  [articleId: string]: string;
}

interface ReportNotes {
  [reportId: string]: ArticleNotes;
}

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [articleNotes, setArticleNotes] = useState<ReportNotes>({});
  const [draggedArticle, setDraggedArticle] = useState<string | null>(null);
  
  // Load notes from localStorage on component mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('reportArticleNotes');
    if (savedNotes) {
      try {
        setArticleNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error("Failed to load article notes:", e);
      }
    }
  }, []);

  // Save notes to localStorage whenever they change
  const saveNotesToStorage = (notes: ReportNotes) => {
    try {
      localStorage.setItem('reportArticleNotes', JSON.stringify(notes));
    } catch (e) {
      console.error("Failed to save article notes:", e);
    }
  };

  const updateArticleNote = (reportId: string, articleId: string, note: string) => {
    const updatedNotes = {
      ...articleNotes,
      [reportId]: {
        ...articleNotes[reportId],
        [articleId]: note
      }
    };
    setArticleNotes(updatedNotes);
    saveNotesToStorage(updatedNotes);
  };

  const getArticleNote = (reportId: string, articleId: string): string => {
    return articleNotes[reportId]?.[articleId] || '';
  };

  const cleanPublicationName = (publication: string): string => {
    if (!publication) return '';
    
    // Remove content after common delimiters
    const delimiters = [' - ', ' | ', ': ', ' — ', ' – '];
    let cleaned = publication;
    
    for (const delimiter of delimiters) {
      const index = cleaned.indexOf(delimiter);
      if (index !== -1) {
        cleaned = cleaned.substring(0, index).trim();
      }
    }
    
    return cleaned;
  };

  // Drag and drop functionality
  const reorderArticles = (reportId: string, sourceIndex: number, targetIndex: number) => {
    if (!selectedReport || sourceIndex === targetIndex) return;
    
    try {
      const reorderedArticles = [...selectedReport.articles];
      const [removed] = reorderedArticles.splice(sourceIndex, 1);
      reorderedArticles.splice(targetIndex, 0, removed);
      
      const updatedReport = {
        ...selectedReport,
        articles: reorderedArticles
      };
      
      setSelectedReport(updatedReport);
      
      // Update localStorage
      const savedReports = localStorage.getItem('newsCapsuleReports');
      if (savedReports) {
        const reports = JSON.parse(savedReports);
        const reportIndex = reports.findIndex((r: any) => r.id === reportId);
        if (reportIndex !== -1) {
          reports[reportIndex] = updatedReport;
          localStorage.setItem('newsCapsuleReports', JSON.stringify(reports));
        }
      }
    } catch (e) {
      console.error("Failed to save reordered articles:", e);
    }
  };

  const handleDragStart = (e: React.DragEvent, articleId: string) => {
    setDraggedArticle(articleId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', articleId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDraggedArticle(null);
  };

  const handleDrop = (e: React.DragEvent, targetArticleId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    
    if (draggedId && draggedId !== targetArticleId && selectedReport) {
      const sourceIndex = selectedReport.articles.findIndex(a => a.id === draggedId);
      const targetIndex = selectedReport.articles.findIndex(a => a.id === targetArticleId);
      
      if (sourceIndex !== -1 && targetIndex !== -1) {
        reorderArticles(selectedReport.id, sourceIndex, targetIndex);
      }
    }
    setDraggedArticle(null);
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const handleReportSelect = (report: Report) => {
    setSelectedReport(report);
  };

  return (
    <div className="space-y-6">
      <div>
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
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 text-sm bg-blue-700 hover:bg-blue-600 rounded-md"
                    onClick={() => {
                      const versionText = selectedReport.versionNumber && selectedReport.versionNumber > 1 ? 
                        ` (Version: ${selectedReport.versionNumber})` : '';
                      
                      let htmlContent = `
                        <html>
                        <head>
                          <meta charset="utf-8">
                          <title>Executive Report</title>
                          <style>
                            body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 1in; }
                            h1 { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 24pt; }
                            h2 { text-align: center; font-size: 14pt; margin-bottom: 18pt; }
                            h3 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; }
                            .field { margin-bottom: 6pt; }
                            .field-label { font-weight: bold; }
                            .section { margin-bottom: 18pt; }
                            .article { margin-bottom: 36pt; border-bottom: 1px solid #ccc; padding-bottom: 18pt; }
                          </style>
                        </head>
                        <body>
                          <h1>RisqAI News Capsule Reporting</h1>
                          <h2>Executive Report: ${formatDate(selectedReport.createdAt)}${versionText}</h2>
                          <p style="text-align: center; margin-bottom: 36pt;">Generated on: ${new Date().toLocaleDateString()}</p>
                      `;
                      
                      selectedReport.articles.forEach((article) => {
                        const execNotes = getArticleNote(selectedReport.id, article.id);
                        
                        htmlContent += `
                          <div class="article">
                            <h3>${article.title}</h3>
                            <div class="field"><span class="field-label">Threat Name:</span> ${article.threatName}</div>
                            <div class="field"><span class="field-label">Vulnerability ID:</span> ${article.vulnerabilityId}</div>
                            <div class="field"><span class="field-label">Attack Vector:</span> ${article.attackVector}</div>
                            <div class="field"><span class="field-label">Target OS:</span> ${article.targetOS}</div>
                            ${execNotes.trim() ? `<div class="field"><span class="field-label">Executive Notes:</span> ${execNotes}</div>` : ''}
                            <div class="field"><span class="field-label">Source:</span> ${cleanPublicationName(article.sourcePublication)}</div>
                            
                            <div class="section">
                              <div class="field-label">Summary:</div>
                              <p>${article.summary}</p>
                            </div>
                            
                            <div class="section">
                              <div class="field-label">Impacts:</div>
                              <p>${article.impacts}</p>
                            </div>
                            
                            <div class="field"><span class="field-label">Original URL:</span> ${article.originalUrl}</div>
                          </div>
                        `;
                      });
                      
                      htmlContent += `
                          <p style="text-align: center; margin-top: 36pt; font-style: italic;">Report Generated by RisqAI News Capsule</p>
                        </body>
                        </html>
                      `;
                      
                      // Create Word DOCX document with proper MIME type and encoding
                      const blob = new Blob(['\ufeff', htmlContent], { 
                        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
                      });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/[^a-z0-9]/gi, '_')}${selectedReport.versionNumber && selectedReport.versionNumber > 1 ? `_v${selectedReport.versionNumber}` : ''}.docx`;
                      link.style.display = 'none';
                      document.body.appendChild(link);
                      link.click();
                      
                      // Clean up
                      setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }, 100);
                    }}
                  >
                    Export to Word
                  </button>
                  
                  <button
                    className="px-3 py-1 text-sm bg-green-700 hover:bg-green-600 rounded-md"
                    onClick={() => {
                      // Print function
                      const versionText = selectedReport.versionNumber && selectedReport.versionNumber > 1 ? 
                        ` (Version: ${selectedReport.versionNumber})` : '';
                      
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        let printContent = `
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <title>Executive Report - ${formatDate(selectedReport.createdAt)}</title>
                            <style>
                              body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 0.5in; }
                              h1 { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 20pt; }
                              h2 { text-align: center; font-size: 16pt; margin-bottom: 15pt; }
                              h3 { font-size: 14pt; font-weight: bold; margin-top: 15pt; margin-bottom: 8pt; }
                              .field { margin-bottom: 8pt; }
                              .field-label { font-weight: bold; }
                              .section { margin-bottom: 15pt; }
                              .article { margin-bottom: 30pt; border-bottom: 1px solid #ccc; padding-bottom: 15pt; page-break-inside: avoid; }
                              @media print { body { margin: 0.5in; } }
                            </style>
                          </head>
                          <body>
                            <h1>RisqAI News Capsule Reporting</h1>
                            <h2>Executive Report: ${formatDate(selectedReport.createdAt)}${versionText}</h2>
                            <p style="text-align: center; margin-bottom: 30pt;">Generated on: ${new Date().toLocaleDateString()}</p>
                        `;
                        
                        selectedReport.articles.forEach((article) => {
                          const execNotes = getArticleNote(selectedReport.id, article.id);
                          
                          printContent += `
                            <div class="article">
                              <h3>${article.title}</h3>
                              <div class="field"><span class="field-label">Threat Name:</span> ${article.threatName}</div>
                              <div class="field"><span class="field-label">Vulnerability ID:</span> ${article.vulnerabilityId}</div>
                              <div class="field"><span class="field-label">Attack Vector:</span> ${article.attackVector}</div>
                              <div class="field"><span class="field-label">Target OS:</span> ${article.targetOS}</div>
                              ${execNotes.trim() ? `<div class="field"><span class="field-label">Executive Notes:</span> ${execNotes}</div>` : ''}
                              <div class="field"><span class="field-label">Source:</span> ${cleanPublicationName(article.sourcePublication)}</div>
                              
                              <div class="section">
                                <div class="field-label">Summary:</div>
                                <p>${article.summary}</p>
                              </div>
                              
                              <div class="section">
                                <div class="field-label">Impacts:</div>
                                <p>${article.impacts}</p>
                              </div>
                              
                              <div class="field"><span class="field-label">Original URL:</span> ${article.originalUrl}</div>
                            </div>
                          `;
                        });
                        
                        printContent += `
                            <p style="text-align: center; margin-top: 30pt; font-style: italic;">Report Generated by RisqAI News Capsule</p>
                          </body>
                          </html>
                        `;
                        
                        printWindow.document.write(printContent);
                        printWindow.document.close();
                        printWindow.focus();
                        printWindow.print();
                      }
                    }}
                  >
                    Print Report
                  </button>
                  
                  <button
                    className="px-3 py-1 text-sm bg-primary/20 hover:bg-primary/30 text-primary rounded-md"
                    onClick={() => {
                      const versionText = selectedReport.versionNumber && selectedReport.versionNumber > 1 ? 
                        `_Version_${selectedReport.versionNumber}` : '';
                      const reportTitle = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/,/g, '')}${versionText}`;
                      let reportContent = `EXECUTIVE REPORT: ${formatDate(selectedReport.createdAt)}\n`;
                      reportContent += selectedReport.versionNumber && selectedReport.versionNumber > 1 ? 
                        `VERSION: ${selectedReport.versionNumber}\n` : '';
                      reportContent += `REPORT TIME: ${format(new Date(selectedReport.createdAt), "h:mm a")}\n\n`;
                      reportContent += `TOTAL ARTICLES: ${selectedReport.articles.length}\n\n`;
                      reportContent += `====================================================\n\n`;
                      
                      selectedReport.articles.forEach((article, index) => {
                        reportContent += `ARTICLE ${index + 1}\n`;
                        reportContent += `TITLE: ${article.title}\n`;
                        reportContent += `THREAT: ${article.threatName}\n`;
                        reportContent += `VULNERABILITY ID: ${article.vulnerabilityId}\n\n`;
                        reportContent += `SUMMARY:\n${article.summary}\n\n`;
                        reportContent += `IMPACTS:\n${article.impacts}\n\n`;
                        reportContent += `ATTACK VECTOR:\n${article.attackVector}\n\n`;
                        reportContent += `TARGET OS: ${article.targetOS}\n`;
                        
                        const articleNote = getArticleNote(selectedReport.id, article.id);
                        if (articleNote.trim()) {
                          reportContent += `EXECUTIVE NOTES:\n${articleNote}\n\n`;
                        }
                        
                        reportContent += `SOURCE: ${cleanPublicationName(article.sourcePublication)}\n`;
                        reportContent += `ORIGINAL URL: ${article.originalUrl}\n\n`;
                        reportContent += `-------------------------------------------\n\n`;
                      });
                      
                      const blob = new Blob([reportContent], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${reportTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Export as Text
                  </button>
                </div>
              </div>
              
              <div className="space-y-6">
                {selectedReport.articles.map((article, index) => (
                  <div
                    key={article.id}
                    className={`p-4 bg-slate-800/50 border border-slate-700/40 rounded-lg relative group ${
                      draggedArticle === article.id ? 'opacity-50 ring-2 ring-blue-500' : ''
                    }`}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, article.id)}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, article.id)}
                  >
                    {/* Drag Handle */}
                    <div className="absolute top-3 left-3 text-slate-400 hover:text-slate-200 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" title="Drag to reorder">
                      <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
                        <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
                      </svg>
                    </div>
                    
                    <button
                      onClick={() => {
                        // Remove article from report
                        const updatedReport = {
                          ...selectedReport,
                          articles: selectedReport.articles.filter(a => a.id !== article.id)
                        };
                        setSelectedReport(updatedReport);
                        
                        // Update localStorage
                        const savedReports = localStorage.getItem('newsCapsuleReports');
                        if (savedReports) {
                          const reports = JSON.parse(savedReports);
                          const reportIndex = reports.findIndex((r: any) => r.id === selectedReport.id);
                          if (reportIndex !== -1) {
                            reports[reportIndex] = updatedReport;
                            localStorage.setItem('newsCapsuleReports', JSON.stringify(reports));
                          }
                        }
                      }}
                      className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                      title="Remove from report"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m18 6-12 12M6 6l12 12"/>
                      </svg>
                    </button>
                    
                    <h3 className="font-medium text-lg mb-4 pr-8">{article.title}</h3>
                    
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
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-400">Attack Vector</p>
                        <p className="text-sm">{article.attackVector}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Target OS</p>
                        <p className="text-sm">{article.targetOS}</p>
                      </div>
                    </div>
                    
                    {/* Executive Notes - Only show if notes exist */}
                    {(() => {
                      const noteValue = getArticleNote(selectedReport.id, article.id);
                      if (noteValue.trim()) {
                        return (
                          <div className="mb-4">
                            <p className="text-xs text-slate-400 mb-1">Executive Notes</p>
                            <div className="p-3 bg-slate-700/30 border border-slate-600/30 rounded-md">
                              <p className="text-sm text-slate-200 whitespace-pre-wrap">{noteValue}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    <div className="mt-4 pt-4 border-t border-slate-600/30">
                      <p className="text-xs text-slate-400 mb-1">Source</p>
                      <p className="text-sm">{cleanPublicationName(article.sourcePublication)}</p>
                      <a 
                        href={article.originalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View original article
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400">Select a report to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}