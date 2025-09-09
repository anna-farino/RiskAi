import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RisqWidget, WidgetGrid } from '@/components/widgets/RisqWidget';
import { Newspaper, AlertTriangle, TrendingUp, Radar, Settings, BarChart4, Search, Database, ShieldAlert, Bell, Lock, LineChart, Loader2, ArrowRight } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { useFetch } from "@/hooks/use-fetch";

export default function Dashboard() {
  const navigate = useNavigate();
  const fetchWithAuth = useFetch();
  
  // Fetch News Radar keywords
  const { data: newsKeywords } = useQuery({
    queryKey: ['news-radar-keywords-dashboard'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/news-tracker/keywords');
      if (!response.ok) {
        throw new Error(`Failed to fetch news keywords: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60000, // Keywords don't change often
  });

  // Fetch News Radar articles with enhanced real-time updates
  const { data: newsArticles, isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery({
    queryKey: ['news-radar-articles-dashboard', newsKeywords],
    queryFn: async () => {
      // Get active keyword IDs
      const activeKeywordIds = newsKeywords?.filter((k: any) => k.active !== false).map((k: any) => k.id) || [];
      const keywordParams = activeKeywordIds.map((id: string) => `keywordIds=${id}`).join('&');
      const url = `/api/news-tracker/articles?limit=10&sortBy=createdAt&order=desc${keywordParams ? '&' + keywordParams : ''}`;
      
      const response = await fetchWithAuth(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch news articles: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!newsKeywords, // Only fetch articles after keywords are loaded
    refetchInterval: 30000, // Refresh every 30 seconds for more responsive updates
    staleTime: 15000, // Consider data stale after 15 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch News Radar article count
  const { data: newsCount } = useQuery({
    queryKey: ['news-radar-count-dashboard', newsKeywords],
    queryFn: async () => {
      // Get active keyword IDs
      const activeKeywordIds = newsKeywords?.filter((k: any) => k.active !== false).map((k: any) => k.id) || [];
      const keywordParams = activeKeywordIds.map((id: string) => `keywordIds=${id}`).join('&');
      const url = `/api/news-tracker/articles/count${keywordParams ? '?' + keywordParams : ''}`;
      
      const response = await fetchWithAuth(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch news article count: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.count || 0;
    },
    enabled: !!newsKeywords, // Only fetch count after keywords are loaded
    refetchInterval: 30000, // Refresh at same rate as articles
    staleTime: 15000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch Threat Tracker keywords
  const { data: threatKeywords } = useQuery({
    queryKey: ['threat-tracker-keywords-dashboard'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/threat-tracker/keywords');
      if (!response.ok) {
        throw new Error(`Failed to fetch threat keywords: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60000, // Keywords don't change often
  });

  // Fetch Threat Tracker articles with real-time updates
  const { data: threatArticles, isLoading: threatLoading, error: threatError, refetch: refetchThreats } = useQuery({
    queryKey: ['threat-tracker-articles-dashboard', threatKeywords],
    queryFn: async () => {
      // Get active keyword IDs
      const activeKeywordIds = threatKeywords?.filter((k: any) => k.active !== false).map((k: any) => k.id) || [];
      const keywordParams = activeKeywordIds.map((id: string) => `keywordIds=${id}`).join('&');
      const url = `/api/threat-tracker/articles?${keywordParams ? keywordParams + '&' : ''}limit=50`;
      
      const response = await fetchWithAuth(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch threat articles: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!threatKeywords, // Only fetch articles after keywords are loaded
    refetchInterval: 20000, // Refresh every 20 seconds for critical threat data
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch Threat Tracker article count
  const { data: threatCount } = useQuery({
    queryKey: ['threat-tracker-count-dashboard', threatKeywords],
    queryFn: async () => {
      // Get active keyword IDs
      const activeKeywordIds = threatKeywords?.filter((k: any) => k.active !== false).map((k: any) => k.id) || [];
      const keywordParams = activeKeywordIds.map((id: string) => `keywordIds=${id}`).join('&');
      const url = `/api/threat-tracker/articles/count${keywordParams ? '?' + keywordParams : ''}`;
      
      const response = await fetchWithAuth(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch threat article count: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.count || 0;
    },
    enabled: !!threatKeywords, // Only fetch count after keywords are loaded
    refetchInterval: 20000, // Refresh at same rate as articles
    staleTime: 10000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch News Capsule reports with real-time updates
  const { data: capsuleReports, isLoading: capsuleLoading, error: capsuleError, refetch: refetchCapsule } = useQuery({
    queryKey: ['news-capsule-reports-dashboard'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/news-capsule/reports?limit=6&sortBy=createdAt&order=desc');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch capsule reports: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 45000, // Refresh every 45 seconds for report processing updates
    staleTime: 20000, // Consider data stale after 20 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  
  // Format publish date helper with date-only semantics
  const formatPublishDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    
    // Extract just the date part (YYYY-MM-DD) and create at noon UTC to avoid timezone shifting
    const datePart = typeof dateString === 'string' ? dateString.split('T')[0] : dateString;
    const date = new Date(datePart + 'T12:00:00.000Z');
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  // Get source badge styling
  const getSourceBadge = (article: any) => {
    const source = article.source?.toLowerCase() || article.url?.split('/')[2]?.replace('www.', '') || 'unknown';
    return {
      name: source.charAt(0).toUpperCase() + source.slice(1),
      style: 'bg-slate-700/50 text-slate-300 border border-slate-600/30'
    };
  };

  // Get priority badge based on keywords or content
  const getPriorityBadge = (article: any) => {
    const keywords = Array.isArray(article.detectedKeywords) ? article.detectedKeywords : [];
    const title = article.title?.toLowerCase() || '';
    const summary = article.summary?.toLowerCase() || '';
    
    // High priority indicators
    const criticalKeywords = ['critical', 'urgent', 'exploit', 'zero-day', 'breach', 'ransomware', 'vulnerability'];
    const hasCritical = criticalKeywords.some(keyword => 
      title.includes(keyword) || summary.includes(keyword) || 
      keywords.some((k: any) => k.keyword?.toLowerCase().includes(keyword))
    );
    
    if (hasCritical) {
      return { level: 'HIGH', style: 'bg-red-500/20 text-red-400 border-red-500/30' };
    }
    
    // Medium priority indicators
    const mediumKeywords = ['security', 'update', 'patch', 'warning'];
    const hasMedium = mediumKeywords.some(keyword => 
      title.includes(keyword) || summary.includes(keyword) || 
      keywords.some((k: any) => k.keyword?.toLowerCase().includes(keyword))
    );
    
    if (hasMedium) {
      return { level: 'MED', style: 'bg-black text-cyan-400 border border-cyan-500/30' };
    }
    
    return { level: 'INFO', style: 'bg-black text-purple-400 border border-purple-500/30' };
  };

  // Enhanced article click handler
  const handleArticleClick = (article: any) => {
    // Store selected article data and navigate
    sessionStorage.setItem('selectedArticle', JSON.stringify(article));
    navigate('/dashboard/news/home', { state: { selectedArticle: article } });
  };

  // Get threat severity based on content analysis
  const getThreatSeverity = (article: any) => {
    const keywords = Array.isArray(article.detectedKeywords) ? article.detectedKeywords : [];
    const title = article.title?.toLowerCase() || '';
    const summary = article.summary?.toLowerCase() || '';
    
    // Critical threat indicators
    const criticalKeywords = ['zero-day', 'ransomware', 'breach', 'exploit', 'critical', 'urgent', 'active'];
    const hasCritical = criticalKeywords.some(keyword => 
      title.includes(keyword) || summary.includes(keyword) || 
      keywords.some((k: any) => k.keyword?.toLowerCase().includes(keyword))
    );
    
    if (hasCritical) {
      return { 
        level: 'CRITICAL', 
        style: 'bg-red-500/10 border-red-500/20 text-red-400',
        icon: 'red'
      };
    }
    
    // High threat indicators
    const highKeywords = ['vulnerability', 'malware', 'attack', 'compromise', 'phishing'];
    const hasHigh = highKeywords.some(keyword => 
      title.includes(keyword) || summary.includes(keyword) || 
      keywords.some((k: any) => k.keyword?.toLowerCase().includes(keyword))
    );
    
    if (hasHigh) {
      return { 
        level: 'HIGH', 
        style: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        icon: 'orange'
      };
    }
    
    // Medium threat indicators
    const mediumKeywords = ['security', 'warning', 'patch', 'update'];
    const hasMedium = mediumKeywords.some(keyword => 
      title.includes(keyword) || summary.includes(keyword) || 
      keywords.some((k: any) => k.keyword?.toLowerCase().includes(keyword))
    );
    
    if (hasMedium) {
      return { 
        level: 'MEDIUM', 
        style: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        icon: 'purple'
      };
    }
    
    return { 
      level: 'INFO', 
      style: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      icon: 'blue'
    };
  };

  // Enhanced threat article click handler
  const handleThreatClick = (article: any) => {
    sessionStorage.setItem('selectedThreatArticle', JSON.stringify(article));
    navigate('/dashboard/threat/home', { state: { selectedArticle: article } });
  };

  // Get report status styling and information
  const getReportStatus = (report: any) => {
    if (!report) return { label: 'Unknown', style: 'bg-gray-500/20 text-gray-400', indicator: 'bg-gray-400' };
    
    // Since reports in the database only have id, userId, createdAt, and articles array,
    // determine status based on available data
    const hasArticles = report.articles && Array.isArray(report.articles) && report.articles.length > 0;
    const createdAt = report.createdAt ? new Date(report.createdAt) : null;
    const now = new Date();
    const ageInMinutes = createdAt ? (now.getTime() - createdAt.getTime()) / (1000 * 60) : 0;
    
    if (hasArticles) {
      // Report has articles - assume processed
      return { 
        label: 'Processed', 
        style: 'bg-emerald-500/20 text-emerald-400', 
        indicator: 'bg-emerald-400' 
      };
    } else if (ageInMinutes < 10) {
      // Recent report without articles - might still be processing
      return { 
        label: 'Processing', 
        style: 'bg-blue-500/20 text-blue-400', 
        indicator: 'bg-blue-400 animate-pulse' 
      };
    } else {
      // Older report without articles - might be empty or failed
      return { 
        label: 'Empty', 
        style: 'bg-gray-500/20 text-gray-400', 
        indicator: 'bg-gray-400' 
      };
    }
  };

  // Enhanced capsule report click handler
  const handleCapsuleClick = (report: any) => {
    sessionStorage.setItem('selectedCapsuleReport', JSON.stringify(report));
    navigate('/dashboard/news-capsule/reports', { state: { selectedReport: report } });
  };

  
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto py-4">
        {/* Dashboard introduction section - new design with brand styling */}
        <div className="mb-6">
          <div className="bg-black border border-gray-600/30 rounded-md p-6 backdrop-blur shadow-xl">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-purple-500 to-cyan-500 p-[1px] rounded-md shadow-glow">
                <div className="bg-black p-3 rounded-md">
                  <ShieldAlert className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                  Your RisqAi Dashboard
                </h1>
                <p className="text-gray-400 mt-1">
                  Real-time security intelligence at your fingertips
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main navigation widgets */}
        <WidgetGrid>
          <RisqWidget
            title="News Radar"
            description="Latest security news"
            icon={<Newspaper className="w-10 h-10 text-purple-400" />}
            variant="interactive"
            delay={0.1}
            onClick={() => navigate("/dashboard/news/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  {newsLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading latest articles...
                    </div>
                  ) : newsError ? (
                    <div className="flex items-center justify-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-red-400">API connection failed</span>
                      <button 
                        onClick={() => refetchNews()} 
                        className="text-cyan-400 hover:text-purple-400 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : newsArticles && newsArticles.length > 0 ? (
                    <div className="w-full">
                      <button 
                        onClick={() => navigate('/dashboard/news/home')}
                        className="w-full text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-purple-300 hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-purple-200 hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-between"
                      >
                        <span>View All Articles</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            }
          >
            <div className="space-y-2 flex-1">
              {newsLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-black rounded-md p-2 border border-gray-600/30 animate-pulse">
                      <div className="flex justify-between items-start mb-1">
                        <div className="w-12 h-4 bg-gray-600 rounded"></div>
                        <div className="w-10 h-3 bg-gray-600 rounded"></div>
                      </div>
                      <div className="space-y-1">
                        <div className="w-full h-3 bg-gray-600 rounded"></div>
                        <div className="w-3/4 h-3 bg-gray-600 rounded"></div>
                      </div>
                    </div>
                  ))}
                </>
              ) : newsError ? (
                <div className="bg-black rounded-md p-3 border border-red-500/30 text-center">
                  <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                  <p className="text-xs text-red-400">Failed to load articles</p>
                  <p className="text-xs text-gray-500 mt-1">Check your connection</p>
                </div>
              ) : newsArticles && newsArticles.length > 0 ? (
                <>
                  {/* News Overview Summary Bar */}
                  <div className="bg-black rounded-md p-2 border border-gray-600/30 mb-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-300 font-medium">Recent Articles</span>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-gray-400">Critical</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-gray-400">High</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-gray-400">Info</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 py-2">
                      {newsArticles.slice(0, 5).map((article: any, index: number) => {
                        const priorityBadge = getPriorityBadge(article);
                        const buttonStyles = {
                          'HIGH': {
                            bg: 'bg-gradient-to-r from-red-500/20 to-red-600/20',
                            border: 'border-red-500/40',
                            text: 'text-red-300',
                            hover: 'hover:from-red-500/30 hover:to-red-600/30 hover:border-red-400/60 hover:text-red-200 hover:shadow-lg hover:shadow-red-500/20'
                          },
                          'MED': {
                            bg: 'bg-gradient-to-r from-blue-500/20 to-blue-600/20',
                            border: 'border-blue-500/40',
                            text: 'text-blue-300',
                            hover: 'hover:from-blue-500/30 hover:to-blue-600/30 hover:border-blue-400/60 hover:text-blue-200 hover:shadow-lg hover:shadow-blue-500/20'
                          },
                          'INFO': {
                            bg: 'bg-gradient-to-r from-green-500/20 to-green-600/20',
                            border: 'border-green-500/40',
                            text: 'text-green-300',
                            hover: 'hover:from-green-500/30 hover:to-green-600/30 hover:border-green-400/60 hover:text-green-200 hover:shadow-lg hover:shadow-green-500/20'
                          }
                        };
                        const buttonStyle = buttonStyles[priorityBadge.level as keyof typeof buttonStyles] || buttonStyles['INFO'];
                        
                        return (
                          <button
                            key={article.id || index}
                            onClick={() => handleArticleClick(article)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 backdrop-blur-sm shadow-sm text-left block w-full ${buttonStyle.bg} ${buttonStyle.border} ${buttonStyle.text} ${buttonStyle.hover}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{article.title || 'Untitled Article'}</div>
                                <div className="text-xs opacity-70 mt-0.5">
                                  {article.publishDate ? formatPublishDate(article.publishDate) : 'Unknown date'}
                                </div>
                              </div>
                              <ArrowRight className="h-3 w-3 flex-shrink-0 ml-2" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-black rounded-md p-4 border border-purple-500/30 text-center">
                  <Newspaper className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-1">No articles available</p>
                  <p className="text-xs text-gray-500 mb-3">Configure sources to start receiving updates</p>
                  <button 
                    onClick={() => navigate('/dashboard/news/sources')}
                    className="text-xs font-medium px-4 py-2 rounded-md transition-all duration-300 bg-gradient-to-b from-slate-900/50 to-slate-800/40 backdrop-blur-sm border border-cyan-500/20 shadow-sm text-cyan-400 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10"
                  >
                    Configure Sources →
                  </button>
                </div>
              )}
            </div>
          </RisqWidget>
          
          <RisqWidget
            title="Threat Tracker"
            description="Critical security alerts"
            icon={<AlertTriangle className="w-10 h-10 text-cyan-400" />}
            variant="interactive"
            delay={0.2}
            onClick={() => navigate("/dashboard/threat/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  {threatLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Scanning for threats...
                    </div>
                  ) : threatError ? (
                    <div className="flex items-center justify-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-red-400">Threat API offline</span>
                      <button 
                        onClick={() => refetchThreats()} 
                        className="text-cyan-400 hover:text-purple-400 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : threatArticles && threatArticles.length > 0 ? (
                    <div className="w-full">
                      <button 
                        onClick={() => navigate('/dashboard/threat/home')}
                        className="w-full text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-purple-300 hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-purple-200 hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-between"
                      >
                        <span>View All Threats</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            }
          >
            <div className="space-y-2 flex-1">
              {threatLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-black rounded-md p-3 border border-gray-600/30 animate-pulse">
                      <div className="flex items-start gap-3">
                        <div className="w-4 h-4 bg-gray-600 rounded mt-1 flex-shrink-0"></div>
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="w-16 h-3 bg-gray-600 rounded"></div>
                            <div className="w-12 h-2 bg-gray-600 rounded"></div>
                          </div>
                          <div className="w-full h-2 bg-gray-600 rounded"></div>
                          <div className="flex gap-1">
                            <div className="w-14 h-4 bg-gray-600 rounded"></div>
                            <div className="w-10 h-4 bg-gray-600 rounded"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : threatError ? (
                <div className="bg-black rounded-md p-4 border border-purple-500/30 text-center">
                  <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <p className="text-xs text-red-400 font-medium mb-1">Failed to load threat data</p>
                  <p className="text-xs text-gray-500 mb-3">API connection error detected</p>
                  <button 
                    onClick={() => refetchThreats()} 
                    className="text-xs text-cyan-400 hover:text-purple-400 transition-colors font-medium"
                  >
                    Retry Connection →
                  </button>
                </div>
              ) : threatArticles && threatArticles.length > 0 ? (
                <>
                  {/* Recent Threats Summary Bar */}
                  <div className="bg-black rounded-md p-2 border border-gray-600/30 mb-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-300 font-medium">Recent Threats</span>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-gray-400">Critical</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-gray-400">High</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-gray-400">Info</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 py-2">
                      {threatArticles.slice(0, 5).map((threat: any, index: number) => {
                        const severity = getThreatSeverity(threat);
                        const buttonStyles = {
                          'CRITICAL': {
                            bg: 'bg-gradient-to-r from-red-500/20 to-red-600/20',
                            border: 'border-red-500/40',
                            text: 'text-red-300',
                            hover: 'hover:from-red-500/30 hover:to-red-600/30 hover:border-red-400/60 hover:text-red-200 hover:shadow-lg hover:shadow-red-500/20'
                          },
                          'HIGH': {
                            bg: 'bg-gradient-to-r from-blue-500/20 to-blue-600/20',
                            border: 'border-blue-500/40',
                            text: 'text-blue-300',
                            hover: 'hover:from-blue-500/30 hover:to-blue-600/30 hover:border-blue-400/60 hover:text-blue-200 hover:shadow-lg hover:shadow-blue-500/20'
                          },
                          'MEDIUM': {
                            bg: 'bg-gradient-to-r from-green-500/20 to-green-600/20',
                            border: 'border-green-500/40',
                            text: 'text-green-300',
                            hover: 'hover:from-green-500/30 hover:to-green-600/30 hover:border-green-400/60 hover:text-green-200 hover:shadow-lg hover:shadow-green-500/20'
                          },
                          'INFO': {
                            bg: 'bg-gradient-to-r from-green-500/20 to-green-600/20',
                            border: 'border-green-500/40',
                            text: 'text-green-300',
                            hover: 'hover:from-green-500/30 hover:to-green-600/30 hover:border-green-400/60 hover:text-green-200 hover:shadow-lg hover:shadow-green-500/20'
                          }
                        };
                        const buttonStyle = buttonStyles[severity.level as keyof typeof buttonStyles] || buttonStyles['INFO'];
                        
                        return (
                          <button
                            key={threat.id || index}
                            onClick={() => handleThreatClick(threat)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 backdrop-blur-sm shadow-sm text-left block w-full ${buttonStyle.bg} ${buttonStyle.border} ${buttonStyle.text} ${buttonStyle.hover}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{threat.title || 'Security Alert'}</div>
                                <div className="text-xs opacity-70 mt-0.5">
                                  {threat.publishDate ? formatPublishDate(threat.publishDate) : 
                                   threat.scrapeDate ? formatPublishDate(threat.scrapeDate) : 
                                   threat.createdAt ? formatPublishDate(threat.createdAt) : 
                                   threat.updatedAt ? formatPublishDate(threat.updatedAt) : 
                                   new Date().toLocaleDateString('en-US', { 
                                     month: 'short', 
                                     day: 'numeric'
                                   })}
                                </div>
                              </div>
                              <ArrowRight className="h-3 w-3 flex-shrink-0 ml-2" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </>
              ) : (
                <div className="bg-black rounded-md p-4 border border-purple-500/30 text-center">
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-gray-400 mb-1 font-medium">No active threats detected</p>
                    <p className="text-xs text-gray-500 mb-4">Your security monitoring is active</p>
                    <div className="flex gap-2 text-xs">
                      <button 
                        onClick={() => navigate('/dashboard/threat/sources')}
                        className="text-xs font-medium px-4 py-2 rounded-md transition-all duration-300 bg-gradient-to-b from-slate-900/50 to-slate-800/40 backdrop-blur-sm border border-cyan-500/20 shadow-sm text-cyan-400 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10"
                      >
                        Add Sources →
                      </button>
                      <span className="text-gray-600">|</span>
                      <button 
                        onClick={() => navigate('/dashboard/threat/keywords')}
                        className="text-xs font-medium px-4 py-2 rounded-md transition-all duration-300 bg-gradient-to-b from-slate-900/50 to-slate-800/40 backdrop-blur-sm border border-cyan-500/20 shadow-sm text-cyan-400 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10"
                      >
                        Set Keywords →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </RisqWidget>
          
          
          
          <RisqWidget
            title="News Capsule"
            description="Executive reports"
            icon={<Radar className="w-10 h-10 text-purple-400" />}
            variant="interactive"
            delay={0.4}
            onClick={() => navigate("/dashboard/news-capsule/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  {capsuleLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading reports...
                    </div>
                  ) : capsuleError ? (
                    <div className="flex items-center justify-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-red-400">Reports API offline</span>
                      <button 
                        onClick={() => refetchCapsule()} 
                        className="text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="w-full">
                      <button 
                        onClick={() => navigate('/dashboard/news-capsule/home')}
                        className="w-full text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-purple-300 hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-purple-200 hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-between"
                      >
                        <span>View All Reports</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            }
          >
            <div className="space-y-2 flex-1">
              {capsuleLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-black rounded-md p-3 border border-gray-600/30 animate-pulse">
                      <div className="flex justify-between items-start mb-2">
                        <div className="w-16 h-4 bg-gray-600 rounded"></div>
                        <div className="w-12 h-3 bg-gray-600 rounded"></div>
                      </div>
                      <div className="space-y-1">
                        <div className="w-full h-3 bg-gray-600 rounded"></div>
                        <div className="w-3/4 h-3 bg-gray-600 rounded"></div>
                      </div>
                    </div>
                  ))}
                </>
              ) : capsuleError ? (
                <div className="bg-black rounded-md p-3 border border-red-500/30 text-center">
                  <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                  <p className="text-xs text-red-400">Failed to load reports</p>
                  <p className="text-xs text-gray-500 mt-1">Check API connection</p>
                </div>
              ) : capsuleReports && capsuleReports.length > 0 ? (
                <>
                  {/* Recent Reports Summary Bar */}
                  <div className="bg-black rounded-md p-2 border border-gray-600/30 mb-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-300 font-medium">Recent Reports</span>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-gray-400">Critical</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-gray-400">High</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-gray-400">Info</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 py-2">
                      {capsuleReports.slice(0, 5).map((report: any, index: number) => {
                        const status = getReportStatus(report);
                        
                        // Determine priority based on report content for color coding
                        const getPriorityFromReport = (report: any) => {
                          if (report.articles && report.articles.length > 0) {
                            const criticalKeywords = ['critical', 'urgent', 'exploit', 'zero-day', 'breach', 'ransomware'];
                            const highKeywords = ['vulnerability', 'cve', 'attack', 'malware', 'threat'];
                            
                            const reportText = `${report.summary || ''} ${report.articles.map((a: any) => `${a.title || ''} ${a.summary || ''}`).join(' ')}`.toLowerCase();
                            
                            if (criticalKeywords.some(keyword => reportText.includes(keyword))) {
                              return 'HIGH'; // Maps to Critical in UI
                            } else if (highKeywords.some(keyword => reportText.includes(keyword))) {
                              return 'MED'; // Maps to High in UI  
                            }
                          }
                          return 'INFO'; // Maps to Info in UI
                        };
                        
                        const priority = getPriorityFromReport(report);
                        const buttonStyles = {
                          'HIGH': {
                            bg: 'bg-gradient-to-r from-red-500/20 to-red-600/20',
                            border: 'border-red-500/40',
                            text: 'text-red-300',
                            hover: 'hover:from-red-500/30 hover:to-red-600/30 hover:border-red-400/60 hover:text-red-200 hover:shadow-lg hover:shadow-red-500/20'
                          },
                          'MED': {
                            bg: 'bg-gradient-to-r from-blue-500/20 to-blue-600/20',
                            border: 'border-blue-500/40',
                            text: 'text-blue-300',
                            hover: 'hover:from-blue-500/30 hover:to-blue-600/30 hover:border-blue-400/60 hover:text-blue-200 hover:shadow-lg hover:shadow-blue-500/20'
                          },
                          'INFO': {
                            bg: 'bg-gradient-to-r from-green-500/20 to-green-600/20',
                            border: 'border-green-500/40',
                            text: 'text-green-300',
                            hover: 'hover:from-green-500/30 hover:to-green-600/30 hover:border-green-400/60 hover:text-green-200 hover:shadow-lg hover:shadow-green-500/20'
                          }
                        };
                        const buttonStyle = buttonStyles[priority as keyof typeof buttonStyles] || buttonStyles['INFO'];
                        
                        const reportTitle = `Executive Report: ${report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        }) : 'Recent'}`;
                        
                        return (
                          <button
                            key={report.id || index}
                            onClick={() => handleCapsuleClick(report)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 backdrop-blur-sm shadow-sm text-left block w-full ${buttonStyle.bg} ${buttonStyle.border} ${buttonStyle.text} ${buttonStyle.hover}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{reportTitle}</div>
                                <div className="text-xs opacity-70 mt-0.5">
                                  {report.createdAt ? `${new Date(report.createdAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })} at ${new Date(report.createdAt).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit'
                                  })}` : 'Unknown date'}
                                </div>
                              </div>
                              <ArrowRight className="h-3 w-3 flex-shrink-0 ml-2" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  
                </>
              ) : (
                <div className="bg-black rounded-md p-4 border border-purple-500/30 text-center">
                  <Radar className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-1">No reports generated yet</p>
                  <p className="text-xs text-gray-500 mb-3">Start processing articles to create executive reports</p>
                  <button 
                    onClick={() => navigate('/dashboard/news-capsule/home')}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-purple-300 hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-purple-200 hover:shadow-lg hover:shadow-purple-500/20"
                  >
                    Process Articles →
                  </button>
                </div>
              )}
            </div>
          </RisqWidget>

          {false && <RisqWidget
            title="Trend Analysis"
            description="Security trends based on news data"
            icon={<TrendingUp className="w-10 h-10" />}
            variant="interactive"
            delay={0.3}
            onClick={() => navigate("/trend-analysis")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  Based on 30-day analysis period
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="bg-black p-3 rounded-md border border-cyan-500/30 text-center">
                <div className="text-2xl font-bold text-cyan-400 mb-1">+24%</div>
                <div className="text-xs text-gray-400">Ransomware</div>
              </div>

              <div className="bg-black p-3 rounded-md border border-purple-500/30 text-center">
                <div className="text-2xl font-bold text-purple-400 mb-1">+18%</div>
                <div className="text-xs text-gray-400">Zero-Day</div>
              </div>
            </div>
          </RisqWidget>}
          {false && <RisqWidget
              title="Settings"
              description="Configure your News Radar experience"
              icon={<Settings className="w-10 h-10 text-gray-300" />}
              variant="interactive"
              delay={0.6}
              onClick={() => navigate("/dashboard/settings")}
              className="col-span-1 md:col-span-1"
              footer={
                <div className="mt-auto">
                  <div className="text-xs text-gray-400 mt-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>5 settings • Active</span>
                    </div>
                  </div>
                </div>
              }
            >
              <div className="space-y-2">
                <div className="bg-black rounded-md p-3 border border-gray-600/30 hover:border-gray-600/50 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium">Data Management</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-black text-green-400 border border-green-500/30 px-2 py-0.5 rounded">Active</span>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Storage, backup, and data retention settings</p>
                </div>
                
                <div className="bg-black rounded-md p-3 border border-gray-600/30 hover:border-gray-600/50 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium">Search Preferences</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-black text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">Custom</span>
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Keywords, filters, and search algorithms</p>
                </div>
                
                <div className="bg-black rounded-md p-3 border border-gray-600/30 hover:border-gray-600/50 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium">Alert Settings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-black text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded">Live</span>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Notifications, thresholds, and alert channels</p>
                </div>
                
                <div className="bg-black rounded-md p-3 border border-gray-600/30 hover:border-gray-600/50 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium">Security & Privacy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-black text-green-400 border border-green-500/30 px-2 py-0.5 rounded">Secure</span>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Authentication, encryption, and data protection</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-black rounded-md p-2 border border-gray-600/30 text-center">
                    <div className="text-lg font-bold text-cyan-400 mb-1">12</div>
                    <div className="text-xs text-gray-400">Active Sources</div>
                  </div>
                  <div className="bg-black rounded-md p-2 border border-gray-600/30 text-center">
                    <div className="text-lg font-bold text-purple-400 mb-1">3</div>
                    <div className="text-xs text-gray-400">Workflows</div>
                  </div>
                </div>
              </div>
            </RisqWidget>}
        </WidgetGrid>
        
        {/* Additional widgets row */}
        {false && <div className="mt-8">
          <WidgetGrid>
            <RisqWidget
              title="Analytics Dashboard"
              description="Advanced metrics and visualization tools"
              icon={<BarChart4 className="w-10 h-10" />}
              variant="interactive"
              delay={0.5}
              onClick={() => navigate("/trend-analysis")}
              className="col-span-1 md:col-span-2"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-black p-3 rounded-md border border-gray-600/30 text-center">
                  <div className="text-xl font-bold text-white mb-1">240</div>
                  <div className="text-xs text-gray-400">Total Threats</div>
                </div>
                
                <div className="bg-black p-3 rounded-md border border-cyan-500/30 text-center">
                  <div className="text-xl font-bold text-cyan-400 mb-1">56</div>
                  <div className="text-xs text-gray-400">Critical</div>
                </div>
                
                <div className="bg-black p-3 rounded-md border border-purple-500/30 text-center">
                  <div className="text-xl font-bold text-purple-400 mb-1">94</div>
                  <div className="text-xs text-gray-400">High</div>
                </div>
                
                <div className="bg-black p-3 rounded-md border border-gray-500/30 text-center">
                  <div className="text-xl font-bold text-gray-400 mb-1">90</div>
                  <div className="text-xs text-gray-400">Medium/Low</div>
                </div>
              </div>
            </RisqWidget>
            
            
            
            <RisqWidget
              title="My Account"
              description="Manage your account details and preferences"
              icon={<Settings className="w-10 h-10" />}
              variant="interactive"
              delay={0.7}
              onClick={() => navigate("/settings")}
              className="col-span-1 md:col-span-1"
            >
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-black border border-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-xl font-bold">U</span>
                  </div>
                  <div className="text-sm font-medium">User Account</div>
                  <div className="text-xs text-gray-400 mt-1">Click to manage</div>
                </div>
              </div>
            </RisqWidget>
          </WidgetGrid>
        </div>}
      </div>
    </div>
  );
}
