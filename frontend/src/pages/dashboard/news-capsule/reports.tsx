import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Report, ReportsManager } from "@/components/news-capsule/reports-manager";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

interface ArticleNotes {
  [articleId: string]: string;
}

interface ReportNotes {
  [reportId: string]: ArticleNotes;
}

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [articleNotes, setArticleNotes] = useState<ReportNotes>({});
  
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

  const handleReportSelect = (report: Report) => {
    setSelectedReport(report);
  };

  const updateArticleNote = (reportId: string, articleId: string, note: string) => {
    setArticleNotes(prev => {
      const updated = {
        ...prev,
        [reportId]: {
          ...prev[reportId],
          [articleId]: note
        }
      };
      saveNotesToStorage(updated);
      return updated;
    });
  };

  const getArticleNote = (reportId: string, articleId: string): string => {
    return articleNotes[reportId]?.[articleId] || "";
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
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Reports List - Using our new ReportsManager component */}
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
                    onClick={async () => {
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
                        
                        sections.push(
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `Generated on: ${new Date().toLocaleDateString()}`,
                                font: "Cambria",
                                size: 22
                              })
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 240 }
                          })
                        );
                        
                        // Articles summary
                        sections.push(
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "Articles in this Report:",
                                font: "Cambria",
                                size: 24,
                                bold: true,
                                color: "000000"
                              })
                            ],
                            spacing: { after: 120 }
                          })
                        );
                        
                        selectedReport.articles.forEach((article) => {
                          sections.push(
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: `• ${article.title}`,
                                  font: "Cambria",
                                  size: 22
                                })
                              ],
                              spacing: { after: 0 }
                            })
                          );
                        });
                        
                        sections.push(new Paragraph({ text: "", spacing: { after: 240 } }));
                        
                        // Article details
                        selectedReport.articles.forEach((article, index) => {
                          // Add extra line break before article title
                          sections.push(new Paragraph({ text: "", spacing: { after: 120 } }));
                          
                          sections.push(
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: article.title,
                                  font: "Cambria",
                                  size: 24,
                                  bold: true,
                                  color: "000000"
                                })
                              ],
                              spacing: { before: 120, after: 120 }
                            })
                          );
                          
                          const fields = [
                            { label: "Threat Name:", value: article.threatName },
                            { label: "Vulnerability ID:", value: article.vulnerabilityId },
                            { label: "Attack Vector:", value: article.attackVector },
                            { label: "Target OS:", value: article.targetOS },
                            { label: "Source:", value: article.sourcePublication }
                          ];
                          
                          fields.forEach(field => {
                            sections.push(
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: field.label + " ",
                                    font: "Cambria",
                                    size: 22,
                                    bold: true
                                  }),
                                  new TextRun({
                                    text: field.value,
                                    font: "Cambria",
                                    size: 22
                                  })
                                ],
                                spacing: { after: 0 }
                              })
                            );
                          });
                          
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
                              spacing: { before: 120, after: 0 }
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
                              spacing: { after: 0 }
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
                          
                          // Add executive notes if they exist
                          const articleNote = getArticleNote(selectedReport.id, article.id);
                          if (articleNote.trim()) {
                            sections.push(
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: "Executive Notes:",
                                    font: "Cambria",
                                    size: 22,
                                    bold: true
                                  })
                                ],
                                spacing: { after: 0 }
                              })
                            );
                            
                            sections.push(
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: articleNote,
                                    font: "Cambria",
                                    size: 22
                                  })
                                ],
                                spacing: { after: 120 }
                              })
                            );
                          }
                          

                          
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
                              spacing: { after: 240 }
                            })
                          );
                        });
                        
                        // Footer
                        sections.push(
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "Report Generated by RisqAI News Capsule",
                                font: "Cambria",
                                size: 22
                              })
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 480 }
                          })
                        );
                        
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
                    className="px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded-md"
                    onClick={() => {
                      // Add print-specific styling
                      const printStyle = document.createElement('style');
                      printStyle.id = 'print-style';
                      printStyle.innerHTML = `
                        @media print {
                          @page {
                            size: letter;
                            margin: 0.75in 0.5in;
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
                          /* Update document title */
                          title {
                            content: "RisqAI News Capsule Reporting" !important;
                          }
                          /* Hide navigation and controls */
                          nav, header, aside, .md\\:col-span-1, button, 
                          input, select, .flex.gap-2, .flex.justify-between {
                            display: none !important;
                          }
                          /* Make the report container full width */
                          .md\\:col-span-4 {
                            width: 100% !important;
                            max-width: 100% !important;
                          }
                          .grid.grid-cols-1 {
                            display: block !important;
                          }
                          /* Reset background and styling */
                          .p-5, .backdrop-blur-sm, .bg-slate-900\\/50, .border, .rounded-xl {
                            background: white !important;
                            border: none !important;
                            box-shadow: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                          }
                          /* Format report header */
                          h2 {
                            font-size: 18pt !important;
                            font-weight: bold !important;
                            margin-bottom: 0.5in !important;
                            text-align: center !important;
                            border-bottom: 1pt solid #000 !important;
                            padding-bottom: 0.2in !important;
                            color: black !important;
                            position: relative !important;
                          }
                          h2 span {
                            color: #444 !important;
                          }
                          /* Add company header */
                          h2:before {
                            content: "RisqAI News Capsule Reporting" !important;
                            display: block !important;
                            font-family: Cambria, serif !important;
                            font-size: 14pt !important;
                            font-weight: bold !important;
                            margin-bottom: 12pt !important;
                            color: black !important;
                          }
                          /* Format articles */
                          .space-y-6 > div {
                            page-break-inside: avoid !important;
                            margin-bottom: 0.4in !important;
                            border: 1pt solid #ddd !important;
                            padding: 0.25in !important;
                          }
                          /* Format article titles */
                          .font-medium.text-lg, h3 {
                            font-family: Cambria, serif !important;
                            font-size: 12pt !important;
                            font-weight: bold !important;
                            margin-top: 12pt !important;
                            margin-bottom: 6pt !important;
                            color: black !important;
                          }
                          /* Format section headings */
                          .font-medium.text-sm {
                            font-size: 11pt !important;
                            font-weight: bold !important;
                            margin-top: 0.15in !important;
                            margin-bottom: 0.05in !important;
                            color: black !important;
                          }
                          /* Format content text */
                          p, .text-sm {
                            font-size: 10pt !important;
                            line-height: 1.4 !important;
                            color: black !important;
                          }
                          /* Remove footer */
                          .space-y-6:after {
                            content: none;
                            display: none;
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
                        // Restore original title
                        document.title = originalTitle;
                      }, 1000);
                    }}
                  >
                    Print
                  </button>
                  <button
                    className="px-3 py-1 text-sm bg-primary/20 hover:bg-primary/30 text-primary rounded-md"
                    onClick={() => {
                      // Get all reports from today to check if multiple versions exist
                      const savedReportsStr = localStorage.getItem('newsCapsuleReports');
                      if (savedReportsStr) {
                        const savedReports = JSON.parse(savedReportsStr);
                        const selectedDate = new Date(selectedReport.createdAt);
                        selectedDate.setHours(0, 0, 0, 0);
                        
                        // Find all reports from the same day
                        const reportsFromSameDay = savedReports.filter(report => {
                          const reportDate = new Date(report.createdAt);
                          const reportDay = new Date(reportDate);
                          reportDay.setHours(0, 0, 0, 0);
                          return reportDay.getTime() === selectedDate.getTime();
                        });
                        
                        // If multiple reports exist for today, show a custom dropdown selection dialog
                        if (reportsFromSameDay.length > 1) {
                          // Create a simple dialog to let user select which report to export
                          const selectDialog = document.createElement('div');
                          selectDialog.style.position = 'fixed';
                          selectDialog.style.top = '0';
                          selectDialog.style.left = '0';
                          selectDialog.style.width = '100%';
                          selectDialog.style.height = '100%';
                          selectDialog.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                          selectDialog.style.zIndex = '9999';
                          selectDialog.style.display = 'flex';
                          selectDialog.style.alignItems = 'center';
                          selectDialog.style.justifyContent = 'center';
                          
                          // Create dialog content
                          const dialogContent = document.createElement('div');
                          dialogContent.style.backgroundColor = '#1e293b';
                          dialogContent.style.border = '1px solid #475569';
                          dialogContent.style.borderRadius = '8px';
                          dialogContent.style.padding = '24px';
                          dialogContent.style.width = '500px';
                          dialogContent.style.maxWidth = '90%';
                          
                          // Create dialog title
                          const title = document.createElement('h3');
                          title.textContent = `Select Report to Export (${formatDate(selectedReport.createdAt)})`;
                          title.style.fontSize = '18px';
                          title.style.fontWeight = 'bold';
                          title.style.marginBottom = '16px';
                          title.style.color = 'white';
                          
                          // Create select element
                          const select = document.createElement('select');
                          select.style.width = '100%';
                          select.style.padding = '8px 12px';
                          select.style.backgroundColor = '#0f172a';
                          select.style.color = 'white';
                          select.style.border = '1px solid #475569';
                          select.style.borderRadius = '4px';
                          select.style.marginBottom = '20px';
                          
                          // Sort reports with newest on top
                          const sortedReports = [...reportsFromSameDay].sort((a, b) => 
                            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                          );
                          
                          // Add options for each report
                          sortedReports.forEach(report => {
                            const option = document.createElement('option');
                            option.value = report.id;
                            
                            // Mark currently selected report
                            if (report.id === selectedReport.id) {
                              option.selected = true;
                            }
                            
                            const time = format(new Date(report.createdAt), "h:mm a");
                            const versionText = report.versionNumber && report.versionNumber > 1 ? 
                              `Version ${report.versionNumber}` : 'Version 1';
                            
                            option.textContent = `${time} - ${versionText} (${report.articles.length} articles)`;
                            select.appendChild(option);
                          });
                          
                          // Create button container
                          const buttonContainer = document.createElement('div');
                          buttonContainer.style.display = 'flex';
                          buttonContainer.style.gap = '12px';
                          buttonContainer.style.justifyContent = 'flex-end';
                          
                          // Create cancel button
                          const cancelButton = document.createElement('button');
                          cancelButton.textContent = 'Cancel';
                          cancelButton.style.padding = '8px 16px';
                          cancelButton.style.backgroundColor = '#334155';
                          cancelButton.style.color = 'white';
                          cancelButton.style.border = 'none';
                          cancelButton.style.borderRadius = '4px';
                          cancelButton.style.cursor = 'pointer';
                          
                          // Create export button
                          const exportButton = document.createElement('button');
                          exportButton.textContent = 'Export Selected';
                          exportButton.style.padding = '8px 16px';
                          exportButton.style.backgroundColor = '#2563eb';
                          exportButton.style.color = 'white';
                          exportButton.style.border = 'none';
                          exportButton.style.borderRadius = '4px';
                          exportButton.style.cursor = 'pointer';
                          
                          // Add event listeners
                          cancelButton.addEventListener('click', () => {
                            document.body.removeChild(selectDialog);
                          });
                          
                          exportButton.addEventListener('click', () => {
                            const selectedReportId = select.value;
                            const reportToExport = savedReports.find(r => r.id === selectedReportId);
                            
                            // Remove dialog
                            document.body.removeChild(selectDialog);
                            
                            if (reportToExport) {
                              // Export the selected report
                              const versionText = reportToExport.versionNumber && reportToExport.versionNumber > 1 ? 
                                `_Version_${reportToExport.versionNumber}` : '';
                              const reportTitle = `Executive_Report_${formatDate(reportToExport.createdAt).replace(/,/g, '')}${versionText}`;
                              let reportContent = `EXECUTIVE REPORT: ${formatDate(reportToExport.createdAt)}\n`;
                              reportContent += reportToExport.versionNumber && reportToExport.versionNumber > 1 ? 
                                `VERSION: ${reportToExport.versionNumber}\n` : '';
                              reportContent += `REPORT TIME: ${format(new Date(reportToExport.createdAt), "h:mm a")}\n\n`;
                              reportContent += `TOTAL ARTICLES: ${reportToExport.articles.length}\n\n`;
                              reportContent += `====================================================\n\n`;
                              
                              reportToExport.articles.forEach((article, index) => {
                                reportContent += `ARTICLE ${index + 1}\n`;
                                reportContent += `TITLE: ${article.title}\n`;
                                reportContent += `THREAT: ${article.threatName}\n`;
                                reportContent += `VULNERABILITY ID: ${article.vulnerabilityId}\n\n`;
                                reportContent += `SUMMARY:\n${article.summary}\n\n`;
                                reportContent += `IMPACTS:\n${article.impacts}\n\n`;
                                
                                // Add executive notes if they exist
                                const articleNote = getArticleNote(reportToExport.id, article.id);
                                if (articleNote.trim()) {
                                  reportContent += `EXECUTIVE NOTES:\n${articleNote}\n\n`;
                                }
                                
                                reportContent += `ATTACK VECTOR:\n${article.attackVector}\n\n`;
                                reportContent += `TARGET OS: ${article.targetOS}\n`;
                                reportContent += `SOURCE: ${article.sourcePublication}\n`;
                                reportContent += `ORIGINAL URL: ${article.originalUrl}\n\n`;
                                reportContent += `-------------------------------------------\n\n`;
                              });
                              
                              // Create and download text file
                              const blob = new Blob([reportContent], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${reportTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }
                          });
                          
                          // Assemble dialog
                          buttonContainer.appendChild(cancelButton);
                          buttonContainer.appendChild(exportButton);
                          dialogContent.appendChild(title);
                          dialogContent.appendChild(select);
                          dialogContent.appendChild(buttonContainer);
                          selectDialog.appendChild(dialogContent);
                          
                          // Add dialog to document
                          document.body.appendChild(selectDialog);
                          
                          // Stop the normal export flow
                          return;
                        }
                      }

                      // Export the currently selected report
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
                        
                        // Add executive notes if they exist
                        const articleNote = getArticleNote(selectedReport.id, article.id);
                        if (articleNote.trim()) {
                          reportContent += `EXECUTIVE NOTES:\n${articleNote}\n\n`;
                        }
                        
                        reportContent += `ATTACK VECTOR:\n${article.attackVector}\n\n`;
                        reportContent += `TARGET OS: ${article.targetOS}\n`;
                        reportContent += `SOURCE: ${article.sourcePublication}\n`;
                        reportContent += `ORIGINAL URL: ${article.originalUrl}\n\n`;
                        reportContent += `-------------------------------------------\n\n`;
                      });
                      
                      // Create and download text file
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
              
              {selectedReport.articles.length === 0 ? (
                <div className="p-4 bg-blue-900/30 border border-blue-700/30 rounded-lg mb-6">
                  <h3 className="text-blue-300 font-medium mb-2">Empty Report Created Successfully</h3>
                  <p className="text-sm text-slate-300 mb-2">This is a new empty report that doesn't contain any articles yet.</p>
                  <p className="text-sm text-slate-400">To add articles to this report:</p>
                  <ol className="list-decimal list-inside text-sm text-slate-400 ml-2 mt-1 space-y-1">
                    <li>Go to the Research page</li>
                    <li>Process articles using the URL input</li>
                    <li>Select articles to include</li>
                    <li>Choose "Send to Executive Report" and select this report version when prompted</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Articles Summary */}
                  <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg mb-6">
                    <h3 className="text-blue-300 font-medium mb-3">Articles in this Report:</h3>
                    <ul className="space-y-1">
                      {selectedReport.articles.map((article, index) => (
                        <li key={article.id} className="text-sm text-slate-300">
                          • {article.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {selectedReport.articles.map((article, index) => (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 bg-slate-800/50 border border-slate-700/40 rounded-lg relative"
                    >
                      <button
                        onClick={() => {
                          // Remove article from report
                          const updatedReport = {
                            ...selectedReport,
                            articles: selectedReport.articles.filter(a => a.id !== article.id)
                          };
                          
                          // Update localStorage
                          const savedReports = JSON.parse(localStorage.getItem('newsCapsuleReports') || '[]');
                          const updatedReports = savedReports.map((r: any) => 
                            r.id === selectedReport.id ? updatedReport : r
                          );
                          localStorage.setItem('newsCapsuleReports', JSON.stringify(updatedReports));
                          
                          // Update the selected report state immediately
                          setSelectedReport(updatedReport);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-full flex items-center justify-center text-xs font-bold"
                        title="Remove article from report"
                      >
                        ×
                      </button>
                      <h3 className="text-lg font-medium mb-2 pr-8">{article.title}</h3>
                      
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
                      
                      {/* Notes Section */}
                      <div className="mb-4">
                        <p className="text-xs text-slate-400 mb-1">Executive Notes</p>
                        <textarea
                          value={getArticleNote(selectedReport.id, article.id)}
                          onChange={(e) => updateArticleNote(selectedReport.id, article.id, e.target.value)}
                          placeholder="Add executive notes for this story..."
                          className="w-full p-2 text-sm bg-slate-700/50 border border-slate-600/50 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical min-h-[80px]"
                        />
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
    </div>
  );
}