import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Activity, AlertCircle, Apple, BookOpen, Building, Chrome, Download, 
  FileText, Shield, EyeOff, Eye, History, Laptop, Monitor, Smartphone,
  Layers
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getOSConnectionContent, getOSConnectionTitle, isArticleRelevantForOS, ThreatReport } from "./reports/os-utils";
import { exportToFormat, exportToJson, getVisibleReports, handleFormatReport } from "./reports/report-utils";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";
import { CheckedState } from "@radix-ui/react-checkbox";
import HistoryDialog from "./reports/history-dialog";


export default function Reports() {
  const { toast } = useToast();
  const [hiddenReports, setHiddenReports] = useState<string[]>([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [allArticles, setAllArticles] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<number | null>(null);
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false);
  // Add state for target OS (read from localStorage with fallback to Microsoft)
  const [targetOS, setTargetOS] = useState<string>(
    localStorage.getItem('selectedOS') || 'Microsoft / Windows'
  );
  
  // Update targetOS when localStorage changes
  useEffect(() => {
    const storedOS = localStorage.getItem('selectedOS');
    if (storedOS) {
      setTargetOS(storedOS);
    }
  }, []);
  
  // Query to get threat reports
  const reportsQuery = useQuery<ThreatReport[]>({
    queryKey: ['/api/news-capsule/reports/threats'],
    queryFn: async () => {
      const response = await fetch(serverUrl + '/api/news-capsule/reports/threats', {
        method: 'GET',
        credentials: 'include',
        headers: { ...csfrHeaderObject() }
      })
      return response.json()
    },
    staleTime: 60000, // 1 minute
  });
  
  // Query to get all articles for the history view
  const articlesQuery = useQuery<any[]>({
    queryKey: ['/api/news-capsule/articles'],
    queryFn: async () => {
      const response = await fetch(serverUrl + '/api/news-capsule/articles', {
        method: 'GET',
        credentials: 'include',
        headers: { ...csfrHeaderObject() }
      })
      return response.json()
    },
    staleTime: 60000, // 1 minute
  });
  
  // Update allArticles when articles are loaded
  useEffect(() => {
    if (articlesQuery.data && Array.isArray(articlesQuery.data)) {
      console.log("Articles loaded:", articlesQuery.data.length);
      setAllArticles(articlesQuery.data);
    }
  }, [articlesQuery.data]);

  const visibleReports = getVisibleReports({
    reports: reportsQuery.data,
    hiddenReports,
    targetOS
  })
  // Toggle report visibility
  function toggleReportVisibility(reportId: string) {
    if (hiddenReports.includes(reportId)) {
      setHiddenReports(hiddenReports.filter(id => id !== reportId));
    } else {
      setHiddenReports([...hiddenReports, reportId]);
    }
  };
  
  // Function to clear report history
  const clearReportHistory = () => {
    fetch(serverUrl + '/api/news-capsule/reports/history', {
      method: 'DELETE',
    }).then(() => {
        reportsQuery.refetch()
        toast({
          title: "Report History Cleared",
          description: "All reports have been cleared from News Capsule Pro.",
        });
        // Close the dialog
        setClearHistoryDialogOpen(false);
      })
      .catch(error => {
        console.error('Error clearing report history:', error);
        toast({
          title: "Error",
          description: "Failed to clear report history.",
          variant: "destructive",
        });
        // Close the dialog
        setClearHistoryDialogOpen(false);
      });
  };
  
  // Function to handle article deletion
  const handleDeleteArticle = () => {
    if (articleToDelete === null) return;
    // Call the API to delete the article
    fetch(serverUrl + `/api/news-capsule/articles/${articleToDelete}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        ...csfrHeaderObject()
      }
    }).then(() => {
      articlesQuery.refetch()
      reportsQuery.refetch()
      
      toast({
        title: "Article deleted",
        description: "The article has been permanently deleted.",
      });
      // Close the dialog
      setDeleteDialogOpen(false);
      setArticleToDelete(null);
    })
    .catch(error => {
      console.error('Error deleting article:', error);
      toast({
        title: "Error",
        description: "Failed to delete article.",
        variant: "destructive",
      });
      // Close the dialog
      setDeleteDialogOpen(false);
      setArticleToDelete(null);
    });
  };


  function handleOnCheckChange(checked: CheckedState, article: any) {
    console.log("Checked:", checked)
    // Call the API to update the article status
    fetch(serverUrl + `/api/news-capsule/articles/${article.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...csfrHeaderObject()
      },
      body: JSON.stringify({ 
        markedForReporting: checked 
      }),
    })
      .then(() => {
        articlesQuery.refetch()
        reportsQuery.refetch()

        toast({
          title: checked ? "Added to Reports" : "Removed from Reports",
          description: checked 
            ? "This article will be included in threat reports." 
            : "This article will no longer be included in threat reports.",
        });
      })
      .catch(error => {
        console.error('Error updating article:', error);
        toast({
          title: "Error",
          description: "Failed to update article status.",
          variant: "destructive",
        });
      });
  }


  return (
    <div className="container mx-auto px-4 py-8 font-sans">
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this article? This action cannot be undone and will permanently remove the article from your reports.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="mt-6 flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setArticleToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteArticle}
            >
              Delete Article
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Clear History Confirmation Dialog */}
      <Dialog open={clearHistoryDialogOpen} onOpenChange={setClearHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Clear Report History</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all threat reports history? This will remove all articles from your reports but will not delete the articles themselves.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="mt-6 flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setClearHistoryDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={clearReportHistory}
            >
              Clear History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* History Dialog to Choose Reports */}
      <HistoryDialog
        historyDialogOpen={historyDialogOpen}
        setHistoryDialogOpen={setHistoryDialogOpen}
        allArticles={allArticles}
        setDeleteDialogOpen={setDeleteDialogOpen}
        setArticleToDelete={setArticleToDelete}
        articlesQuery={articlesQuery}
        handleOnCheckChange={handleOnCheckChange}
      />

      <div className="mb-8 gap-x-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Threat Reports</h1>
          <p className="text-primary-600">Consolidated reports of cybersecurity threats for {targetOS}</p>
          <p className="text-xs text-primary-500 mt-1">
            <span className="inline-flex items-center">
              <Shield className="h-3 w-3 mr-1" />
              {targetOS !== "All Applications" 
                ? `Showing threats specific to ${targetOS} and cross-platform issues`
                : `Showing threats concerning any OS`
              }
            </span>
          </p>
          
          {/* OS Selection */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button 
              variant={targetOS === "Microsoft / Windows" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                localStorage.setItem('selectedOS', 'Microsoft / Windows');
                setTargetOS('Microsoft / Windows');
              }}
              className="flex items-center gap-1"
            >
              <Laptop className="h-4 w-4" />
              Windows
            </Button>
            <Button 
              variant={targetOS === "Apple / MacOS" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                localStorage.setItem('selectedOS', 'Apple / MacOS');
                setTargetOS('Apple / MacOS');
              }}
              className="flex items-center gap-1"
            >
              <Apple className="h-4 w-4" />
              MacOS
            </Button>
            <Button 
              variant={targetOS === "Linux" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                localStorage.setItem('selectedOS', 'Linux');
                setTargetOS('Linux');
              }}
              className="flex items-center gap-1"
            >
              <Monitor className="h-4 w-4" />
              Linux
            </Button>
            <Button 
              variant={targetOS === "ChromeOS" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                localStorage.setItem('selectedOS', 'ChromeOS');
                setTargetOS('ChromeOS');
              }}
              className="flex items-center gap-1"
            >
              <Chrome className="h-4 w-4" />
              ChromeOS
            </Button>
            <Button 
              variant={targetOS === "Android" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                localStorage.setItem('selectedOS', 'Android');
                setTargetOS('Android');
              }}
              className="flex items-center gap-1"
            >
              <Smartphone className="h-4 w-4" />
              Android
            </Button>
            <Button 
              variant={targetOS === "All Applications" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                localStorage.setItem('selectedOS', 'All Applications');
                setTargetOS('All Applications');
              }}
              className="flex items-center gap-1"
            >
              <Layers className="h-4 w-4" />
              All
            </Button>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center" 
            onClick={() => setHistoryDialogOpen(true)}
          >
            <History className="h-4 w-4 mr-1" />
            Article History
          </Button>
          
          {reportsQuery.data && reportsQuery.data.length > 0 && hiddenReports.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center" 
              onClick={() => setHiddenReports([])}
            >
              <Eye className="h-4 w-4 mr-1" />
              Show All ({reportsQuery.data.length})
            </Button>
          )}
          
          <Button 
            variant="default" 
            size="sm" 
            className="flex items-center" 
            onClick={() => exportToFormat({ visibleReports, toast, targetOS })}
            disabled={!visibleReports.length}
          >
            <Download className="h-4 w-4 mr-1" />
            Export my News Capsule
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center" 
            onClick={() => exportToJson({ visibleReports, toast, targetOS })}
            disabled={!visibleReports.length}
          >
            <Download className="h-4 w-4 mr-1" />
            Export JSON
          </Button>
          
          <Button 
            variant="destructive" 
            size="sm" 
            className="flex items-center" 
            onClick={() => setClearHistoryDialogOpen(true)}
            disabled={!visibleReports.length}
          >
            <EyeOff className="h-4 w-4 mr-1" />
            Clear History
          </Button>
        </div>
      </div>
      
      {/* Status bar showing filter info */}
      {reportsQuery.data && reportsQuery.data?.length > 0 && (
        <div className="flex items-center justify-between bg-background rounded-md p-2 mb-4">
          <div className="text-sm">
            Showing {visibleReports.length} of {reportsQuery.data.length} reports
            {hiddenReports.length > 0 && ` (${hiddenReports.length} hidden)`}
            {targetOS !== "All Applications" && (
              <span className="ml-2 text-primary-500">
                • Filtered for {targetOS} and cross-platform threats
              </span>
            )}
          </div>
          {hiddenReports.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary-600 text-xs"
              onClick={() => setHiddenReports([])}
            >
              Show All
            </Button>
          )}
        </div>
      )}
      
      {reportsQuery.isLoading ? (
        <div className="py-6 text-center">Loading reports...</div>
      ) : reportsQuery.data && reportsQuery.data.length > 0 ? (
        <div className="space-y-8">
          {visibleReports.map((report) => (
            <Card key={report.id} className="overflow-hidden font-sans">
              <CardHeader className="bg-primary-50">
                <div className="flex justify-between items-start">
                  <div>
                    {/* No content here - removed title and date */}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="ml-2">
                      {report.occurrences} {report.occurrences === 1 ? 'occurrence' : 'occurrences'}
                    </Badge>
                    
                    {/* Hide this report button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-fit w-fit"
                      title="Hide this report"
                      onClick={() => toggleReportVisibility(report.id)}
                    >
                      <EyeOff className="h-4 w-4 " />
                    </Button>
                    
                    {/* Export this report button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-fit w-fit"
                      title="Export this report"
                      onClick={() => handleFormatReport(report, toast, targetOS)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {report.articles
                    .filter(article => {
                      // Use our intelligent article relevance function
                      return targetOS === "All Applications" ? true : isArticleRelevantForOS(article, targetOS);
                    })
                    .map((article) => (
                    <div key={article.id} className="overflow-hidden font-sans border border-gray-200 rounded-md">
                      <div className="bg-primary-50 py-3 px-4">
                        <div className="flex justify-between">
                          <div>
                            <h2 className="text-base font-medium mb-1">{article.title}</h2>
                            <div className="text-xs text-primary-500 mb-2">
                              Source: {article.sourcePublication}
                            </div>
                            <h3 className="text-base font-medium">
                              <span className="flex items-center">
                                <span className="text-primary-500 text-sm mr-1">Threat Details:</span> 
                                <span className="text-sm">{article.threatName}</span>
                              </span>
                            </h3>
                            <div className="flex items-center text-xs text-primary-500">
                              {article.targetOS && (
                                <>
                                  {article.targetOS.includes("Microsoft") ? (
                                    <Laptop className="h-3 w-3 mr-1" />
                                  ) : article.targetOS.includes("Apple") ? (
                                    <Apple className="h-3 w-3 mr-1" />
                                  ) : article.targetOS.includes("Linux") ? (
                                    <Monitor className="h-3 w-3 mr-1" />
                                  ) : article.targetOS.includes("Chrome") ? (
                                    <Chrome className="h-3 w-3 mr-1" />
                                  ) : article.targetOS.includes("Android") ? (
                                    <Smartphone className="h-3 w-3 mr-1" />
                                  ) : null}
                                  {article.targetOS}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 text-sm p-4">
                        <div>
                          <div className="font-semibold flex items-center mb-1">
                            <BookOpen className="h-4 w-4 mr-1" /> Summary
                          </div>
                          <p>{article.summary}</p>
                        </div>
                        
                        <div>
                          <div className="font-semibold flex items-center mb-1">
                            <Building className="h-4 w-4 mr-1" /> Impacts
                          </div>
                          <p>{
                            // Transform impacts field for OS-specific display
                            targetOS === "All Applications" 
                            ? article.impacts
                            : getOSConnectionContent(article.impacts, targetOS, article.title)
                          }</p>
                        </div>
                        
                        <div>
                          <div className="font-semibold flex items-center mb-1">
                            <Shield className="h-4 w-4 mr-1" /> Vulnerability ID
                          </div>
                          <p>{article.vulnerabilityId || "Unspecified"}</p>
                        </div>
                          
                        <div>
                          <div className="font-semibold flex items-center mb-1">
                            <Activity className="h-4 w-4 mr-1" /> Attack Vector
                          </div>
                          <p>{article.attackVector || "Unknown attack vector"}</p>
                        </div>

                        <div>
                          <div className="font-semibold flex items-center mb-1">
                            <FileText className="h-4 w-4 mr-1" /> 
                            {getOSConnectionTitle(targetOS)}
                          </div>
                          <p>{
                            // Transform Microsoft connection content to match selected OS
                            getOSConnectionContent(article.microsoftConnection, targetOS, article.title)
                          }</p>
                        </div>
                        
                        {/* Source moved to header area */}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-10 text-center text-primary-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>No threat reports available. Submit articles to generate reports.</p>
        </div>
      )}
    </div>
  );
}
