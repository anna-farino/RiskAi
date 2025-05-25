import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Report, ReportsManager } from "@/components/news-capsule/reports-manager";

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  
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
                <h2 className="text-xl font-semibold">
                  Executive Report: {formatDate(selectedReport.createdAt)}
                  {selectedReport.versionNumber && selectedReport.versionNumber > 1 && 
                    <span className="ml-2 text-blue-400 text-sm">(Version: {selectedReport.versionNumber})</span>
                  }
                </h2>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded-md"
                    onClick={() => {
                      // Print report
                      window.print();
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
    </div>
  );
}