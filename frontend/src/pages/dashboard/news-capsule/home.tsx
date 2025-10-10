import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateOnly } from "@/utils/date-utils";
import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
import { 
  FileText, 
  Search, 
  ExternalLink, 
  Calendar,
  Building,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Download,
  Trash2
} from "lucide-react";
import type { CapsuleArticle } from "@shared/db/schema/news-capsule/index";
import type { Report } from "@shared/db/schema/reports";
import { useFetch } from "@/hooks/use-fetch";

// Add interface for Report with Articles
interface ReportWithArticles extends Report {
  articles: CapsuleArticle[];
}

export default function Home() {
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [dateRange, setDateRange] = useState<{startDate?: Date; endDate?: Date}>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const reportsPerPage = 9; // 3 columns x 3 rows
  
  // Export state
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('filtered');
  
  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ReportWithArticles | null>(null);
  
  // Get query client instance
  const queryClient = useQueryClient();
  const fetchWithAuth = useFetch();
  const { toast } = useToast();
  const navigate = useNavigate();


  // Note: Article management functions removed - this page now shows executive reports

  // Fetch executive reports
  const { data: reports = [], isLoading } = useQuery<ReportWithArticles[]>({
    queryKey: ["/api/news-capsule/reports"],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/news-capsule/reports', {
        method: "GET",
      });
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
  });

  // Still fetch articles for statistics in the toolbar
  const { data: articles = [] } = useQuery<CapsuleArticle[]>({
    queryKey: ["/api/news-capsule/articles"],
  });

  // Date range change handler
  const handleDateRangeChange = (newDateRange: {startDate?: Date; endDate?: Date}) => {
    setDateRange(newDateRange);
    setCurrentPage(1);
  };

  // Filter reports based on search criteria
  const filteredReports = reports.filter((report) => {
    const matchesSearch = searchTerm === "" || 
      (report.topic && report.topic.toLowerCase().includes(searchTerm.toLowerCase())) ||
      report.articles.some(article => 
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.threatName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.summary.toLowerCase().includes(searchTerm.toLowerCase())
      );
    

    
    const reportDate = new Date(report.createdAt);
    const matchesDateRange = (!dateRange.startDate || reportDate >= dateRange.startDate) &&
                            (!dateRange.endDate || reportDate <= dateRange.endDate);
    
    return matchesSearch && matchesDateRange;
  });

  // Sort reports by date (newest first)
  const sortedReports = [...filteredReports].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Pagination
  const totalPages = Math.ceil(sortedReports.length / reportsPerPage);
  const startIndex = (currentPage - 1) * reportsPerPage;
  const paginatedReports = sortedReports.slice(startIndex, startIndex + reportsPerPage);



  // Handle report selection to view in reports page
  const handleViewReport = (report: ReportWithArticles) => {
    navigate(`/dashboard/news-capsule/reports/${report.id}`);
  };

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
      toast({
        title: "Success",
        description: "Report deleted successfully",
      });
      setShowDeleteDialog(false);
      setReportToDelete(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete report",
      });
    },
  });

  // Handle delete report
  const handleDeleteReport = (e: React.MouseEvent, report: ReportWithArticles) => {
    e.stopPropagation(); // Prevent card click
    setReportToDelete(report);
    setShowDeleteDialog(true);
  };

  const confirmDeleteReport = () => {
    if (!reportToDelete) return;
    deleteReportMutation.mutate(reportToDelete.id);
  };

  // Export functions
  const handleExportPDF = async () => {
    const reportsToExport = exportScope === 'all' ? reports : sortedReports;
    
    if (reportsToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "No Reports",
        description: "No reports available to export",
      });
      return;
    }

    try {
      toast({
        title: "Generating PDF",
        description: `Exporting ${reportsToExport.length} report(s)...`,
      });

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '800px';
      container.style.padding = '40px';
      container.style.backgroundColor = '#ffffff';
      container.style.fontFamily = 'Arial, sans-serif';
      
      let htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #000;">
          <h1 style="text-align: center; margin-bottom: 30px; font-size: 24pt; color: #000;">RisqAI Executive Reports</h1>
          <p style="text-align: center; margin-bottom: 40px; font-size: 12pt; color: #666;">Generated: ${new Date().toLocaleDateString()}</p>
      `;
      
      reportsToExport.forEach((report, reportIndex) => {
        htmlContent += `
          <div style="margin-bottom: 40px; page-break-inside: avoid;">
            <h2 style="font-size: 18pt; margin-bottom: 15px; color: #000; border-bottom: 2px solid #9333EA; padding-bottom: 8px;">
              ${report.topic || `Report ${reportIndex + 1}`}
            </h2>
            <p style="font-size: 10pt; color: #666; margin-bottom: 20px;">
              Created: ${formatDateOnly(report.createdAt)} | Articles: ${report.articles.length}
            </p>
        `;
        
        report.articles.forEach((article, articleIndex) => {
          htmlContent += `
            <div style="margin-bottom: 25px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid;">
              <h3 style="font-size: 13pt; margin-bottom: 10px; color: #000;">${articleIndex + 1}. ${article.title}</h3>
              <p style="margin-bottom: 6px; font-size: 10pt;"><strong>Threat:</strong> ${article.threatName}</p>
              <p style="margin-bottom: 6px; font-size: 10pt;"><strong>CVE:</strong> ${article.vulnerabilityId}</p>
              <p style="margin-bottom: 6px; font-size: 10pt;"><strong>Target OS:</strong> ${article.targetOS}</p>
              <p style="margin-bottom: 12px; line-height: 1.5; font-size: 10pt; text-align: justify;">${article.summary}</p>
            </div>
          `;
        });
        
        htmlContent += '</div>';
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
      
      const filename = exportScope === 'all' 
        ? `All_Executive_Reports_${new Date().toISOString().split('T')[0]}.pdf`
        : `Filtered_Executive_Reports_${new Date().toISOString().split('T')[0]}.pdf`;
      
      pdf.save(filename);
      document.body.removeChild(container);
      
      toast({
        title: "Export Complete",
        description: `${reportsToExport.length} report(s) exported to PDF`,
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        variant: "destructive",
        title: "Export Error",
        description: "Error creating PDF. Please try again.",
      });
    }
  };

  const handleExportWord = async () => {
    const reportsToExport = exportScope === 'all' ? reports : sortedReports;
    
    if (reportsToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "No Reports",
        description: "No reports available to export",
      });
      return;
    }

    try {
      toast({
        title: "Generating Word Document",
        description: `Exporting ${reportsToExport.length} report(s)...`,
      });

      const sections = [];
      
      // Title
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "RisqAI Executive Reports",
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
      
      // Date
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${new Date().toLocaleDateString()}`,
              font: "Cambria",
              size: 20
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        })
      );
      
      reportsToExport.forEach((report, reportIndex) => {
        // Report heading
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: report.topic || `Report ${reportIndex + 1}`,
                font: "Cambria",
                size: 24,
                bold: true
              })
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          })
        );
        
        // Report metadata
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Created: ${formatDateOnly(report.createdAt)} | Articles: ${report.articles.length}`,
                font: "Cambria",
                size: 18,
                italics: true,
                color: "666666"
              })
            ],
            spacing: { after: 200 }
          })
        );
        
        report.articles.forEach((article, articleIndex) => {
          // Article title
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${articleIndex + 1}. ${article.title}`,
                  font: "Cambria",
                  size: 22,
                  bold: true
                })
              ],
              spacing: { before: 200, after: 120 }
            })
          );
          
          // Article metadata
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Threat: ${article.threatName} | CVE: ${article.vulnerabilityId} | Target OS: ${article.targetOS}`,
                  font: "Cambria",
                  size: 18,
                  color: "444444"
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
                  text: article.summary,
                  font: "Cambria",
                  size: 20
                })
              ],
              spacing: { after: 200 }
            })
          );
        });
      });
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: sections
        }]
      });
      
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filename = exportScope === 'all' 
        ? `All_Executive_Reports_${new Date().toISOString().split('T')[0]}.docx`
        : `Filtered_Executive_Reports_${new Date().toISOString().split('T')[0]}.docx`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: `${reportsToExport.length} report(s) exported to Word`,
      });
    } catch (error) {
      console.error('Word export error:', error);
      toast({
        variant: "destructive",
        title: "Export Error",
        description: "Error creating Word document. Please try again.",
      });
    }
  };

  return (
    <>
      {/* Collapsible Unified Toolbar Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md mb-0 transition-all duration-300">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="h-6 w-6 text-purple-400" />
            <span className="text-xl font-semibold text-white">Reports Dashboard</span>
          </div>

          {/* 3-Column Layout */}
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Column 1: Navigation & Actions */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Navigation & Actions</span>
              </div>
              
              <div className="space-y-1">
                {/* Row 1 - Navigation Buttons */}
                <div className="grid grid-cols-2 gap-1">
                  <Link 
                    to="/dashboard/news-capsule/research" 
                    className="inline-flex items-center justify-center h-8 text-xs px-3 font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    View Articles
                  </Link>
                  <Link 
                    to="/dashboard/news-capsule/reports" 
                    className="inline-flex items-center justify-center h-8 text-xs px-3 font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors"
                  >
                    <BarChart3 className="mr-1 h-3 w-3" />
                    View Reports
                  </Link>
                </div>

                {/* Row 2 - Create New Report (Full Width) */}
                <Link 
                  to="/dashboard/news-capsule/research" 
                  className="inline-flex items-center justify-center w-full h-8 text-xs px-3 font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors"
                >
                  <FileText className="mr-1 h-3 w-3" />
                  Create New Report
                </Link>
              </div>
            </div>

            {/* Column 2: Search & Filter */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Search & Filter</span>
              </div>
              
              <div className="space-y-1">
                {/* Row 1 - Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    placeholder="search reports..."
                    className="pl-9 h-8 text-xs bg-slate-800/50 border border-slate-600/50 text-slate-200 placeholder:text-slate-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Row 2 - Quick Filters */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      const today = new Date();
                      const sevenDaysAgo = new Date();
                      sevenDaysAgo.setDate(today.getDate() - 7);
                      handleDateRangeChange({ startDate: sevenDaysAgo, endDate: today });
                    }}
                    className="h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors flex items-center justify-center"
                  >
                    Past 7 Days
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const thirtyDaysAgo = new Date();
                      thirtyDaysAgo.setDate(today.getDate() - 30);
                      handleDateRangeChange({ startDate: thirtyDaysAgo, endDate: today });
                    }}
                    className="h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors flex items-center justify-center"
                  >
                    Past 30 Days
                  </button>
                </div>
              </div>
            </div>

            {/* Column 3: Export Center */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-3">
                <Download className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Export Center</span>
              </div>
              
              <div className="space-y-1">
                {/* Row 1 - Export Scope */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setExportScope('all')}
                    className={`h-8 px-3 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                      exportScope === 'all'
                        ? 'bg-purple-500/40 text-white border-purple-500/60'
                        : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border-purple-500/40'
                    }`}
                  >
                    Export All Reports
                  </button>
                  <button
                    onClick={() => setExportScope('filtered')}
                    className={`h-8 px-3 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                      exportScope === 'filtered'
                        ? 'bg-purple-500/40 text-white border-purple-500/60'
                        : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border-purple-500/40'
                    }`}
                  >
                    Export Filtered
                  </button>
                </div>

                {/* Row 2 - Export Format */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={handleExportPDF}
                    className="h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors flex items-center justify-center"
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    PDF Format
                  </button>
                  <button
                    onClick={handleExportWord}
                    className="h-8 px-3 text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded border border-purple-500/40 transition-colors flex items-center justify-center"
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    Word Format
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-purple-400" />
            <span className="text-lg font-medium text-white">Executive Reports</span>
            <div className="flex items-center gap-2 ml-4">
              <div className="h-4 w-px bg-slate-600"></div>
              <span className="text-sm text-slate-400">
                {paginatedReports.length} of {sortedReports.length} reports
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-slate-800/50 rounded-md p-6 space-y-4">
                  <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-700 rounded"></div>
                    <div className="h-3 bg-slate-700 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : paginatedReports.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">No executive reports found</h3>
            <p className="text-slate-500">
              {reports.length === 0 
                ? "Create reports by adding analyzed articles through the Research page." 
                : "Try adjusting your filters or search terms."}
            </p>
          </div>
        ) : (
          <>
            {/* 3-Column Responsive Grid Layout for Executive Reports */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedReports.map((report) => {
                return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-md p-6 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer"
                  onClick={() => handleViewReport(report)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                        {report.topic || formatDateOnly(report.createdAt)}
                      </h3>
                      <div className="flex items-center gap-1.5 text-orange-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">
                          Generated {new Date(report.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      <div className="flex items-center gap-1 text-slate-400">
                        <FileText className="h-4 w-4" />
                        <span className="text-xs">{report.articles.length} articles</span>
                      </div>
                    </div>
                  </div>

                  {/* Priority Items */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-400">Key Priority Items</span>
                    </div>
                    {report.articles.length > 0 ? (
                      <div className="space-y-2">
                        {(() => {
                          const threatNames = report.articles.map(a => a.threatName);
                          const highPriorityCount = report.articles.filter(a => 
                            a.threatName.toLowerCase().includes('critical') || 
                            a.threatName.toLowerCase().includes('high')
                          ).length;
                          const cveCount = report.articles.filter(a => a.vulnerabilityId !== 'Unspecified').length;
                          const affectedIndustries = [...new Set(report.articles.map(a => {
                            // Extract industries from impacts or microsoftConnection fields
                            const text = `${a.impacts} ${a.microsoftConnection}`.toLowerCase();
                            if (text.includes('healthcare') || text.includes('medical')) return 'Healthcare';
                            if (text.includes('financial') || text.includes('banking') || text.includes('finance')) return 'Financial';
                            if (text.includes('government') || text.includes('public sector')) return 'Government';
                            if (text.includes('education') || text.includes('academic')) return 'Education';
                            if (text.includes('retail') || text.includes('commerce')) return 'Retail';
                            if (text.includes('manufacturing') || text.includes('industrial')) return 'Manufacturing';
                            if (text.includes('energy') || text.includes('utilities')) return 'Energy';
                            if (text.includes('technology') || text.includes('tech') || text.includes('software')) return 'Technology';
                            return null;
                          }).filter(industry => industry !== null))];
                          const industryList = affectedIndustries.length > 0 ? affectedIndustries.slice(0, 2).join(', ') : 'Cross-industry';
                          const totalThreats = report.articles.length;
                          
                          const items = [];
                          const threatCount = threatNames.length;
                          
                          // Add threat names first (prioritize actual threats)
                          threatNames.forEach(threatName => {
                            if (items.length < 4) {
                              items.push({ text: threatName, type: 'threat' });
                            }
                          });
                          
                          // Fill remaining slots with summary information
                          if (items.length < 4 && highPriorityCount > 0) {
                            items.push({ text: `${highPriorityCount} high-priority threat${highPriorityCount > 1 ? 's' : ''}`, type: 'fallback' });
                          }
                          
                          if (items.length < 4 && cveCount > 0) {
                            items.push({ text: `${cveCount} CVE vulnerability${cveCount > 1 ? 'ies' : 'y'} identified`, type: 'fallback' });
                          }
                          
                          if (items.length < 4) {
                            items.push({ text: industryList, type: 'fallback' });
                          }
                          
                          if (items.length < 4) {
                            items.push({ text: `${totalThreats} total threat${totalThreats > 1 ? 's' : ''} analyzed`, type: 'fallback' });
                          }
                          
                          // Ensure exactly 4 items
                          const displayItems = items.slice(0, 4);
                          while (displayItems.length < 4) {
                            displayItems.push({ text: `Report generated ${new Date(report.createdAt).toLocaleDateString()}`, type: 'fallback' });
                          }
                          
                          return displayItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              <div className="w-1 h-1 bg-purple-400 rounded-full flex-shrink-0"></div>
                              <span className={`truncate ${item.type === 'threat' ? 'text-slate-300' : 'text-purple-400'}`}>
                                {item.text}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No priority items available.</p>
                    )}
                  </div>



                  {/* Report Metadata */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="h-3 w-3 text-slate-400" />
                      <span className="text-blue-400">{report.articles.length} article{report.articles.length !== 1 ? 's' : ''} analyzed</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="h-3 w-3 text-slate-400" />
                      <span className="text-purple-400/70">
                        {(() => {
                          const uniqueSources = report.articles 
                            ? new Set(report.articles.map(a => a.sourcePublication)).size 
                            : 0;
                          return `${uniqueSources} ${uniqueSources === 1 ? 'source' : 'sources'}`;
                        })()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="h-3 w-3 text-slate-400" />
                      <span className="text-orange-500">
                        {(() => {
                          const cveCount = report.articles 
                            ? report.articles.filter(a => a.vulnerabilityId && a.vulnerabilityId !== 'Unspecified').length 
                            : 0;
                          return `${cveCount} ${cveCount === 1 ? 'CVE' : 'CVEs'} identified`;
                        })()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Building className="h-3 w-3 text-slate-400" />
                      <span className="text-rose-400">{report.articles.length > 0 ? report.articles[0].targetOS : 'N/A'}</span>
                    </div>
                  </div>



                  {/* Report Actions */}
                  <div className="space-y-2 pt-4 border-t border-slate-700/50">
                    {/* View Report Action */}
                    <Link 
                      to={`/dashboard/news-capsule/reports/${report.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="flex items-center justify-center w-full h-7 text-xs px-3 font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white rounded-md border border-purple-500/40 transition-all duration-200"
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      View Full Report
                    </Link>

                    {/* Delete Report Action */}
                    <button
                      onClick={(e) => handleDeleteReport(e, report)}
                      className="flex items-center justify-center w-full h-7 text-xs px-3 font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white rounded-md border border-red-500/40 transition-all duration-200"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete Report
                    </button>
                  </div>
                </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="text-white border-slate-700 hover:bg-slate-700/50"
                >
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={
                          currentPage === page
                            ? "bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white"
                            : "text-white border-slate-700 hover:bg-slate-700/50"
                        }
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="text-white border-slate-700 hover:bg-slate-700/50"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report?
              {reportToDelete && (
                <div className="mt-2 p-3 bg-slate-800/50 rounded-md border border-slate-700/50">
                  <p className="text-sm text-white font-medium">
                    {reportToDelete.topic || formatDateOnly(reportToDelete.createdAt)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {reportToDelete.articles.length} article{reportToDelete.articles.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              <p className="mt-3 text-sm text-slate-400">
                This action cannot be undone. The report will be permanently deleted.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false);
                setReportToDelete(null);
              }}
              disabled={deleteReportMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <Button 
              onClick={confirmDeleteReport}
              disabled={deleteReportMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteReportMutation.isPending ? "Deleting..." : "Delete Report"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}