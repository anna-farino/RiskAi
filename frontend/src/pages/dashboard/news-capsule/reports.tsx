import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Activity, AlertCircle, Apple, BarChart2, BookOpen, Building, Chrome, Download, 
  FileText, Shield, Zap, EyeOff, Eye, History, Filter, Laptop, Monitor, Smartphone,
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// Helper function to get OS-specific connection title
function getOSConnectionTitle(targetOS?: string): string {
  if (!targetOS) return "OS Connection";
  if (targetOS.includes("Microsoft")) return "Microsoft Connection";
  if (targetOS.includes("Apple")) return "Apple Connection";
  if (targetOS.includes("Linux")) return "Linux Connection";
  if (targetOS.includes("Chrome")) return "Google Connection";
  if (targetOS.includes("Android")) return "Android Connection";
  if (targetOS.includes("All Applications")) return "Platform Impact";
  return "OS Connection";
}

/**
 * Determines if an article is relevant to a specific OS by analyzing the content
 * Returns true if the article should be included for this OS, false otherwise
 */
function isArticleRelevantForOS(article: any, targetOS: string): boolean {
  // Always show all articles for the "All Applications" view
  if (targetOS === "All Applications") return true;
  
  // Normalize content 
  const title = article.title?.toLowerCase() || "";
  const threatName = article.threatName?.toLowerCase() || "";
  const summary = article.summary?.toLowerCase() || "";
  const impacts = article.impacts?.toLowerCase() || "";
  
  // Universal threats that affect all platforms
  if (title.includes("data breach") || 
      title.includes("breach") || 
      title.includes("critical security") || 
      title.includes("exposes customer") ||
      title.includes("sophisticated hack") ||
      title.includes("widely-used") ||
      threatName.includes("data breach") ||
      threatName.includes("credential exposure")) {
    return true;
  }
  
  // Extract OS keyword from the target OS
  const osKeyword = targetOS.split(" ")[0].toLowerCase(); // microsoft, apple, linux, chrome, android
  
  // Android specific filtering
  if (osKeyword === "android") {
    return title.includes("android") || 
           threatName.includes("android") || 
           title.includes("mobile") || 
           title.includes("smartphone") ||
           summary.includes("android") ||
           impacts.includes("android") ||
           threatName.includes("mobile");
  }
  
  // Windows/Microsoft specific filtering
  if (osKeyword === "microsoft") {
    return title.includes("windows") || 
           threatName.includes("windows") || 
           title.includes("microsoft") || 
           title.includes(" ms ") ||  
           title.includes("ms-") ||
           threatName.includes("microsoft") ||
           threatName.includes(" ms ") ||
           threatName.includes("ms-") ||
           summary.includes("windows") ||
           summary.includes("microsoft") ||
           summary.includes(" ms ") ||
           summary.includes("ms-") ||
           impacts.includes("windows") ||
           impacts.includes("microsoft") ||
           impacts.includes(" ms ") ||
           impacts.includes("ms-") ||
           (title.includes("pc") && !title.includes("android"));
  }
  
  // Apple/MacOS specific filtering
  if (osKeyword === "apple") {
    return title.includes("apple") || 
           title.includes("mac") || 
           title.includes("ios") ||
           threatName.includes("apple") || 
           threatName.includes("mac") || 
           summary.includes("apple") ||
           summary.includes("mac") ||
           impacts.includes("apple") ||
           impacts.includes("mac") ||
           threatName.includes("ios");
  }
  
  // Linux specific filtering
  if (osKeyword === "linux") {
    return title.includes("linux") || 
           threatName.includes("linux") || 
           title.includes("unix") || 
           threatName.includes("unix") ||
           summary.includes("linux") ||
           summary.includes("unix") ||
           impacts.includes("linux") ||
           impacts.includes("unix");
  }
  
  // Chrome specific filtering
  if (osKeyword === "chrome") {
    return title.includes("chrome") || 
           threatName.includes("chrome") || 
           title.includes("browser") || 
           threatName.includes("browser") ||
           summary.includes("chrome") ||
           summary.includes("browser") ||
           impacts.includes("chrome") ||
           impacts.includes("browser") ||
           (title.includes("web") && title.includes("exploit"));
  }
  
  // Default to not showing
  return false;
}

