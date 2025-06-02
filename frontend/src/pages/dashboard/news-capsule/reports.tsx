import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Report, ReportsManager } from "@/components/news-capsule/reports-manager";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
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
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Executive Reports</h1>
          <p className="text-slate-300">
            View and manage compiled reports for executive review.
          </p>
        </div>
        
        {/* Export Button - Only show when a report is selected */}
        {selectedReport && (
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
                    // Simple Word export for now
                    const content = `Executive Report: ${formatDate(selectedReport.createdAt)}\n\n${selectedReport.articles?.map((article: any, index: number) => `${index + 1}. ${article.title}\n${article.summary || ''}`).join('\n\n') || 'No articles'}`;
                    
                    const doc = new Document({
                      sections: [{
                        properties: {},
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: content, font: "Cambria" })],
                            alignment: AlignmentType.LEFT
                          })
                        ]
                      }]
                    });
                    
                    const blob = await Packer.toBlob(doc);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Executive_Report_${formatDate(selectedReport.createdAt).replace(/,|\s/g, '_')}.docx`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
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
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 rounded-b-md"
                  onClick={() => {
                    setShowExportDropdown(false);
                    const content = `Executive Report: ${formatDate(selectedReport.createdAt)}\n\n${selectedReport.articles?.map((article: any, index: number) => `${index + 1}. ${article.title}\n${article.summary || ''}`).join('\n\n') || 'No articles'}`;
                    const blob = new Blob([content], { type: 'text/plain' });
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
              </div>
            )}
          </div>
        )}
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
                      // Export as text
                      const reportTitle = `Executive Report (${formatDate(selectedReport.createdAt)})`;
                      let reportContent = `${reportTitle}\n\n`;
                      
                      selectedReport.articles.forEach(article => {
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
    </div>
  );
}