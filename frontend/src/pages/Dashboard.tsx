import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RisqWidget, WidgetGrid } from '@/components/widgets/RisqWidget';
import { Newspaper, AlertTriangle, TrendingUp, Radar, Settings, BarChart4, Search, Database, ShieldAlert, Bell, Lock, LineChart, Loader2 } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { useFetch } from "@/hooks/use-fetch";

export default function Dashboard() {
  const navigate = useNavigate();
  const fetchWithAuth = useFetch();
  
  // Fetch News Radar articles with enhanced real-time updates
  const { data: newsArticles, isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery({
    queryKey: ['news-radar-articles-dashboard'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/news-tracker/articles?limit=10&sortBy=createdAt&order=desc');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch news articles: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds for more responsive updates
    staleTime: 15000, // Consider data stale after 15 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch News Radar article count
  const { data: newsCount } = useQuery({
    queryKey: ['news-radar-count-dashboard'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/news-tracker/articles/count');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch news article count: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.count || 0;
    },
    refetchInterval: 30000, // Refresh at same rate as articles
    staleTime: 15000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch Threat Tracker articles with real-time updates
  const { data: threatArticles, isLoading: threatLoading, error: threatError, refetch: refetchThreats } = useQuery({
    queryKey: ['threat-tracker-articles-dashboard'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/threat-tracker/articles');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch threat articles: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 20000, // Refresh every 20 seconds for critical threat data
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch Threat Tracker article count
  const { data: threatCount } = useQuery({
    queryKey: ['threat-tracker-count-dashboard'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/threat-tracker/articles/count');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch threat article count: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.count || 0;
    },
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
      return { level: 'MED', style: 'bg-[#00FFFF]/20 text-[#00FFFF] border-[#00FFFF]/30' };
    }
    
    return { level: 'INFO', style: 'bg-[#BF00FF]/20 text-[#BF00FF] border-[#BF00FF]/30' };
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
        style: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        icon: 'yellow'
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
          <div className="bg-black/40 border border-[#BF00FF]/20 rounded-lg p-6 backdrop-blur shadow-xl">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] p-[1px] rounded-lg shadow-glow">
                <div className="bg-black p-3 rounded-lg">
                  <ShieldAlert className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#BF00FF] to-[#00FFFF]">
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
            icon={<Newspaper className="w-10 h-10 text-[#BF00FF]" />}
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
                        className="text-[#00FFFF] hover:text-[#BF00FF] transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>{newsCount || 0} articles</span>
                    </div>
                  )}
                </div>
              </div>
            }
          >
            <div className="space-y-2 flex-1">
              {newsLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10 animate-pulse">
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
                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20 text-center">
                  <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                  <p className="text-xs text-red-400">Failed to load articles</p>
                  <p className="text-xs text-gray-500 mt-1">Check your connection</p>
                </div>
              ) : newsArticles && newsArticles.length > 0 ? (
                <>
                  {/* News Overview Summary Bar */}
                  <div className="bg-black/50 rounded-lg p-2 border border-[#BF00FF]/30 mb-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-300 font-medium">News Overview</span>
                      <span className="text-gray-400">{newsCount || 0} articles</span>
                    </div>
                    <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-800">
                      {(() => {
                        const priorities = newsArticles.reduce((acc: any, article: any) => {
                          const priority = getPriorityBadge(article);
                          const level = priority.level.toUpperCase();
                          acc[level] = (acc[level] || 0) + 1;
                          return acc;
                        }, {});
                        const total = newsArticles.length;
                        
                        return (
                          <>
                            {priorities.CRITICAL > 0 && (
                              <div 
                                className="bg-red-500 h-full" 
                                style={{ width: `${(priorities.CRITICAL / total) * 100}%` }}
                                title={`${priorities.CRITICAL} Critical articles`}
                              />
                            )}
                            {priorities.HIGH > 0 && (
                              <div 
                                className="bg-orange-500 h-full" 
                                style={{ width: `${(priorities.HIGH / total) * 100}%` }}
                                title={`${priorities.HIGH} High priority articles`}
                              />
                            )}
                            {priorities.MEDIUM > 0 && (
                              <div 
                                className="bg-[#BF00FF] h-full" 
                                style={{ width: `${(priorities.MEDIUM / total) * 100}%` }}
                                title={`${priorities.MEDIUM} Medium priority articles`}
                              />
                            )}
                            {priorities.LOW > 0 && (
                              <div 
                                className="bg-[#00FFFF] h-full" 
                                style={{ width: `${(priorities.LOW / total) * 100}%` }}
                                title={`${priorities.LOW} Low priority articles`}
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-gray-400">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>

                  {/* News Articles List */}
                  {newsArticles.slice(0, 1).map((article: any, index: number) => {
                    const sourceBadge = getSourceBadge(article);
                    const priorityBadge = getPriorityBadge(article);
                    const keywords = article.detectedKeywords || [];
                    
                    return (
                      <div 
                        key={article.id || index} 
                        className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10 hover:border-[#BF00FF]/30 transition-all duration-200 cursor-pointer group"
                        onClick={() => handleArticleClick(article)}
                      >
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div className="flex gap-1.5 flex-wrap min-w-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityBadge.style} whitespace-nowrap`}>
                              {priorityBadge.level}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${sourceBadge.style} whitespace-nowrap`}>
                              {sourceBadge.name}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                            {article.publishDate ? formatPublishDate(article.publishDate) : 'Unknown date'}
                          </span>
                        </div>
                        
                        <h4 className="text-xs font-medium text-white mb-1 line-clamp-1 group-hover:text-[#00FFFF] transition-colors">
                          {article.title || 'Untitled Article'}
                        </h4>
                        
                        {article.summary && (
                          <p className="text-xs text-gray-300 line-clamp-3 mb-2">
                            {article.summary}
                          </p>
                        )}
                        
                        {keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {keywords.slice(0, 3).map((keyword: any, kidx: number) => (
                              <span 
                                key={kidx} 
                                className="text-xs px-1.5 py-0.5 bg-[#BF00FF]/10 text-[#BF00FF] rounded border border-[#BF00FF]/20"
                              >
                                {keyword.keyword || keyword}
                              </span>
                            ))}
                            {keywords.length > 3 && (
                              <span className="text-xs text-gray-500">+{keywords.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Show More Section for News Radar */}
                  {newsArticles.length > 1 && (
                    <div className="bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-lg p-3 border border-[#BF00FF]/30 text-center backdrop-blur-sm">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-[#BF00FF] rounded-full animate-pulse"></div>
                        <span className="text-xs text-white font-medium">
                          {(newsCount || 0) - 1} more articles available
                        </span>
                      </div>
                      <button 
                        onClick={() => navigate('/dashboard/news/home')}
                        className="text-xs text-[#00FFFF] hover:text-white transition-colors font-medium"
                      >
                        View All Articles →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-black/30 rounded-lg p-4 border border-[#BF00FF]/10 text-center">
                  <Newspaper className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-1">No articles available</p>
                  <p className="text-xs text-gray-500 mb-3">Configure sources to start receiving updates</p>
                  <button 
                    onClick={() => navigate('/dashboard/news/sources')}
                    className="text-xs text-[#00FFFF] hover:text-[#BF00FF] transition-colors"
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
            icon={<AlertTriangle className="w-10 h-10 text-[#00FFFF]" />}
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
                        className="text-[#00FFFF] hover:text-[#BF00FF] transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      <span>{threatCount || 0} threats</span>
                    </div>
                  )}
                </div>
              </div>
            }
          >
            <div className="space-y-2 flex-1">
              {threatLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/20 animate-pulse">
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
                <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20 text-center">
                  <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <p className="text-xs text-red-400 font-medium mb-1">Failed to load threat data</p>
                  <p className="text-xs text-gray-500 mb-3">API connection error detected</p>
                  <button 
                    onClick={() => refetchThreats()} 
                    className="text-xs text-[#00FFFF] hover:text-[#BF00FF] transition-colors font-medium"
                  >
                    Retry Connection →
                  </button>
                </div>
              ) : threatArticles && threatArticles.length > 0 ? (
                <>
                  {/* Threat Level Summary Bar */}
                  <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/30 mb-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-300 font-medium">Threat Overview</span>
                      <span className="text-gray-400">{threatCount || 0} detected</span>
                    </div>
                    <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-800">
                      {(() => {
                        const levels = threatArticles.reduce((acc: any, threat: any) => {
                          const severity = getThreatSeverity(threat);
                          acc[severity.level] = (acc[severity.level] || 0) + 1;
                          return acc;
                        }, {});
                        const total = threatArticles.length;
                        
                        return (
                          <>
                            {levels.CRITICAL > 0 && (
                              <div 
                                className="bg-red-500 h-full" 
                                style={{ width: `${(levels.CRITICAL / total) * 100}%` }}
                                title={`${levels.CRITICAL} Critical threats`}
                              />
                            )}
                            {levels.HIGH > 0 && (
                              <div 
                                className="bg-yellow-500 h-full" 
                                style={{ width: `${(levels.HIGH / total) * 100}%` }}
                                title={`${levels.HIGH} High threats`}
                              />
                            )}
                            {levels.MEDIUM > 0 && (
                              <div 
                                className="bg-purple-500 h-full" 
                                style={{ width: `${(levels.MEDIUM / total) * 100}%` }}
                                title={`${levels.MEDIUM} Medium threats`}
                              />
                            )}
                            {levels.INFO > 0 && (
                              <div 
                                className="bg-blue-500 h-full" 
                                style={{ width: `${(levels.INFO / total) * 100}%` }}
                                title={`${levels.INFO} Info threats`}
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-gray-400">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>

                  {/* Threat Articles List */}
                  {threatArticles.slice(0, 1).map((threat: any, index: number) => {
                    const severity = getThreatSeverity(threat);
                    const keywords = threat.detectedKeywords || [];
                    
                    return (
                      <div 
                        key={threat.id || index}
                        className={`rounded-lg p-3 border cursor-pointer hover:border-opacity-60 transition-all duration-200 group relative ${severity.style}`}
                        onClick={() => handleThreatClick(threat)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 ${severity.icon === 'red' ? 'text-red-400' : severity.icon === 'yellow' ? 'text-yellow-400' : severity.icon === 'purple' ? 'text-purple-400' : 'text-blue-400'}`}>
                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-2 gap-2">
                              <div className="flex gap-1.5 flex-wrap min-w-0">
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  severity.level === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                  severity.level === 'HIGH' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                  severity.level === 'MEDIUM' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                  'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}>
                                  {severity.level}
                                </span>
                                {/* CVE ID Badge */}
                                {(() => {
                                  const cveMatch = threat.title?.match(/CVE-\d{4}-\d+/) || threat.summary?.match(/CVE-\d{4}-\d+/);
                                  if (cveMatch) {
                                    return (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-300 border border-gray-600/30 whitespace-nowrap">
                                        {cveMatch[0]}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                                {/* Attack Vector Badge */}
                                {(() => {
                                  const vectors = ['RCE', 'XSS', 'SQLi', 'Phishing', 'Malware', 'DDoS', 'Ransomware', 'APT'];
                                  const foundVector = vectors.find(v => 
                                    threat.title?.toLowerCase().includes(v.toLowerCase()) || 
                                    threat.summary?.toLowerCase().includes(v.toLowerCase()) ||
                                    (Array.isArray(keywords) && keywords.some((k: any) => (k.keyword || k).toLowerCase().includes(v.toLowerCase())))
                                  );
                                  if (foundVector) {
                                    return (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 whitespace-nowrap">
                                        {foundVector}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                                {threat.publishDate ? formatPublishDate(threat.publishDate) : 'Unknown date'}
                              </span>
                            </div>
                            
                            <h4 className="font-medium text-xs text-white group-hover:text-[#00FFFF] transition-colors line-clamp-1 mb-1">
                              {threat.title || 'Security Alert'}
                            </h4>
                            
                            <p className="text-xs text-gray-400 line-clamp-3 mb-2">
                              {threat.summary || keywords.slice(0, 3).map((k: any) => k.keyword || k).join(', ') || 'Threat detected requiring immediate attention'}
                            </p>
                            
                            {/* Threat-specific metadata */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              {/* Affected Systems */}
                              {(() => {
                                const systems = ['Windows', 'Linux', 'macOS', 'Android', 'iOS', 'Chrome', 'Firefox', 'Apache', 'nginx', 'Exchange'];
                                const foundSystems = systems.filter(s => 
                                  threat.title?.toLowerCase().includes(s.toLowerCase()) || 
                                  threat.summary?.toLowerCase().includes(s.toLowerCase())
                                ).slice(0, 2);
                                
                                return foundSystems.map((system, idx) => (
                                  <span key={idx} className="text-xs px-1.5 py-0.5 bg-blue-500/15 text-blue-300 rounded border border-blue-500/20">
                                    {system}
                                  </span>
                                ));
                              })()}
                              
                              {/* Impact Level */}
                              {(() => {
                                const impacts = threat.summary?.toLowerCase();
                                if (impacts?.includes('data breach') || impacts?.includes('credential')) {
                                  return (
                                    <span className="text-xs px-1.5 py-0.5 bg-red-500/15 text-red-300 rounded border border-red-500/20">
                                      Data Risk
                                    </span>
                                  );
                                } else if (impacts?.includes('denial') || impacts?.includes('ddos') || impacts?.includes('outage')) {
                                  return (
                                    <span className="text-xs px-1.5 py-0.5 bg-yellow-500/15 text-yellow-300 rounded border border-yellow-500/20">
                                      Service Risk
                                    </span>
                                  );
                                } else if (impacts?.includes('privilege') || impacts?.includes('escalation') || impacts?.includes('admin')) {
                                  return (
                                    <span className="text-xs px-1.5 py-0.5 bg-purple-500/15 text-purple-300 rounded border border-purple-500/20">
                                      Access Risk
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            
                            {Array.isArray(keywords) && keywords.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {keywords.slice(0, 3).map((keyword: any, kidx: number) => (
                                  <span 
                                    key={kidx}
                                    className={`text-xs px-1.5 py-0.5 rounded-full ${severity.icon === 'red' ? 'bg-red-500/15 text-red-300 border border-red-500/20' : severity.icon === 'yellow' ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/20' : severity.icon === 'purple' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'}`}
                                  >
                                    {keyword.keyword || keyword}
                                  </span>
                                ))}
                                {keywords.length > 3 && (
                                  <span className="text-xs text-gray-500">
                                    +{keywords.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Show More Section */}
                  {threatArticles.length > 1 && (
                    <div className="bg-gradient-to-r from-red-500/20 to-[#00FFFF]/20 rounded-lg p-3 border border-red-400/30 text-center backdrop-blur-sm">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-white font-medium">
                          {(threatCount || 0) - 1} more threats available
                        </span>
                      </div>
                      <button 
                        onClick={() => navigate('/dashboard/threat/home')}
                        className="text-xs text-[#00FFFF] hover:text-white transition-colors font-medium"
                      >
                        View All Threats →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/20 text-center">
                  <div className="flex flex-col items-center">
                    <div className="relative mb-3">
                      <AlertTriangle className="w-8 h-8 text-gray-400" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-xs text-gray-400 mb-1 font-medium">No active threats detected</p>
                    <p className="text-xs text-gray-500 mb-4">Your security monitoring is active</p>
                    <div className="flex gap-2 text-xs">
                      <button 
                        onClick={() => navigate('/dashboard/threat/sources')}
                        className="text-[#00FFFF] hover:text-[#BF00FF] transition-colors"
                      >
                        Add Sources →
                      </button>
                      <span className="text-gray-600">|</span>
                      <button 
                        onClick={() => navigate('/dashboard/threat/keywords')}
                        className="text-[#00FFFF] hover:text-[#BF00FF] transition-colors"
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
            icon={<Radar className="w-10 h-10 text-[#BF00FF]" />}
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
                        className="text-[#00FFFF] hover:text-[#BF00FF] transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-[#BF00FF] rounded-full animate-pulse"></div>
                      <span>{capsuleReports?.length || 0} reports</span>
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
                    <div key={i} className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10 animate-pulse">
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
                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20 text-center">
                  <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                  <p className="text-xs text-red-400">Failed to load reports</p>
                  <p className="text-xs text-gray-500 mt-1">Check API connection</p>
                </div>
              ) : capsuleReports && capsuleReports.length > 0 ? (
                <>
                  {/* Reports Overview Summary Bar */}
                  <div className="bg-black/50 rounded-lg p-2 border border-[#BF00FF]/30 mb-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-300 font-medium">Reports Overview</span>
                      <span className="text-gray-400">{capsuleReports.length} reports</span>
                    </div>
                    <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-800">
                      {(() => {
                        const statuses = capsuleReports.reduce((acc: any, report: any) => {
                          const status = getReportStatus(report);
                          acc[status.label] = (acc[status.label] || 0) + 1;
                          return acc;
                        }, {});
                        const total = capsuleReports.length;
                        
                        return (
                          <>
                            {statuses.Processed > 0 && (
                              <div 
                                className="bg-emerald-500 h-full" 
                                style={{ width: `${(statuses.Processed / total) * 100}%` }}
                                title={`${statuses.Processed} Processed reports`}
                              />
                            )}
                            {statuses.Processing > 0 && (
                              <div 
                                className="bg-blue-500 h-full" 
                                style={{ width: `${(statuses.Processing / total) * 100}%` }}
                                title={`${statuses.Processing} Processing reports`}
                              />
                            )}
                            {statuses.Empty > 0 && (
                              <div 
                                className="bg-gray-500 h-full" 
                                style={{ width: `${(statuses.Empty / total) * 100}%` }}
                                title={`${statuses.Empty} Empty reports`}
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-gray-400">
                      <span>Empty</span>
                      <span>Ready</span>
                    </div>
                  </div>

                  {/* Reports List */}
                  {capsuleReports.slice(0, 1).map((report: any, index: number) => {
                  const status = getReportStatus(report);
                  
                  return (
                    <div 
                      key={report.id || index}
                      className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10 hover:border-[#BF00FF]/30 transition-all duration-200 cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCapsuleClick(report)
                      }}
                    >
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex gap-1.5 flex-wrap min-w-0">
                          <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${status.style}`}>
                            {status.label}
                          </span>
                          {report.versionNumber && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#00FFFF]/20 text-[#00FFFF] font-medium whitespace-nowrap">
                              v{report.versionNumber}
                            </span>
                          )}
                          {/* Article Count Badge */}
                          {report.articles && report.articles.length > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#BF00FF]/20 text-[#BF00FF] border border-[#BF00FF]/30 whitespace-nowrap">
                              {report.articles.length} articles
                            </span>
                          )}
                          {/* Report Type Badge */}
                          {(() => {
                            if (report.articles && report.articles.length > 0) {
                              const hasThreats = report.articles.some((a: any) => a.threatName || a.title?.toLowerCase().includes('threat'));
                              const hasNews = report.articles.some((a: any) => !a.threatName && a.title);
                              
                              if (hasThreats && hasNews) {
                                return (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                    Mixed Intel
                                  </span>
                                );
                              } else if (hasThreats) {
                                return (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 whitespace-nowrap">
                                    Threat Intel
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                                    News Intel
                                  </span>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: new Date(report.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                          }) : 'Recent'}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-medium text-white mb-1 line-clamp-1 group-hover:text-[#00FFFF] transition-colors">
                        Executive Report: {report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'Recent'}
                        {report.versionNumber && (
                          <span className="text-blue-400 ml-1">
                            (Version: {report.versionNumber})
                          </span>
                        )}
                      </h4>
                      
                      <p className="text-xs text-gray-300 line-clamp-3 mb-2">
                        <span className="text-gray-400">Summary:</span> {(() => {
                          // Generate comprehensive report summary
                          if (report.articles && report.articles.length > 0) {
                            const threats = report.articles.map((a: any) => a.threatName || a.title?.split(' ')[0] || 'Security').slice(0, 2);
                            const uniqueThreats = [...new Set(threats)];
                            const topic = uniqueThreats.length > 1 
                              ? `${uniqueThreats[0]} & ${uniqueThreats.length - 1} more security topics`
                              : `${uniqueThreats[0]} security analysis`;
                            return `Executive briefing covering ${topic}. Processed ${report.articles.length} intelligence source${report.articles.length !== 1 ? 's' : ''} for comprehensive threat landscape assessment and strategic recommendations.`;
                          }
                          return 'Executive security intelligence report with strategic recommendations and threat landscape analysis for leadership review.';
                        })()}
                      </p>
                      
                      {/* Report-specific metadata */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {/* Processing Time Indicator */}
                        {(() => {
                          const created = report.createdAt ? new Date(report.createdAt) : null;
                          if (created) {
                            const now = new Date();
                            const diffMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
                            
                            if (diffMinutes < 60) {
                              return (
                                <span className="text-xs px-1.5 py-0.5 bg-green-500/15 text-green-300 rounded border border-green-500/20">
                                  Fresh ({diffMinutes}m ago)
                                </span>
                              );
                            } else if (diffMinutes < 1440) {
                              const hours = Math.floor(diffMinutes / 60);
                              return (
                                <span className="text-xs px-1.5 py-0.5 bg-yellow-500/15 text-yellow-300 rounded border border-yellow-500/20">
                                  Recent ({hours}h ago)
                                </span>
                              );
                            } else {
                              const days = Math.floor(diffMinutes / 1440);
                              return (
                                <span className="text-xs px-1.5 py-0.5 bg-gray-500/15 text-gray-300 rounded border border-gray-500/20">
                                  Archived ({days}d ago)
                                </span>
                              );
                            }
                          }
                          return null;
                        })()}
                        
                        {/* Content Scope */}
                        {report.articles && report.articles.length > 0 && (() => {
                          const articleCount = report.articles.length;
                          if (articleCount >= 10) {
                            return (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-500/15 text-purple-300 rounded border border-purple-500/20">
                                Comprehensive
                              </span>
                            );
                          } else if (articleCount >= 5) {
                            return (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-500/15 text-blue-300 rounded border border-blue-500/20">
                                Standard
                              </span>
                            );
                          } else {
                            return (
                              <span className="text-xs px-1.5 py-0.5 bg-orange-500/15 text-orange-300 rounded border border-orange-500/20">
                                Brief
                              </span>
                            );
                          }
                        })()}
                        
                        {/* Report Format */}
                        <span className="text-xs px-1.5 py-0.5 bg-[#00FFFF]/15 text-[#00FFFF] rounded border border-[#00FFFF]/20">
                          Executive Brief
                        </span>
                      </div>
                      
                      {/* Source Information */}
                      {report.articles && report.articles.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-[#BF00FF]">
                            {report.articles.length} sources • {(() => {
                              const uniqueSources = [...new Set(report.articles.map((a: any) => a.source || 'Unknown'))];
                              return uniqueSources.length;
                            })()} publishers
                          </span>
                        </div>
                      )}
                    </div>
                  );
                  })}
                  
                  {/* Show More Section for News Capsule */}
                  {capsuleReports.length > 1 && (
                    <div className="bg-gradient-to-r from-[#BF00FF]/20 to-purple-500/20 rounded-lg p-3 border border-purple-400/30 text-center backdrop-blur-sm">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-white font-medium">
                          {capsuleReports.length - 1} more reports available
                        </span>
                      </div>
                      <button 
                        onClick={() => navigate('/dashboard/news-capsule/reports')}
                        className="text-xs text-[#00FFFF] hover:text-white transition-colors font-medium"
                      >
                        View All Reports →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-black/30 rounded-lg p-4 border border-[#BF00FF]/10 text-center">
                  <Radar className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-1">No reports generated yet</p>
                  <p className="text-xs text-gray-500 mb-3">Start processing articles to create executive reports</p>
                  <button 
                    onClick={() => navigate('/dashboard/news-capsule/home')}
                    className="text-xs text-[#00FFFF] hover:text-[#BF00FF] transition-colors"
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
              <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                <div className="text-2xl font-bold text-[#00FFFF] mb-1">+24%</div>
                <div className="text-xs text-gray-400">Ransomware</div>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                <div className="text-2xl font-bold text-[#FF00BF] mb-1">+18%</div>
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
                <div className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10 hover:border-[#BF00FF]/30 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#00FFFF]" />
                      <span className="text-xs font-medium">Data Management</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Active</span>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Storage, backup, and data retention settings</p>
                </div>
                
                <div className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10 hover:border-[#BF00FF]/30 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-[#00FFFF]" />
                      <span className="text-xs font-medium">Search Preferences</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Custom</span>
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Keywords, filters, and search algorithms</p>
                </div>
                
                <div className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10 hover:border-[#BF00FF]/30 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#00FFFF]" />
                      <span className="text-xs font-medium">Alert Settings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-[#BF00FF]/20 text-[#BF00FF] px-2 py-0.5 rounded">Live</span>
                      <div className="w-2 h-2 bg-[#BF00FF] rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Notifications, thresholds, and alert channels</p>
                </div>
                
                <div className="bg-black/30 rounded-lg p-3 border border-[#BF00FF]/10 hover:border-[#BF00FF]/30 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#00FFFF]" />
                      <span className="text-xs font-medium">Security & Privacy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Secure</span>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Authentication, encryption, and data protection</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/30 text-center">
                    <div className="text-lg font-bold text-[#00FFFF] mb-1">12</div>
                    <div className="text-xs text-gray-400">Active Sources</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/30 text-center">
                    <div className="text-lg font-bold text-[#BF00FF] mb-1">3</div>
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
                <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                  <div className="text-xl font-bold text-white mb-1">240</div>
                  <div className="text-xs text-gray-400">Total Threats</div>
                </div>
                
                <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                  <div className="text-xl font-bold text-[#00FFFF] mb-1">56</div>
                  <div className="text-xs text-gray-400">Critical</div>
                </div>
                
                <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
                  <div className="text-xl font-bold text-[#FF00BF] mb-1">94</div>
                  <div className="text-xs text-gray-400">High</div>
                </div>
                
                <div className="bg-black/30 p-3 rounded-lg border border-[#BF00FF]/10 text-center">
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
                  <div className="w-16 h-16 bg-[#BF00FF]/20 rounded-full flex items-center justify-center mx-auto mb-2">
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
