import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Report, ReportsManager } from "@/components/news-capsule/reports-manager";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { XIcon, GripVerticalIcon, EditIcon, SaveIcon, PlusIcon } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [draggedArticle, setDraggedArticle] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [executiveNotes, setExecutiveNotes] = useState<Record<string, string>>({});
  const [showAddNote, setShowAddNote] = useState<string | null>(null);
  
  const handleReportSelect = (report: Report) => {
    setSelectedReport(report);
    loadExecutiveNotes(report.id);
  };

  // Load executive notes for the selected report
  const loadExecutiveNotes = async (reportId: string) => {
    try {
      const response = await fetch(`/api/news-capsule/executive-notes/${reportId}`, {
        credentials: 'include'
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
      console.error('Error loading executive notes:', error);
    }
  };

  // Save or update an executive note
  const saveExecutiveNote = async (articleId: string, note: string) => {
    if (!selectedReport) return;

    try {
      const response = await fetch('/api/news-capsule/executive-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      console.error('Error saving executive note:', error);
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

  const removeArticleFromReport = (articleId: string) => {
    if (!selectedReport) return;

    // Create updated report with article removed
    const updatedReport = {
      ...selectedReport,
      articles: selectedReport.articles.filter(article => article.id !== articleId)
    };

    // Update localStorage
    const savedReports = JSON.parse(localStorage.getItem('newsCapsuleReports') || '[]');
    const updatedReports = savedReports.map((report: Report) => 
      report.id === selectedReport.id ? updatedReport : report
    );
    localStorage.setItem('newsCapsuleReports', JSON.stringify(updatedReports));

    // Update selected report
    setSelectedReport(updatedReport);
  };

  const handleDragStart = (e: React.DragEvent, articleId: string) => {
    setDraggedArticle(articleId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!selectedReport || !draggedArticle) return;

    const draggedIndex = selectedReport.articles.findIndex(article => article.id === draggedArticle);
    if (draggedIndex === -1 || draggedIndex === dropIndex) return;

    // Create new articles array with reordered items
    const newArticles = [...selectedReport.articles];
    const [draggedItem] = newArticles.splice(draggedIndex, 1);
    newArticles.splice(dropIndex, 0, draggedItem);

    // Update report with new order
    const updatedReport = {
      ...selectedReport,
      articles: newArticles
    };

    // Update localStorage
    const savedReports = JSON.parse(localStorage.getItem('newsCapsuleReports') || '[]');
    const updatedReports = savedReports.map((report: Report) => 
      report.id === selectedReport.id ? updatedReport : report
    );
    localStorage.setItem('newsCapsuleReports', JSON.stringify(updatedReports));

    // Update selected report
    setSelectedReport(updatedReport);
    setDraggedArticle(null);
    setDragOverIndex(null);
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
          createdAt: article.createdAt,
          executiveNote: executiveNotes[article.id] || null
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
      
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* Reports Panel - Fixed Width, No Scroll */}
        <div className="w-80 flex-shrink-0">
          <div className="p-5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl h-full">
            <h2 className="text-xl font-semibold mb-4">Reports Panel</h2>
            <div className="overflow-y-auto h-[calc(100%-3rem)]">
              <ReportsManager 
                onReportSelect={handleReportSelect}
                selectedReportId={selectedReport?.id}
              />
            </div>
          </div>
        </div>
        
        {/* Executive Report Content - Flexible Width, Independent Scroll */}
        <div className="flex-1 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="h-full overflow-y-auto p-5">
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
                                    text: `Executive Report: ${formatDate(selectedReport.createdAt)}${selectedReport.versionNumber && selectedReport.versionNumber > 1 ? ` (Version: ${selectedReport.versionNumber})` : ''}`,
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
                            link.download = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}${selectedReport.versionNumber && selectedReport.versionNumber > 1 ? `_v${selectedReport.versionNumber}` : ''}.docx`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error('Error creating Word document:', error);
                            alert('Error creating Word document. Please try again.');
                          }
                        }}
                      >
                        Export to Word
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700"
                        onClick={() => {
                          setShowExportDropdown(false);
                          // Add print-specific styling
                          const printStyle = document.createElement('style');
                          printStyle.id = 'print-style';
                          printStyle.innerHTML = `
                            @media print {
                              @page {
                                size: letter;
                                margin: 1in 0.75in 1in 0.75in;
                              }
                              body {
                                font-family: Cambria, serif !important;
                                font-size: 11pt !important;
                                line-height: 1.15 !important;
                                background: white !important;
                                color: black !important;
                                margin: 0 !important;
                                padding: 0 !important;
                              }
                              /* Hide navigation and interactive elements */
                              header, aside, nav, 
                              button, input, select, textarea,
                              .w-80.flex-shrink-0 {
                                display: none !important;
                              }
                              /* Hide the top navigation tabs specifically */
                              .flex.gap-8,
                              .flex.gap-8 *,
                              a[href*="/dashboard/news-capsule"] {
                                display: none !important;
                              }
                              /* Hide any element containing "Home", "Research", "Executive Reports" */
                              *:contains("Home"):not(h2):not(h3):not(p),
                              *:contains("Research"):not(h2):not(h3):not(p),
                              *:contains("Executive Reports"):not(h2):not(h3):not(p) {
                                display: none !important;
                              }
                              /* Reset layout margins for print */
                              main {
                                margin: 0 !important;
                                padding: 0 !important;
                              }
                              /* Remove all layout spacing and positioning */
                              .min-h-screen, .pt-\\[88px\\], .flex, .p-4, .md\\:p-6,
                              .space-y-6, .space-y-8, .mb-8, .mt-8, .py-4, .px-2,
                              .gap-6, .gap-2, .gap-4, .gap-8 {
                                margin: 0 !important;
                                padding: 0 !important;
                                gap: 0 !important;
                              }
                              /* Force content to start at top */
                              * {
                                margin-top: 0 !important;
                                padding-top: 0 !important;
                              }
                              /* Only allow bottom spacing between articles */
                              .space-y-6 > div {
                                margin-bottom: 0.3in !important;
                                margin-top: 0 !important;
                              }
                              /* Hide the main layout flex container and make report full width */
                              .flex.gap-6 {
                                display: block !important;
                              }
                              /* Make the Executive Report content full width */
                              .flex-1 {
                                width: 100% !important;
                                max-width: 100% !important;
                                flex: none !important;
                              }
                              .grid.grid-cols-1 {
                                display: block !important;
                              }
                              /* Reset background and styling */
                              .p-5, .backdrop-blur-sm, .bg-slate-900\\/50, .border, .rounded-xl {
                                background: white !important;
                                border: none !important;
                                border-radius: 0 !important;
                                box-shadow: none !important;
                              }
                              /* Format headings */
                              h1, h2, h3 {
                                font-family: Cambria, serif !important;
                                font-size: 12pt !important;
                                font-weight: bold !important;
                                margin-top: 12pt !important;
                                margin-bottom: 6pt !important;
                                color: black !important;
                              }
                              /* Format text */
                              p, .text-sm {
                                font-size: 10pt !important;
                                line-height: 1.4 !important;
                                color: black !important;
                              }
                              /* Single column layout for print - force all grids to block */
                              .grid, .grid-cols-1, .grid-cols-2 {
                                display: block !important;
                                grid-template-columns: none !important;
                              }
                              /* Remove card styling for print and ensure single column */
                              .space-y-6 > div, .space-y-8 > div {
                                border: none !important;
                                border-radius: 0 !important;
                                background: none !important;
                                padding: 0 !important;
                                margin-bottom: 0.3in !important;
                                page-break-inside: avoid;
                                width: 100% !important;
                                display: block !important;
                              }
                              /* Ensure story content flows in single column */
                              .space-y-6, .space-y-8 {
                                display: block !important;
                                width: 100% !important;
                              }
                              /* Hide interactive elements */
                              .group, .absolute, .cursor-grab, .opacity-0, 
                              .hover\\:opacity-100, .ring-2, .ring-blue-500,
                              button, textarea, .bg-blue-600 {
                                display: none !important;
                              }
                            }
                          `;
                          document.head.appendChild(printStyle);
                          
                          // Change the document title for printing
                          const originalTitle = document.title;
                          document.title = "RisqAI News Capsule Reporting";
                          
                          // Print the report
                          window.print();
                          
                          // Remove the print style after printing and restore title
                          setTimeout(() => {
                            const styleElement = document.getElementById('print-style');
                            if (styleElement) {
                              styleElement.remove();
                            }
                            document.title = originalTitle;
                          }, 1000);
                        }}
                      >
                        Print
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700"
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
                                <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 16px;">Executive Report: ${formatDate(selectedReport.createdAt)}${selectedReport.versionNumber && selectedReport.versionNumber > 1 ? ` (Version: ${selectedReport.versionNumber})` : ''}</h2>
                            `;
                            
                            if (selectedReport.topic) {
                              htmlContent += `<p style="margin-bottom: 16px;"><strong>Report Topic:</strong> ${selectedReport.topic}</p>`;
                            }
                            
                            selectedReport.articles.forEach((article, index) => {
                              htmlContent += `
                                <div style="page-break-inside: avoid; margin-bottom: 24px; border-bottom: 1px solid #ddd; padding-bottom: 16px;">
                                  <h3 style="font-size: 12pt; font-weight: bold; margin-bottom: 12px; color: #333;">Article ${index + 1}: ${article.title}</h3>
                                  <p style="margin-bottom: 8px;"><strong>Threat Name:</strong> ${article.threatName}</p>
                                  <p style="margin-bottom: 8px;"><strong>Vulnerability ID:</strong> ${article.vulnerabilityId}</p>
                                  <p style="margin-bottom: 8px;"><strong>Target OS:</strong> ${article.targetOS}</p>
                                  <p style="margin-bottom: 12px;"><strong>Source:</strong> ${article.sourcePublication}</p>
                                  
                                  <h4 style="font-weight: bold; margin: 12px 0 6px 0; color: #555;">Summary:</h4>
                                  <p style="margin-bottom: 12px; line-height: 1.4;">${article.summary}</p>
                                  
                                  <h4 style="font-weight: bold; margin: 12px 0 6px 0; color: #555;">Impacts:</h4>
                                  <p style="margin-bottom: 12px; line-height: 1.4;">${article.impacts}</p>
                                  
                                  <h4 style="font-weight: bold; margin: 12px 0 6px 0; color: #555;">Attack Vector:</h4>
                                  <p style="margin-bottom: 12px; line-height: 1.4;">${article.attackVector}</p>
                              `;
                              
                              if (executiveNotes[article.id]) {
                                htmlContent += `
                                  <h4 style="font-weight: bold; margin: 12px 0 6px 0; color: #555;">Executive Note:</h4>
                                  <p style="margin-bottom: 12px; line-height: 1.4; background-color: #f8f9fa; padding: 8px; border-left: 3px solid #007bff;">${executiveNotes[article.id]}</p>
                                `;
                              }
                              
                              htmlContent += `<p style="margin-bottom: 8px; font-size: 10pt; color: #666;"><strong>Original URL:</strong> ${article.originalUrl}</p></div>`;
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
                            const imgWidth = 210; // A4 width in mm
                            const pageHeight = 295; // A4 height in mm
                            const imgHeight = (canvas.height * imgWidth) / canvas.width;
                            let heightLeft = imgHeight;
                            let position = 0;
                            
                            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
                            heightLeft -= pageHeight;
                            
                            while (heightLeft >= 0) {
                              position = heightLeft - imgHeight;
                              pdf.addPage();
                              pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
                              heightLeft -= pageHeight;
                            }
                            
                            // Download the PDF
                            pdf.save(`Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}${selectedReport.versionNumber && selectedReport.versionNumber > 1 ? `_v${selectedReport.versionNumber}` : ''}.pdf`);
                            
                            // Clean up
                            document.body.removeChild(container);
                            
                          } catch (error) {
                            console.error('Error creating PDF:', error);
                            alert('Error creating PDF. Please try again.');
                          }
                        }}
                      >
                        Export to PDF
                      </button>
                      
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700"
                        onClick={() => {
                          setShowExportDropdown(false);
                          // Generate text content
                          let textContent = "RisqAI News Capsule Reporting\n";
                          textContent += "=".repeat(50) + "\n\n";
                          
                          textContent += `Executive Report: ${formatDate(selectedReport.createdAt)}`;
                          if (selectedReport.versionNumber && selectedReport.versionNumber > 1) {
                            textContent += ` (Version: ${selectedReport.versionNumber})`;
                          }
                          textContent += "\n\n";
                          
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
                          link.download = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}${selectedReport.versionNumber && selectedReport.versionNumber > 1 ? `_v${selectedReport.versionNumber}` : ''}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
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
                      className={`relative cursor-move pb-6 mb-6 ${
                        dragOverIndex === index 
                          ? 'bg-blue-900/10 p-2 rounded-lg' 
                          : ''
                      } ${index < selectedReport.articles.length - 1 ? 'border-b border-slate-700/30' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, article.id)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-1 text-slate-400 hover:text-slate-300 cursor-grab active:cursor-grabbing">
                          <GripVerticalIcon className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-medium flex-1">{article.title}</h3>
                        <button
                          onClick={() => removeArticleFromReport(article.id)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-full transition-colors"
                          title="Remove article from report"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
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
                        
                        {/* Executive Notes Section */}
                        <div className="mt-4 pt-4 border-t border-slate-700/30">
                          <p className="text-xs text-slate-400 mb-2">Executive Note</p>
                          
                          <textarea
                            value={executiveNotes[article.id] || ''}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setExecutiveNotes(prev => ({ ...prev, [article.id]: newValue }));
                              // Auto-save after 1 second of no typing
                              clearTimeout((window as any)[`noteTimer_${article.id}`]);
                              (window as any)[`noteTimer_${article.id}`] = setTimeout(() => {
                                if (newValue.trim()) {
                                  saveExecutiveNote(article.id, newValue);
                                }
                              }, 1000);
                            }}
                            placeholder="Add your executive note for this article..."
                            className="w-full p-3 bg-slate-800/50 border border-slate-700/50 rounded-md text-sm text-slate-200 placeholder-slate-400 focus:border-blue-500 focus:outline-none resize-vertical min-h-[80px]"
                          />
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
    </div>
  );
}