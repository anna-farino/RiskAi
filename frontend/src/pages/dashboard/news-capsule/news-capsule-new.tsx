import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, BookOpen, Shield, Building, FileText, Laptop, Apple, Monitor, Chrome, Activity, Smartphone } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";

export default function NewsCapsule() {
  // Initialize URL from sessionStorage if it exists
  const getInitialUrl = () => {
    try {
      // First try session storage (current session)
      const sessionUrl = sessionStorage.getItem('articleUrl');
      if (sessionUrl) return sessionUrl;
      
      // Then try localStorage (persistent)
      const savedUrl = localStorage.getItem('lastProcessedUrl');
      if (savedUrl) return savedUrl;
    } catch (e) {
      console.warn('Error accessing storage:', e);
    }
    return "";
  };
  
  const [url, setUrl] = useState<string>(getInitialUrl());
  
  // Initialize selectedOS from localStorage if it exists
  const getInitialOS = () => {
    try {
      const savedOS = localStorage.getItem('selectedOS');
      if (savedOS) return savedOS;
    } catch (e) {
      console.warn('Error accessing localStorage for OS:', e);
    }
    return "Microsoft / Windows"; // Default
  };
  
  const [selectedOS, setSelectedOS] = useState<string>(getInitialOS());
  
  // Save selected OS to localStorage when it changes
  const handleOSChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOS = e.target.value;
    setSelectedOS(newOS);
    try {
      localStorage.setItem('selectedOS', newOS);
    } catch (e) {
      console.warn('Error saving OS to localStorage:', e);
    }
  };
  const { toast } = useToast();
  
  // Query to get today's articles
  const todayArticles = useQuery<any[]>({
    queryKey: [serverUrl + '/api/news-capsule/articles/today'],
    queryFn: async () => {
      const result = await fetch(serverUrl + '/api/news-capsule/articles/today', {
        method: 'GET',
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject()
        }
      })
      return result.json()
    },
    staleTime: 60000, // 1 minute
  });
  
  // Query to get earlier articles
  const earlierArticles = useQuery<any[]>({
    queryKey: [serverUrl + '/api/news-capsule/articles/earlier'],
    queryFn: async () => {
      const result = await fetch(serverUrl + '/api/news-capsule/articles/earlier', {
        method: 'GET',
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...csfrHeaderObject()
        }
      })
      return result.json()
    },
    staleTime: 60000, // 1 minute
  });
  
  // Mutation to process an article URL and automatically generate a summary
  const { mutate: processArticleUrl, isPending: isProcessing } = useMutation({
    mutationFn: async (urlData: { url: string, targetOS: string }) => {
      return apiRequest('POST', serverUrl + '/api/news-capsule/process-article', urlData);
    },
    onSuccess: () => {
      // DO NOT reset URL field to allow testing with different OS
      // Store current URL in session storage to persist across page reloads
      try {
        sessionStorage.setItem('articleUrl', url);
        localStorage.setItem('lastProcessedUrl', url);
      } catch (e) {
        console.warn('Could not store URL in session storage:', e);
      }
      

      console.log("Refetching articles...")
      todayArticles.refetch()
      earlierArticles.refetch()
      
      // Show success toast with note about URL persistence
      toast({
        title: "Article Summarized",
        description: "The article has been summarized. URL kept for testing with other OS options.",
        duration: 2000,
      });
    },
    onError: (error) => {
      console.error("Failed to process article:", error);
      toast({
        title: "Error",
        description: "Failed to process the article. Please ensure it's a valid URL.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update the URL value and store in sessionStorage
    const newUrl = e.target.value;
    setUrl(newUrl);
    
    // Save to storage for persistence
    try {
      sessionStorage.setItem('articleUrl', newUrl);
      if (newUrl) {
        localStorage.setItem('lastProcessedUrl', newUrl);
      } else {
        sessionStorage.removeItem('articleUrl');
        localStorage.removeItem('lastProcessedUrl');
      }
    } catch (e) {
      console.warn('Error saving URL to storage:', e);
    }
  };
  
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }
    // Process the article URL automatically with selected OS
    processArticleUrl({ url, targetOS: selectedOS });
    
    toast({
      title: "Processing Article",
      description: `Extracting information from URL for ${selectedOS}...`,
    });
  };
  
  // Function to get OS vendor name from the selected OS
  const getOSVendor = (os: string) => {
    if (os.includes("All")) return "All";
    if (os.includes("Microsoft")) return "Microsoft";
    if (os.includes("Apple")) return "Apple";
    if (os.includes("Linux")) return "Linux";
    if (os.includes("Chrome")) return "Google";
    if (os.includes("Android")) return "Android";
    return "Microsoft"; // Default
  };

  return (
    <div className="container mx-auto px-4 py-8 font-sans">
      <div className="mb-4">
        <h1 className="text-3xl font-bold mb-2">News Capsule Pro</h1>
        <p className="text-primary-600">Automatically summarize cybersecurity news articles focusing on threats and {getOSVendor(selectedOS)} connections.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          {/* OS Selector Component - Same width as URL card */}
          <div 
            className={cn(
              "mb-4 p-5 border-2 border-border bg-background"
            )} 
          >
            <div>
              <strong>Target Operating System:</strong>
            </div>
            <div style={{ marginTop: "10px" }}>
              <select 
                className={cn(
                  "w-full p-2 text-base bg-foreground border border-border",
                  "text-background"
                )}
                value={selectedOS} 
                onChange={handleOSChange}
              >
                <option value="All Operating Systems">All Operating Systems</option>
                <option value="Microsoft / Windows">Microsoft / Windows</option>
                <option value="Apple / MacOS">Apple / MacOS</option>
                <option value="Linux">Linux</option>
                <option value="ChromeOS">ChromeOS</option>
                <option value="Android">Android</option>
              </select>
              <div style={{ marginTop: "5px", fontSize: "14px" }}>
                Content will be customized for selected OS
              </div>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Submit Article URL</CardTitle>
              <CardDescription>Enter the URL of a cybersecurity article to automatically summarize</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div>
                  <label htmlFor="articleUrl" className="block mb-1 font-medium">
                    Article URL
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative w-full">
                      <Input
                        id="articleUrl"
                        name="url"
                        placeholder="https://example.com/article"
                        value={url}
                        onChange={handleUrlChange}
                        className="w-full pr-8"
                      />
                      {url && (
                        <button
                          type="reset"
                          onClick={() => {
                            setUrl("");
                            try {
                              sessionStorage.removeItem('articleUrl');
                              localStorage.removeItem('lastProcessedUrl');
                            } catch (e) {
                              console.warn('Error clearing URL from storage:', e);
                            }
                          }}
                          className={cn(
                            "absolute -right-2 top-1/2 transform -translate-y-1/2",
                            "text-muted-foreground hover:ring-transparent bg-transparent",
                            "hover:border-transparent"
                          )}
                          title="Clear URL"
                        >
                          <span className="text-xl font-bold">✕</span>
                        </button>
                      )}
                    </div>
                    <Button type="submit" disabled={isProcessing} className="whitespace-nowrap">
                      {isProcessing ? "Processing..." : "Submit"}
                    </Button>
                  </div>
                  {url && (
                    <div className="mt-2 text-sm text-gray-600">
                      URL will be preserved after processing to allow testing with different OS options
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
              <CardDescription>News Capsule Pro automatically processes cybersecurity articles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <div className="bg-primary-100 rounded-full h-6 w-6 flex items-center justify-center mt-0.5">
                    <span className="text-primary-800 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Enter Article URL</h3>
                    <p className="text-sm text-primary-600">Paste any URL to a cybersecurity article reporting on vulnerabilities or threats</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="bg-primary-100 rounded-full h-6 w-6 flex items-center justify-center mt-0.5">
                    <span className="text-primary-800 font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Automatic Processing</h3>
                    <p className="text-sm text-primary-600">Our system extracts key information including threats, impacts, and {getOSVendor(selectedOS)} connections</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="bg-primary-100 rounded-full h-6 w-6 flex items-center justify-center mt-0.5">
                    <span className="text-primary-800 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium">OS-Specific Content</h3>
                    <p className="text-sm text-primary-600">Content is customized for your selected operating system (Windows, MacOS, Linux, ChromeOS, Android)</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="bg-primary-100 rounded-full h-6 w-6 flex items-center justify-center mt-0.5">
                    <span className="text-primary-800 font-semibold text-sm">4</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Review Summary</h3>
                    <p className="text-sm text-primary-600">View the formatted summary with key details presented in a consistent format</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-8">
          {/* Today's Summaries */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Today's Summaries</CardTitle>
                <CardDescription>Articles summarized in the current session</CardDescription>
              </div>
              {((todayArticles.data && todayArticles.data.length > 0) || 
                (earlierArticles.data && earlierArticles.data.length > 0)) && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    // Show confirmation dialog before deleting all
                    if (window.confirm("Are you sure you want to clear all article summaries? This will remove them from the News Capsule Pro but keep them in Reports.")) {
                      apiRequest('DELETE', serverUrl + '/api/news-capsule/articles')
                        .then(() => {
                          todayArticles.refetch()
                          earlierArticles.refetch()
                          // Do NOT invalidate reports - reports should remain intact
                          toast({
                            title: "All Summaries Cleared",
                            description: "All article summaries have been removed from News Capsule Pro.",
                          });
                        })
                        .catch((error) => {
                          console.error("Failed to clear summaries:", error);
                          toast({
                            title: "Error",
                            description: "Failed to clear summaries. Please try again.",
                            variant: "destructive",
                          });
                        });
                    }
                  }}
                >
                  Clear All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {todayArticles.isLoading ? (
                <div className="py-6 text-center">Loading articles...</div>
              ) : todayArticles.data && Array.isArray(todayArticles.data) && todayArticles.data?.length > 0 ? (
                <div className="space-y-4">
                  {todayArticles.data?.map((article: any) => (
                    <Card key={article.id} className="overflow-hidden font-sans">
                      <CardHeader className="bg-primary-50 pb-2">
                        <CardTitle className="text-lg">{article.title}</CardTitle>
                        <div className="flex items-center text-xs text-primary-500">
                          <Shield className="h-3 w-3 mr-1" /> 
                          {article.threatName}
                          <span className="mx-2">•</span>
                          {formatDate(article.createdAt)}
                          {article.targetOS && (
                            <>
                              <span className="mx-2">•</span>
                              {article.targetOS.includes("All") ? (
                                <Activity className="h-3 w-3 mr-1" />
                              ) : article.targetOS.includes("Microsoft") ? (
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
                      </CardHeader>
                      <CardContent className="pt-4 pb-0">
                        <div className="space-y-3 text-sm">
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
                            <p>{article.impacts}</p>
                          </div>
                          
                          <div>
                            <div className="font-semibold flex items-center mb-1">
                              <FileText className="h-4 w-4 mr-1" /> {article.targetOS ? getOSVendor(article.targetOS) : "Microsoft"} Connection
                            </div>
                            <p>{
                              // Strip any leftover inappropriate OS mentions when viewing with a different OS selected
                              article.targetOS?.includes("Microsoft") 
                                ? article.microsoftConnection 
                                : article.microsoftConnection
                                  ? article.microsoftConnection
                                      // Remove any mention of Microsoft when viewing a non-Microsoft OS report
                                      .replace(/Microsoft Impact: /g, '')
                                      .replace(/Microsoft Connection: /g, '')
                                      .replace(/Microsoft Connection/g, `${getOSVendor(article.targetOS || '')} Connection`)
                                  : "No specific connection information"
                            }</p>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="text-xs text-primary-500 pt-3 pb-3">
                        Source: {article.sourcePublication}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-primary-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No articles have been summarized today.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Earlier Searches Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Earlier Searches</CardTitle>
                <CardDescription>Articles from previous sessions</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {earlierArticles.isLoading ? (
                <div className="py-6 text-center">Loading earlier articles...</div>
              ) : earlierArticles.data && Array.isArray(earlierArticles.data) && earlierArticles.data?.length > 0 ? (
                <div className="space-y-4">
                  {earlierArticles.data?.map((article: any) => (
                    <Card key={article.id} className="overflow-hidden font-sans">
                      <CardHeader className="bg-background pb-2">
                        <CardTitle className="text-lg">{article.title}</CardTitle>
                        <div className="flex items-center text-xs text-primary-500">
                          <Shield className="h-3 w-3 mr-1" /> 
                          {article.threatName}
                          <span className="mx-2">•</span>
                          {formatDate(article.createdAt)}
                          {article.targetOS && (
                            <>
                              <span className="mx-2">•</span>
                              {article.targetOS.includes("All") ? (
                                <Activity className="h-3 w-3 mr-1" />
                              ) : article.targetOS.includes("Microsoft") ? (
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
                      </CardHeader>
                      <CardContent className="pt-4 pb-0">
                        <div className="space-y-3 text-sm">
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
                            <p>{article.impacts}</p>
                          </div>
                          
                          <div>
                            <div className="font-semibold flex items-center mb-1">
                              <FileText className="h-4 w-4 mr-1" /> {article.targetOS ? getOSVendor(article.targetOS) : "Microsoft"} Connection
                            </div>
                            <p>{
                              // Strip any leftover inappropriate OS mentions when viewing with a different OS selected
                              article.targetOS?.includes("Microsoft") 
                                ? article.microsoftConnection 
                                : article.microsoftConnection
                                  ? article.microsoftConnection
                                      // Remove any mention of Microsoft when viewing a non-Microsoft OS report
                                      .replace(/Microsoft Impact: /g, '')
                                      .replace(/Microsoft Connection: /g, '')
                                      .replace(/Microsoft Connection/g, `${getOSVendor(article.targetOS || '')} Connection`)
                                  : "No specific connection information"
                            }</p>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="text-xs text-primary-500 pt-3 pb-3">
                        Source: {article.sourcePublication}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-primary-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No earlier articles found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