// Helper function to process content and make it OS-specific
function getOSConnectionContent(content: string, targetOS?: string, title?: string): string {
  if (!content) return "Not specified";
  if (!targetOS) return content;
  
  // Special handling for All Applications view
  if (targetOS.includes("All Applications")) {
    return content; // Show original content for all applications view
  }
  
  // Replace Microsoft references with the appropriate OS vendor
  const osVendor = targetOS.split(" ")[0]; // Get first part (Microsoft, Apple, Linux, Google)
  
  // Special handling for Android articles
  if (targetOS.includes("Android") && title && title.toLowerCase().includes("android")) {
    return `This vulnerability affects ${targetOS} systems. Update your Android OS and applications immediately.`;
  }
  
  // Special handling for Linux articles that mention Linux in the title
  if (targetOS.includes("Linux") && title && title.toLowerCase().includes("linux")) {
    return `This vulnerability affects ${targetOS} systems. Apply security updates immediately.`;
  }
  
  // Special handling for articles about specific OS in title
  const osKeyword = targetOS.split(" ")[0].toLowerCase(); // microsoft, apple, linux, chrome
  if (title && title.toLowerCase().includes(osKeyword)) {
    return `This vulnerability affects ${targetOS} systems. Apply security updates.`;
  }
  
  // Handle content appropriately based on context and selected OS
  const lowerContent = content.toLowerCase();
  
  // For Microsoft/Windows, show original content
  if (targetOS.toLowerCase().includes("microsoft") || targetOS.toLowerCase().includes("windows")) {
    return content;
  }
  
  // When viewing non-Microsoft OS, we need special handling
  
  // 1. If content explicitly says "does not affect Microsoft" - keep that message for other systems too
  if ((lowerContent.includes("does not affect microsoft") || 
       lowerContent.includes("does not impact microsoft") ||
       lowerContent.includes("no direct threats") ||
       lowerContent.includes("this vulnerability does not affect microsoft")) &&
      !(lowerContent.includes("does not affect any") || lowerContent.includes("does not impact any"))) {
    
    // Keep the negative message for other systems as well
    return `This vulnerability does not affect ${targetOS} systems.`;
  }
  
  // 2. If content explicitly mentions Microsoft as affected, keep it but replace Microsoft with target OS
  if (lowerContent.includes("affects microsoft") || 
      lowerContent.includes("impacts microsoft") ||
      lowerContent.includes("microsoft connection") ||
      lowerContent.includes("microsoft systems")) {
      
    // Replace Microsoft references with target OS
    return content
      .replace(/Microsoft/g, targetOS.split('/')[0].trim())
      .replace(/Windows/g, targetOS.split('/')[0].trim());
  }
  
  // 3. If it's a generic "not applicable" or "no impact" message with no specific OS mentioned
  if (lowerContent.includes("not applicable") || 
      lowerContent.includes("no impact") ||
      (lowerContent.includes("does not") && 
       (lowerContent.includes("affect") || lowerContent.includes("impact")))) {
    
    // Generic message with no OS - assume it applies to current OS too
    return `This threat does not affect ${targetOS} systems.`;
  }

  // Otherwise, adapt the content for the specified OS
  return content
    .replace(/Microsoft Impact: /g, '')
    .replace(/Microsoft Connection: /g, '')
    .replace(/Microsoft Connection/g, `${osVendor} Connection`)
    .replace(/Microsoft/g, osVendor)
    .replace(/MS-/g, `${osVendor}-`)
    .replace(/ MS /g, ` ${osVendor} `)
    .replace(/Windows/g, targetOS.split(" ")[0]); // Replace Windows with current OS vendor
}

