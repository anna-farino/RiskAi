import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArticleWithAnalysis } from '@/lib/news-capsule-types';
import { useToast } from '@/hooks/use-toast';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentReport: ArticleWithAnalysis | null;
  allReports: ArticleWithAnalysis[];
}

const ExportModal: React.FC<ExportModalProps> = ({ 
  isOpen, 
  onClose, 
  currentReport, 
  allReports 
}) => {
  const [format, setFormat] = useState<string>("pdf");
  const [selectedReports, setSelectedReports] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<string>("current");
  const [previewContent, setPreviewContent] = useState<string>("");
  const { toast } = useToast();

  // Initialize selected reports when modal opens
  useEffect(() => {
    if (isOpen) {
      if (currentReport) {
        setSelectedReports([currentReport.article.id]);
        setActiveTab("current");
      } else if (allReports.length > 0) {
        setActiveTab("multiple");
        setSelectedReports([]);
      }
    }
  }, [isOpen, currentReport, allReports]);

  // Generate preview based on selected format and reports
  useEffect(() => {
    const reports = activeTab === "current" && currentReport 
      ? [currentReport]
      : allReports.filter(r => selectedReports.includes(r.article.id));
    
    if (reports.length === 0) {
      setPreviewContent("No reports selected for preview.");
      return;
    }

    generatePreview(reports, format);
  }, [format, selectedReports, activeTab, currentReport, allReports]);

  // Toggle selection of a report
  const toggleReportSelection = (id: number) => {
    setSelectedReports(prev => 
      prev.includes(id)
        ? prev.filter(reportId => reportId !== id)
        : [...prev, id]
    );
  };

  // Select all reports
  const selectAllReports = () => {
    setSelectedReports(allReports.map(report => report.article.id));
  };

  // Deselect all reports
  const deselectAllReports = () => {
    setSelectedReports([]);
  };

  // Generate preview content based on format
  const generatePreview = (reports: ArticleWithAnalysis[], exportFormat: string) => {
    switch (exportFormat) {
      case "markdown": 
        setPreviewContent(generateMarkdownPreview(reports));
        break;
      case "json":
        setPreviewContent(generateJsonPreview(reports));
        break;
      case "pdf":
      default:
        setPreviewContent(generatePdfPreview(reports));
        break;
    }
  };

  // Helper function to get impacts based on threat type
  const getImpacts = (report: ArticleWithAnalysis): string => {
    if (report.analysis.threats.length === 0) return "No specific impacts identified";
    
    const type = report.analysis.threats[0].type;
    switch(type) {
      case 'ransomware': return 'Data access, business continuity, and financial operations';
      case 'vulnerability': return 'System integrity, data security, and operational reliability';
      case 'malware': return 'Network security, data privacy, and system performance';
      case 'zero-day': return 'Critical infrastructure, sensitive data, and service availability';
      case 'exploit': return 'Application security, customer data, and business reputation';
      default: return 'General security posture and organizational trust';
    }
  };
  
  // Helper function to get Microsoft connection
  const getMicrosoftConnection = (report: ArticleWithAnalysis): string => {
    if (report.analysis.affectedProducts.length === 0) return "General Microsoft security advisory";
    
    return `Affects ${report.analysis.affectedProducts.map(p => p.name).join(', ')}${
      report.analysis.affectedProducts.some(p => p.versions) 
        ? ` (${report.analysis.affectedProducts.find(p => p.versions)?.versions})` 
        : ''
    }`;
  };
  
  // Generate PDF preview (text representation) - simplified format
  const generatePdfPreview = (reports: ArticleWithAnalysis[]): string => {
    // In a real PDF, we'd apply these styles using a PDF generation library
    // For preview purposes, we're adding a note about the font
    return `[DOCUMENT STYLING: Font family: Arial, Helvetica, Segoe UI, Roboto, sans-serif]

MICROSOFT SECURITY THREAT REPORT
${reports.length > 1 ? `(${reports.length} reports)` : ''}
-----------------------------
${reports.map((report, index) => `
Report ${index + 1}:

Title: 
${report.article.title}

Threat Name(s): 
${report.analysis.threats.length > 0 
  ? report.analysis.threats.map(t => `${t.name}${t.cve ? ` (${t.cve})` : ''}`).join(', ')
  : 'No specific threats identified'
}

Summary: 
${report.analysis.summary}

Impacts: 
${getImpacts(report)}

Microsoft Connection: 
${getMicrosoftConnection(report)}

Source of Initial Article: 
${report.article.source}

Security Severity: ${report.analysis.severity.toUpperCase()}
`).join('\n-----------------------------\n')}

Generated by News Capsule+ on ${new Date().toLocaleString()}
`;
  };

  // Generate Markdown preview - simplified format
  const generateMarkdownPreview = (reports: ArticleWithAnalysis[]): string => {
    return `# MICROSOFT SECURITY THREAT REPORT
Generated: ${new Date().toLocaleString()}
${reports.length > 1 ? `\n> Total Reports: ${reports.length}` : ''}

${reports.map((report, index) => `
## Report ${reports.length > 1 ? index + 1 : ''}

### Title
${report.article.title}

### Threat Name(s)
${report.analysis.threats.length > 0 
  ? report.analysis.threats.map(t => `- **${t.name}**${t.cve ? ` (${t.cve})` : ''}`).join('\n')
  : 'No specific threats identified'
}

### Summary
${report.analysis.summary}

### Impacts
${getImpacts(report)}

### Microsoft Connection
${getMicrosoftConnection(report)}

### Source of Initial Article
${report.article.source}

**Security Severity:** ${report.analysis.severity.toUpperCase()}
`).join('\n---\n')}

---
*Generated by News Capsule+*
`;
  };

  // Generate JSON preview - simplified format
  const generateJsonPreview = (reports: ArticleWithAnalysis[]): string => {
    const exportData = reports.map(report => ({
      title: report.article.title,
      threat_names: report.analysis.threats.length > 0 
        ? report.analysis.threats.map(t => ({
            name: t.name,
            cve: t.cve || null
          }))
        : [],
      summary: report.analysis.summary,
      impacts: getImpacts(report),
      microsoft_connection: getMicrosoftConnection(report),
      source: report.article.source,
      severity: report.analysis.severity,
      date: report.article.date,
      url: report.article.url
    }));
    
    return JSON.stringify({
      report_type: "MICROSOFT SECURITY THREAT REPORT",
      generated_at: new Date().toISOString(),
      report_count: reports.length,
      reports: exportData
    }, null, 2);
  };

  // Handle export action
  const handleExport = () => {
    const reports = activeTab === "current" && currentReport 
      ? [currentReport]
      : allReports.filter(r => selectedReports.includes(r.article.id));
    
    if (reports.length === 0) {
      toast({
        title: "No Reports Selected",
        description: "Please select at least one report to export",
        variant: "destructive"
      });
      return;
    }

    let content = "";
    let filename = "";
    let filetype = "";

    // Generate content based on format
    switch (format) {
      case "markdown":
        content = generateMarkdownPreview(reports);
        filename = `news-capsule-report-${new Date().toISOString().split('T')[0]}.md`;
        filetype = "text/markdown";
        break;
      case "json":
        content = generateJsonPreview(reports);
        filename = `news-capsule-report-${new Date().toISOString().split('T')[0]}.json`;
        filetype = "application/json";
        break;
      case "pdf":
      default:
        // For demonstration, we'll just download a text file with the PDF preview
        // In a real application, you would use a library like jsPDF to generate actual PDF files
        content = generatePdfPreview(reports);
        filename = `news-capsule-report-${new Date().toISOString().split('T')[0]}.txt`;
        filetype = "text/plain";
        break;
    }

    // Create download link
    const blob = new Blob([content], { type: filetype });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `${reports.length} report${reports.length !== 1 ? 's' : ''} exported as ${format.toUpperCase()}`,
      variant: "default"
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Reports</DialogTitle>
          <DialogDescription>
            Choose the reports and format you want to export
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow overflow-hidden">
          {/* Left side - Report selection */}
          <div className="md:col-span-1 border rounded-md p-4 overflow-hidden flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="current" disabled={!currentReport}>Current</TabsTrigger>
                <TabsTrigger value="multiple">Multiple</TabsTrigger>
              </TabsList>
              
              <TabsContent value="current" className="flex-grow overflow-hidden">
                {currentReport ? (
                  <div className="space-y-2 p-2">
                    <div className="font-medium text-sm">{currentReport.article.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Source: {currentReport.article.source}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Date: {currentReport.article.date}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium severity-${currentReport.analysis.severity}`}>
                        {currentReport.analysis.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground text-sm">No current report</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="multiple" className="flex-grow flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">
                    {selectedReports.length} of {allReports.length} selected
                  </div>
                  <div className="space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllReports}
                      disabled={allReports.length === 0}
                    >
                      All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={deselectAllReports}
                      disabled={selectedReports.length === 0}
                    >
                      None
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="flex-grow">
                  <div className="space-y-2">
                    {allReports.length > 0 ? (
                      allReports.map(report => (
                        <div 
                          key={report.article.id} 
                          className={`p-2 rounded border ${
                            selectedReports.includes(report.article.id) 
                              ? 'border-primary bg-primary/5'
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start">
                            <Checkbox 
                              id={`report-${report.article.id}`}
                              checked={selectedReports.includes(report.article.id)}
                              onCheckedChange={() => toggleReportSelection(report.article.id)}
                              className="mt-1 mr-2"
                            />
                            <div className="flex-grow">
                              <Label 
                                htmlFor={`report-${report.article.id}`}
                                className="font-medium text-sm cursor-pointer"
                              >
                                {report.article.title}
                              </Label>
                              <div className="text-xs text-muted-foreground mt-1">
                                {report.article.source} • {report.article.date}
                              </div>
                              <div className="mt-1">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium severity-${report.analysis.severity}`}>
                                  {report.analysis.severity.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-4 text-muted-foreground text-sm">
                        No reports available
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Right side - Format and preview */}
          <div className="md:col-span-2 flex flex-col space-y-4 overflow-hidden">
            {/* Format selection */}
            <div className="flex items-center space-x-4 p-2 border rounded-md">
              <div className="font-medium text-sm">Export Format:</div>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Content preview */}
            <div className="flex-grow border rounded-md overflow-hidden flex flex-col">
              <div className="bg-muted p-2 border-b font-medium text-sm">
                Preview
              </div>
              <ScrollArea className="flex-grow">
                <pre className={`p-4 text-xs whitespace-pre-wrap ${format === 'pdf' ? 'report-content' : 'font-mono'}`}>
                  {previewContent}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport}>
            Export {activeTab === "current" ? "Report" : `${selectedReports.length} Reports`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportModal;
