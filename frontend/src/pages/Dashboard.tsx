import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RisqWidget, WidgetGrid } from '@/components/widgets/RisqWidget';
import { Newspaper, AlertTriangle, TrendingUp, Radar, Settings, BarChart4, Search, Database, ShieldAlert, Bell, Lock, LineChart, Loader2 } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Fetch News Radar articles with enhanced real-time updates
  const { data: newsArticles, isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery({
    queryKey: ['news-radar-articles-dashboard'],
    queryFn: async () => {
      const response = await fetch(`${serverUrl}/api/news-tracker/articles?limit=10&sortBy=createdAt&order=desc`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject(),
        },
      });
      
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

  // Fetch Threat Tracker articles with real-time updates
  const { data: threatArticles, isLoading: threatLoading, error: threatError, refetch: refetchThreats } = useQuery({
    queryKey: ['threat-tracker-articles-dashboard'],
    queryFn: async () => {
      const response = await fetch(`${serverUrl}/api/threat-tracker/articles?limit=8&sortBy=createdAt&order=desc`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject(),
        },
      });
      
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
  
  // Format time ago helper
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    }
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
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
    const keywords = article.detectedKeywords || [];
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
    const keywords = article.detectedKeywords || [];
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
  
  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        {/* Dashboard introduction section - new design with brand styling */}
        <div className="mb-8">
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
            description="Latest security news from across the web"
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
                      <span>{newsArticles?.length || 0} live articles • Auto-refresh 30s</span>
                    </div>
                  )}
                </div>
              </div>
            }
          >
            <div className="space-y-2">
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
                newsArticles.slice(0, 4).map((article: any, index: number) => {
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
                          {article.createdAt ? formatTimeAgo(article.createdAt) : 'Recently'}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-medium text-white mb-1 line-clamp-2 group-hover:text-[#00FFFF] transition-colors">
                        {article.title || 'Untitled Article'}
                      </h4>
                      
                      {article.summary && (
                        <p className="text-xs text-gray-300 line-clamp-2 mb-2">
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
                })
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
            description="Critical security alerts requiring attention"
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
                      <span>{threatArticles?.length || 0} active threats • Monitor 20s</span>
                    </div>
                  )}
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              {threatLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-800/30 p-2 rounded-lg border border-slate-700/20 animate-pulse">
                      <div className="w-4 h-4 bg-gray-600 rounded flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="w-3/4 h-3 bg-gray-600 rounded mb-1"></div>
                        <div className="w-1/2 h-2 bg-gray-600 rounded"></div>
                      </div>
                    </div>
                  ))}
                </>
              ) : threatError ? (
                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20 text-center">
                  <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                  <p className="text-xs text-red-400">Failed to load threat data</p>
                  <p className="text-xs text-gray-500 mt-1">Check API connection</p>
                </div>
              ) : threatArticles && threatArticles.length > 0 ? (
                threatArticles.slice(0, 4).map((threat: any, index: number) => {
                  const severity = getThreatSeverity(threat);
                  const keywords = threat.detectedKeywords || [];
                  
                  return (
                    <div 
                      key={threat.id || index}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:border-opacity-60 transition-all duration-200 group ${severity.style}`}
                      onClick={() => handleThreatClick(threat)}
                    >
                      <div className={`flex-shrink-0 ${severity.icon === 'red' ? 'text-red-400' : severity.icon === 'yellow' ? 'text-yellow-400' : severity.icon === 'purple' ? 'text-purple-400' : 'text-blue-400'}`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-xs text-white group-hover:text-[#00FFFF] transition-colors line-clamp-1">
                            {threat.title || 'Security Alert'}
                          </h4>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {threat.createdAt ? formatTimeAgo(threat.createdAt) : 'Recent'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1">
                          {threat.summary || keywords.slice(0, 2).map((k: any) => k.keyword || k).join(', ') || 'Threat detected'}
                        </p>
                        {keywords.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {keywords.slice(0, 2).map((keyword: any, kidx: number) => (
                              <span 
                                key={kidx}
                                className={`text-xs px-1 py-0.5 rounded ${severity.icon === 'red' ? 'bg-red-500/20 text-red-300' : severity.icon === 'yellow' ? 'bg-yellow-500/20 text-yellow-300' : severity.icon === 'purple' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}
                              >
                                {keyword.keyword || keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/20 text-center">
                  <AlertTriangle className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-1">No active threats detected</p>
                  <p className="text-xs text-gray-500 mb-3">Configure threat monitoring sources</p>
                  <button 
                    onClick={() => navigate('/dashboard/threat/keywords')}
                    className="text-xs text-[#00FFFF] hover:text-[#BF00FF] transition-colors"
                  >
                    Configure Monitoring →
                  </button>
                </div>
              )}
            </div>
          </RisqWidget>
          
          
          
          <RisqWidget
            title="News Capsule"
            description="Process articles for executive reports"
            icon={<Radar className="w-10 h-10 text-[#BF00FF]" />}
            variant="interactive"
            delay={0.4}
            onClick={() => navigate("/dashboard/news-capsule/home")}
            footer={
              <div className="mt-auto">
                <div className="text-xs text-gray-400 mt-2 text-center">
                  4 articles processed today
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Processed</span>
                  <span className="text-xs text-gray-400">15m ago</span>
                </div>
                <p className="text-xs text-gray-300">Critical infrastructure security analysis from federal advisory report</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Analyzing</span>
                  <span className="text-xs text-gray-400">45m ago</span>
                </div>
                <p className="text-xs text-gray-300">Enterprise ransomware trends and mitigation strategies study</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-[#BF00FF]/20 text-[#00FFFF] px-2 py-0.5 rounded">Processed</span>
                  <span className="text-xs text-gray-400">1h ago</span>
                </div>
                <p className="text-xs text-gray-300">Zero-day vulnerability disclosure impact on supply chain security</p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Queued</span>
                  <span className="text-xs text-gray-400">2h ago</span>
                </div>
                <p className="text-xs text-gray-300">Financial sector cybersecurity regulatory compliance framework analysis</p>
              </div>
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
          <RisqWidget
              title="Settings & Preferences"
              description="Configure your News Radar experience"
              icon={<Settings className="w-10 h-10 text-gray-300" />}
              variant="interactive"
              delay={0.6}
              onClick={() => navigate("/dashboard/settings")}
              className="col-span-1 md:col-span-1"
            >
              <div className="space-y-2">
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Data Management</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Search Preferences</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Notification Settings</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Security & Privacy</span>
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-lg p-2 border border-[#BF00FF]/10">
                  <div className="flex items-center gap-2">
                    <BarChart4 className="w-4 h-4 text-[#00FFFF]" />
                    <span className="text-xs font-medium">Analytics Preferences</span>
                  </div>
                </div>
              </div>
            </RisqWidget>
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