interface ThreatReport {
  id: string;
  title: string;
  threatName: string;
  occurrences: number;
  articles: any[];
  lastReported: string;
  microsoftImpact: string;
  osConnection?: string; // New field for OS-specific content
  businessImpacts: string[];
}

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
  const { data: reports, isLoading: reportsLoading } = useQuery<ThreatReport[]>({
    queryKey: ['/api/news-capsule/reports/threats'],
    staleTime: 60000, // 1 minute
  });
  
  // Query to get all articles for the history view
  const { data: articles, isLoading: articlesLoading } = useQuery<any[]>({
    queryKey: ['/api/news-capsule/articles'],
    staleTime: 60000, // 1 minute
  });
  
  // Update allArticles when articles are loaded
  useEffect(() => {
    if (articles && Array.isArray(articles)) {
      console.log("Articles loaded:", articles.length);
      setAllArticles(articles);
    }
  }, [articles]);
  
  // Get visible reports (excluding hidden ones)
  const visibleReports = reports?.filter(report => {
    // First filter by hidden reports
    if (hiddenReports.includes(report.id)) return false;
    
    // If viewing "All", show all reports
    if (targetOS === "All Applications") return true;
    
    // When viewing specific OS, only show reports that have at least one article that impacts that OS
    return report.articles.some(article => isArticleRelevantForOS(article, targetOS));
  }) || [];
  
  // Toggle report visibility
  const toggleReportVisibility = (reportId: string) => {
    if (hiddenReports.includes(reportId)) {
      setHiddenReports(hiddenReports.filter(id => id !== reportId));
    } else {
      setHiddenReports([...hiddenReports, reportId]);
    }
  };
  
  // Function to export reports in the News Capsule Pro format
  const exportToFormat = () => {
    if (!visibleReports || visibleReports.length === 0) {
      toast({
        title: "No reports available",
        description: "There are no reports available to export.",
        variant: "destructive",
      });
      return;
    }
    
    // Create formatted text for each report
    const formattedReports = visibleReports.map(report => {
      // Filter articles based on OS selection using our smart filter
      const filteredArticles = report.articles.filter(article => 
        targetOS === "All Applications" ? true : isArticleRelevantForOS(article, targetOS)
      );
      
      // Format each article in the standard News Capsule Pro format
      const articlesContent = filteredArticles.map(article => {
        return [
          `Title: ${article.title}`,
          `Threat Name(s): ${article.threatName}`,
          `Summary: ${article.summary}`,
          `Impacts: ${getOSConnectionContent(article.impacts, targetOS, article.title)}`,
          `Attack Vector: ${article.attackVector || "Unknown attack vector"}`,
          `${getOSConnectionTitle(targetOS)}: ${getOSConnectionContent(article.microsoftConnection, targetOS, article.title)}`,
          `Source: ${article.sourcePublication}`
        ].join('\n');
      }).join('\n\n');
      
      return articlesContent;
    }).join('\n\n');
    
    // Create the final report content
    const fullContent = formattedReports;
    
    const blob = new Blob([fullContent], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `news-capsule-pro-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Report exported",
      description: "Your News Capsule Pro has been exported.",
    });
  };
  
  // Function to export reports in JSON format
  const exportToJson = () => {
    if (!visibleReports || visibleReports.length === 0) {
      toast({
        title: "No reports available",
        description: "There are no reports available to export.",
        variant: "destructive",
      });
      return;
    }
    
    // Create a modified version of visible reports with filtered articles
    const filteredReports = visibleReports.map(report => {
      return {
        ...report,
        articles: report.articles.filter(article => 
          targetOS === "All Applications" ? true : isArticleRelevantForOS(article, targetOS)
        )
      };
    });
    
    const blob = new Blob([JSON.stringify(filteredReports, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `threat-reports-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Reports exported",
      description: "The reports have been exported as a JSON file.",
    });
  };
  
  // Function to clear report history
  const clearReportHistory = () => {
    // Call the API to clear report history
    fetch('/api/news-capsule/reports/history', {
      method: 'DELETE',
    })
      .then(() => {
        // Refresh the reports data
        fetch('/api/news-capsule/reports/threats')
          .then(res => res.json())
          .then(data => {
            // Need to refresh the reports query
            setTimeout(() => {
              window.location.reload();
            }, 500);
          });
        
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
    fetch(`/api/news-capsule/articles/${articleToDelete}`, {
      method: 'DELETE',
    })
      .then(() => {
        // Refresh the article list
        fetch('/api/news-capsule/articles')
          .then(res => res.json())
          .then(data => {
            console.log("Articles after delete:", data.length);
            setAllArticles(data);
          });
        
        // Refresh reports data
        fetch('/api/news-capsule/reports/threats')
          .then(res => res.json())
          .then(data => {
            // We need to refresh the reports query
            // The window.location.reload will be removed soon
            setTimeout(() => {
              window.location.reload();
            }, 500);
          });
        
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
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Article History</DialogTitle>
            <DialogDescription>
              Select articles to include in your reports. Articles marked for reporting will be included in generated threat reports.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto pr-6 -mr-6 mt-4">
            {articlesLoading ? (
              <div className="py-4 text-center">Loading articles...</div>
            ) : allArticles && allArticles.length > 0 ? (
              <div className="space-y-4">
                {allArticles.map((article) => (
                  <div key={article.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id={`article-${article.id}`}
                          checked={article.markedForReporting}
                          onCheckedChange={(checked) => {
                            // Call the API to update the article status
                            fetch(`/api/news-capsule/articles/${article.id}`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ 
                                markedForReporting: checked 
                              }),
                            })
                              .then(() => {
                                // Refresh the article list
                                fetch('/api/news-capsule/articles')
                                  .then(res => res.json())
                                  .then(data => {
                                    console.log("Articles refreshed:", data.length);
                                    setAllArticles(data);
                                  });
                                
                                // Refresh reports data
                                fetch('/api/news-capsule/reports/threats')
                                  .then(res => res.json())
                                  .then(data => {
                                    // We need to refresh the reports query
                                    // The window.location.reload will be removed soon
                                    setTimeout(() => {
                                      window.location.reload();
                                    }, 500);
                                  });
                                
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
                          }}
                        />
                        <label 
                          htmlFor={`article-${article.id}`}
                          className="font-medium text-sm cursor-pointer"
                        >
                          {article.title}
                        </label>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete article"
                        onClick={() => {
                          setArticleToDelete(article.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="pl-6 text-xs text-primary-500">
                      <Badge variant="outline" className="mr-2">
                        {article.threatName}
                      </Badge>
                      <span>{formatDate(new Date(article.createdAt))}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-gray-500">
                No articles found in history.
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-4">
            <Button onClick={() => setHistoryDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Threat Reports</h1>
          <p className="text-primary-600">Consolidated reports of cybersecurity threats for {targetOS}</p>
          {targetOS !== "All Applications" && (
            <p className="text-xs text-primary-500 mt-1">
              <span className="inline-flex items-center">
                <Shield className="h-3 w-3 mr-1" />
                Showing threats specific to {targetOS} and cross-platform issues
              </span>
            </p>
          )}
          
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
          
          {reports && reports.length > 0 && hiddenReports.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center" 
              onClick={() => setHiddenReports([])}
            >
              <Eye className="h-4 w-4 mr-1" />
              Show All ({reports.length})
            </Button>
          )}
          
          <Button 
            variant="default" 
            size="sm" 
            className="flex items-center" 
            onClick={exportToFormat}
            disabled={!visibleReports.length}
          >
            <Download className="h-4 w-4 mr-1" />
            Export my News Capsule
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center" 
            onClick={exportToJson}
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
      {reports && reports.length > 0 && (
        <div className="flex items-center justify-between bg-gray-50 rounded-md p-2 mb-4">
          <div className="text-sm">
            Showing {visibleReports.length} of {reports.length} reports
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
      
      {reportsLoading ? (
        <div className="py-6 text-center">Loading reports...</div>
      ) : reports && reports.length > 0 ? (
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
                      className="h-8 w-8"
                      title="Hide this report"
                      onClick={() => toggleReportVisibility(report.id)}
                    >
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    </Button>
                    
                    {/* Export this report button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Export this report"
                      onClick={() => {
                        // Format articles in the same way as the full export
                        const articlesContent = report.articles.map(article => {
                          return [
                            `Title: ${article.title}`,
                            `Threat Name(s): ${article.threatName}`,
                            `Summary: ${article.summary}`,
                            `Impacts: ${article.impacts}`,
                            `Attack Vector: ${article.attackVector || "Unknown attack vector"}`,
                            `${getOSConnectionTitle(targetOS)}: ${getOSConnectionContent(article.microsoftConnection, targetOS)}`,
                            `Source: ${article.sourcePublication}`
                          ].join('\n');
                        }).join('\n\n');
                        
                        // Create blob and download
                        const blob = new Blob([articlesContent], { type: "text/plain;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `my-news-capsule-${report.id}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        toast({
                          title: "Report exported",
                          description: `The "${report.threatName}" report has been exported to your News Capsule.`,
                        });
                      }}
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
