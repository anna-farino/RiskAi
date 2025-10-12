import { motion } from "framer-motion";
import { Link } from "react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateOnly } from "@/utils/date-utils";
// Note: AlertDialog imports removed - not needed for reports view
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
  UserCheck
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
  
  
  // Get query client instance
  const queryClient = useQueryClient();
  const fetchWithAuth = useFetch();

  // Note: Delete functionality removed for reports view - reports are managed on the Reports page


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
    // Store the selected report in session storage for the reports page
    sessionStorage.setItem('selectedCapsuleReport', JSON.stringify(report));
    // Navigate to reports page - this will be handled by Link component below
  };

  return (
    <>
      {/* Collapsible Unified Toolbar Container */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md mb-4 transition-all duration-300">
        <div className="p-6">
          {/* 3-Column Layout */}
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Column 1: Navigation & Actions */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-4">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="h-5 w-5 text-purple-400" />
                <span className="text-base font-medium text-purple-400">Navigation & Actions</span>
              </div>
              
              <div className="space-y-4">
                {/* Research Action */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Research Portal</span>
                    <span>{articles.filter(a => a.markedForReporting).length} processed</span>
                  </div>
                  <Link 
                    to="/dashboard/news-capsule/research" 
                    className="inline-flex items-center justify-center w-full h-8 text-sm px-3 font-medium bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white hover:text-[#00FFFF] rounded-md transition-all duration-200"
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Begin Research
                  </Link>
                </div>
                
                {/* Reports Action */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Executive Reports</span>
                    <span>{reports.length} ready</span>
                  </div>
                  <Link 
                    to="/dashboard/news-capsule/reports" 
                    className="inline-flex items-center justify-center w-full h-8 text-sm px-3 font-medium bg-[#9333EA] hover:bg-[#9333EA]/80 text-white hover:text-[#00FFFF] rounded-md transition-all duration-200"
                  >
                    <BarChart3 className="mr-2 h-3 w-3" />
                    View Reports
                  </Link>
                </div>
                
                {/* Status Overview */}
                <div className="pt-2 border-t border-purple-500/20">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-slate-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{articles.filter(a => a.threatName !== "Low").length} priority</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <UserCheck className="h-3 w-3" />
                      <span>{reports.length} executive</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Search & Filter */}
            <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-md p-4">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-5 w-5 text-purple-400" />
                <span className="text-base font-medium text-purple-300">Search & Filter</span>
              </div>
              
              <div className="space-y-4">
                {/* Search Input */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-purple-300">Search Reports</h4>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="search reports..."
                      className="pl-10 h-8 text-xs bg-slate-800/70 border border-slate-700 text-white placeholder:text-slate-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Quick Filters */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-purple-300">Quick Filters</h4>
                  <div className="space-y-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs w-full transition-colors justify-center border border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50"
                      onClick={() => {
                        const today = new Date();
                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(today.getDate() - 7);
                        handleDateRangeChange({ startDate: sevenDaysAgo, endDate: today });
                      }}
                    >
                      Past 7 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs w-full transition-colors justify-center border border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50"
                      onClick={() => {
                        const today = new Date();
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(today.getDate() - 30);
                        handleDateRangeChange({ startDate: thirtyDaysAgo, endDate: today });
                      }}
                    >
                      Past 30 Days
                    </Button>
                  </div>
                </div>

                {/* Results Status */}
                <div className="pt-2 border-t border-purple-500/20">
                  <div className="text-xs text-slate-400 text-center">
                    {sortedReports.length} {sortedReports.length === 1 ? 'result' : 'results'}
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Date Range & Actions */}
            <div className="bg-[#9333EA]/10 border border-[#9333EA]/30 rounded-md p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-purple-400" />
                <span className="text-base font-medium text-purple-300">Date Range</span>
              </div>
              
              <div className="space-y-4">
                {/* Date Range Inputs */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-purple-300">Custom Range</h4>
                  <div className="space-y-2">
                    <div className="relative">
                      <Input 
                        type="date"
                        placeholder="From Date"
                        value={dateRange.startDate ? new Date(dateRange.startDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined;
                          handleDateRangeChange({...dateRange, startDate: date});
                        }}
                        className="h-8 text-xs bg-slate-800/70 border-slate-700/50 text-white pl-3 pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <Input 
                        type="date"
                        placeholder="To Date"
                        value={dateRange.endDate ? new Date(dateRange.endDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : undefined;
                          handleDateRangeChange({...dateRange, endDate: date});
                        }}
                        className="h-8 text-xs bg-slate-800/70 border-slate-700/50 text-white pl-3 pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-purple-300">Actions</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs w-full justify-center border border-slate-700 bg-slate-800/70 text-white hover:bg-slate-700/50"
                    onClick={() => {
                      setSearchTerm("");
                      setDateRange({});
                      setCurrentPage(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>

                {/* Export Status */}
                <div className="pt-2 border-t border-purple-500/20">
                  <div className="flex items-center gap-1 text-xs text-slate-400 justify-center">
                    <FileText className="h-3 w-3" />
                    <span>Export available</span>
                  </div>
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
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <FileText className="h-3 w-3" />
                      <span>{report.articles.length} article{report.articles.length !== 1 ? 's' : ''} analyzed</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Building className="h-3 w-3" />
                      <span>Primary OS: {report.articles.length > 0 ? report.articles[0].targetOS : 'N/A'}</span>
                    </div>
                  </div>



                  {/* Report Actions */}
                  <div className="space-y-3 pt-4 border-t border-slate-700/50">
                    {/* Report Action */}
                    <Link 
                      to="/dashboard/news-capsule/reports" 
                      onClick={() => handleViewReport(report)}
                      className="flex items-center justify-center w-full h-9 text-sm px-4 font-semibold bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-all duration-200"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View Full Report
                    </Link>


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

      {/* Note: Delete dialog removed - reports are managed on the Reports page */}
    </>
  );
}