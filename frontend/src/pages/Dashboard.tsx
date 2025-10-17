import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RisqWidget, WidgetGrid } from '@/components/widgets/RisqWidget';
import { Newspaper, AlertTriangle, TrendingUp, Radar, Settings, BarChart4, Search, Database, ShieldAlert, Bell, Lock, LineChart, Loader2, ArrowRight, Clock, Hash, ExternalLink, FileText } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { useFetch } from "@/hooks/use-fetch";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const navigate = useNavigate();
  const fetchWithAuth = useFetch();
  const { data: userData } = useAuth();
  
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

  // Fetch News Radar articles with enhanced real-time updates (using POST for large keyword lists)
  const { data: newsArticles, isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery({
    queryKey: ['news-radar-articles-dashboard', newsKeywords],
    queryFn: async () => {
      // Get active keyword IDs
      const activeKeywordIds = newsKeywords?.filter((k: any) => k.active !== false).map((k: any) => k.id) || [];
      
      const requestBody = {
        keywordIds: activeKeywordIds.length > 0 ? activeKeywordIds : undefined,
        limit: 10,
        sortBy: 'createdAt',
        order: 'desc',
        page: 1
      };
      
      // Remove undefined values
      const cleanBody = Object.fromEntries(
        Object.entries(requestBody).filter(([_, v]) => v !== undefined)
      );
      
      const response = await fetchWithAuth('/api/news-tracker/articles/query', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanBody)
      });
      
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

  // Fetch News Radar article count (using POST for large keyword lists)
  const { data: newsCount } = useQuery({
    queryKey: ['news-radar-count-dashboard', newsKeywords],
    queryFn: async () => {
      // Get active keyword IDs
      const activeKeywordIds = newsKeywords?.filter((k: any) => k.active !== false).map((k: any) => k.id) || [];
      
      const response = await fetchWithAuth('/api/news-tracker/articles/count', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywordIds: activeKeywordIds.length > 0 ? activeKeywordIds : undefined
        })
      });
      
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

  // Get active keyword IDs for threat tracker
  const activeTheatKeywordIds = threatKeywords?.filter((k: any) => k.active !== false).map((k: any) => k.id) || [];
  const hasActiveTheatKeywords = activeTheatKeywordIds.length > 0;

  // Fetch Threat Tracker articles with real-time updates (using POST for large keyword lists)
  const { data: threatArticles, isLoading: threatLoading, error: threatError, refetch: refetchThreats } = useQuery({
    queryKey: ['threat-tracker-articles-dashboard', threatKeywords],
    queryFn: async () => {
      const requestBody = {
        keywordIds: activeTheatKeywordIds.length > 0 ? activeTheatKeywordIds : undefined,
        limit: 50,
        page: 1
      };
      
      // Remove undefined values
      const cleanBody = Object.fromEntries(
        Object.entries(requestBody).filter(([_, v]) => v !== undefined)
      );
      
      const response = await fetchWithAuth('/api/threat-tracker/articles/query', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanBody)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch threat articles: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!threatKeywords && hasActiveTheatKeywords, // Only fetch when keywords are loaded AND active keywords exist
    refetchInterval: 20000, // Refresh every 20 seconds for critical threat data
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Fetch Threat Tracker article count (using POST for large keyword lists)
  const { data: threatCount } = useQuery({
    queryKey: ['threat-tracker-count-dashboard', threatKeywords],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/threat-tracker/articles/count', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywordIds: activeTheatKeywordIds.length > 0 ? activeTheatKeywordIds : undefined
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch threat article count: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.count || 0;
    },
    enabled: !!threatKeywords && hasActiveTheatKeywords, // Only fetch count when keywords are loaded AND active keywords exist
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

  // Get relative time (e.g., "6hrs Ago", "1hr Ago")
  const getRelativeTime = (dateString: string) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return diffMins <= 1 ? 'Just Now' : `${diffMins}min${diffMins === 1 ? '' : 's'} Ago`;
    } else if (diffHours < 24) {
      return `${diffHours}hr${diffHours === 1 ? '' : 's'} Ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}day${diffDays === 1 ? '' : 's'} Ago`;
    } else {
      return formatPublishDate(dateString);
    }
  };

  // Extract top keywords with frequency counts
  const getTopKeywords = (article: any, limit: number = 3) => {
    const keywords = Array.isArray(article.detectedKeywords) ? article.detectedKeywords : [];
    
    if (keywords.length === 0) return [];
    
    // Count keyword frequencies and sort by count
    const keywordCounts = keywords.reduce((acc: any, kw: any) => {
      const keyword = kw.keyword?.toLowerCase() || '';
      if (keyword) {
        acc[keyword] = (acc[keyword] || 0) + 1;
      }
      return acc;
    }, {});
    
    return Object.entries(keywordCounts)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, limit)
      .map(([keyword, count]) => ({ keyword, count }));
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
        style: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        icon: 'yellow'
      };
    }
    
    return { 
      level: 'INFO', 
      style: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      icon: 'blue'
    };
  };

  // Get topic category based on article content
  const getTopicCategory = (article: any) => {
    const content = `${article.title || ''} ${article.summary || ''}`.toLowerCase();
    
    // CVE and vulnerability detection
    if (content.includes('cve-') || content.match(/cve\s*\d{4}/)) return 'CVE';
    
    // Ransomware
    if (content.includes('ransomware') || content.includes('ransom')) return 'Ransomware';
    
    // Data breach
    if (content.includes('breach') || content.includes('leak') || content.includes('exposed') || 
        content.includes('stolen data') || content.includes('hacked')) return 'Breach';
    
    // Malware
    if (content.includes('malware') || content.includes('trojan') || content.includes('virus') || 
        content.includes('worm') || content.includes('backdoor') || content.includes('spyware')) return 'Malware';
    
    // Vulnerability
    if (content.includes('vulnerability') || content.includes('vuln') || content.includes('flaw') || 
        content.includes('exploit') || content.includes('zero-day') || content.includes('0-day')) return 'Vulnerability';
    
    // Phishing/Social Engineering
    if (content.includes('phishing') || content.includes('scam') || content.includes('social engineering')) return 'Phishing';
    
    // DDoS/Network attacks
    if (content.includes('ddos') || content.includes('denial of service') || content.includes('botnet')) return 'DDoS';
    
    // APT/Nation State
    if (content.includes('apt') || content.includes('nation-state') || content.includes('advanced persistent')) return 'APT';
    
    // Supply chain
    if (content.includes('supply chain') || content.includes('third-party')) return 'Supply Chain';
    
    // Patch/Update
    if (content.includes('patch') || content.includes('update') || content.includes('hotfix')) return 'Patch';
    
    // Policy/Compliance
    if (content.includes('policy') || content.includes('regulation') || content.includes('compliance') || 
        content.includes('gdpr') || content.includes('hipaa')) return 'Policy';
    
    // Security tools/products
    if (content.includes('firewall') || content.includes('antivirus') || content.includes('endpoint')) return 'Security Tool';
    
    return 'News';
  };

  // Get source type based on article source
  const getSourceType = (article: any) => {
    const source = (article.source || article.url || '').toLowerCase();
    
    // Official vendor/company sources
    if (source.includes('microsoft') || source.includes('cisco') || source.includes('google') || 
        source.includes('apple') || source.includes('oracle') || source.includes('ibm')) return 'Vendor';
    
    // Government/Official
    if (source.includes('.gov') || source.includes('cisa') || source.includes('nist')) return 'Government';
    
    // Security vendors/firms
    if (source.includes('crowdstrike') || source.includes('palo alto') || source.includes('fireeye') || 
        source.includes('mandiant') || source.includes('kaspersky') || source.includes('sophos') ||
        source.includes('fortinet') || source.includes('checkpoint')) return 'Security Firm';
    
    // Research/Academia
    if (source.includes('research') || source.includes('.edu') || source.includes('arxiv')) return 'Research';
    
    // Security-specific news
    if (source.includes('bleepingcomputer') || source.includes('securityweek') || 
        source.includes('darkreading') || source.includes('threatpost') || 
        source.includes('krebs') || source.includes('cybersecurity')) return 'Security News';
    
    // Tech news outlets
    if (source.includes('techcrunch') || source.includes('verge') || source.includes('wired') || 
        source.includes('zdnet') || source.includes('arstechnica') || source.includes('engadget')) return 'Tech News';
    
    // Security blogs
    if (source.includes('blog') || source.includes('medium')) return 'Blog';
    
    // CVE/Advisory databases
    if (source.includes('nvd.nist') || source.includes('cve.org') || source.includes('exploit-db')) return 'Advisory';
    
    // Social/Community
    if (source.includes('reddit') || source.includes('twitter') || source.includes('hackernews')) return 'Community';
    
    return 'Media';
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
  const handleCapsuleClick = (e: React.MouseEvent, report: any) => {
    e.stopPropagation();
    // Navigate directly to the specific report using URL parameter
    navigate(`/dashboard/news-capsule/reports/${report.id}`);
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
                        className="w-full text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-[#00FFFF] hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-[#00FFFF] hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-between"
                      >
                        <span>Go To News Radar</span>
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
                  {/* Enhanced Article Cards with Rich Information */}
                  <div className="space-y-3">
                    {newsArticles.slice(0, 3).map((article: any, index: number) => {
                      const relativeTime = getRelativeTime(article.publishDate || article.createdAt);
                      const source = article.source || article.url?.split('/')[2]?.replace('www.', '') || 'Unknown';
                      
                      // Extract keywords from article
                      const getKeywords = () => {
                        if (!article.detectedKeywords) return { displayed: [], total: 0 };
                        try {
                          const keywords = typeof article.detectedKeywords === 'string' 
                            ? JSON.parse(article.detectedKeywords) 
                            : article.detectedKeywords;
                          
                          if (typeof keywords === 'object' && keywords !== null) {
                            // Flatten all keyword categories and remove duplicates
                            const allKeywords = [...new Set(Object.values(keywords).flat())];
                            return {
                              displayed: allKeywords.slice(0, 5),
                              total: allKeywords.length
                            };
                          }
                          const uniqueKeywords = Array.isArray(keywords) ? [...new Set(keywords)] : [];
                          return {
                            displayed: uniqueKeywords.slice(0, 5),
                            total: uniqueKeywords.length
                          };
                        } catch {
                          return { displayed: [], total: 0 };
                        }
                      };
                      
                      // Detect affected products/vendors
                      const getAffectedProducts = () => {
                        const content = `${article.title || ''} ${article.summary || ''}`.toLowerCase();
                        const products: string[] = [];
                        
                        // Microsoft products (add vendor + product)
                        if (content.includes('windows')) {
                          products.push('Microsoft', 'Windows');
                        }
                        if (content.includes('microsoft') && !products.includes('Microsoft')) {
                          products.push('Microsoft');
                        }
                        if (content.includes('office 365') || content.includes('o365')) {
                          products.push('Microsoft', 'Office 365');
                        }
                        if (content.includes('azure')) {
                          products.push('Microsoft', 'Azure');
                        }
                        if (content.includes('exchange')) {
                          products.push('Microsoft', 'Exchange');
                        }
                        if (content.includes('sharepoint')) {
                          products.push('Microsoft', 'SharePoint');
                        }
                        if (content.includes('active directory') || content.includes(' ad ')) {
                          products.push('Microsoft', 'Active Directory');
                        }
                        if (content.includes('teams')) {
                          products.push('Microsoft', 'Teams');
                        }
                        if (content.includes('onedrive')) {
                          products.push('Microsoft', 'OneDrive');
                        }
                        if (content.includes('edge')) {
                          products.push('Microsoft', 'Edge');
                        }
                        
                        // Adobe products (add vendor + product)
                        if (content.includes('adobe') && !products.includes('Adobe')) {
                          products.push('Adobe');
                        }
                        if (content.includes('acrobat')) {
                          products.push('Adobe', 'Acrobat');
                        }
                        if (content.includes('photoshop')) {
                          products.push('Adobe', 'Photoshop');
                        }
                        if (content.includes('creative cloud')) {
                          products.push('Adobe', 'Creative Cloud');
                        }
                        
                        // Google products (add vendor + product)
                        if (content.includes('google') && !products.includes('Google')) {
                          products.push('Google');
                        }
                        if (content.includes('chrome')) {
                          products.push('Google', 'Chrome');
                        }
                        if (content.includes('android')) {
                          products.push('Google', 'Android');
                        }
                        if (content.includes('gmail')) {
                          products.push('Google', 'Gmail');
                        }
                        if (content.includes('google workspace')) {
                          products.push('Google', 'Workspace');
                        }
                        
                        // Apple products (add vendor + product)
                        if (content.includes('apple') && !products.includes('Apple')) {
                          products.push('Apple');
                        }
                        if (content.includes('ios')) {
                          products.push('Apple', 'iOS');
                        }
                        if (content.includes('macos')) {
                          products.push('Apple', 'macOS');
                        }
                        if (content.includes('safari')) {
                          products.push('Apple', 'Safari');
                        }
                        if (content.includes('iphone')) {
                          products.push('Apple', 'iPhone');
                        }
                        if (content.includes('ipad')) {
                          products.push('Apple', 'iPad');
                        }
                        
                        // Networking/Infrastructure vendors
                        if (content.includes('cisco')) products.push('Cisco');
                        if (content.includes('vmware')) products.push('VMware');
                        if (content.includes('fortinet')) products.push('Fortinet');
                        if (content.includes('palo alto')) products.push('Palo Alto');
                        if (content.includes('juniper')) products.push('Juniper');
                        if (content.includes('arista')) products.push('Arista');
                        if (content.includes('f5 networks') || content.includes(' f5 ')) products.push('F5 Networks');
                        if (content.includes('dell')) products.push('Dell');
                        if (content.includes(' hp ') || content.includes('hewlett')) products.push('HP');
                        if (content.includes('lenovo')) products.push('Lenovo');
                        
                        // Security vendors
                        if (content.includes('crowdstrike')) products.push('CrowdStrike');
                        if (content.includes('sophos')) products.push('Sophos');
                        if (content.includes('trend micro')) products.push('Trend Micro');
                        if (content.includes('mcafee')) products.push('McAfee');
                        if (content.includes('symantec')) products.push('Symantec');
                        if (content.includes('kaspersky')) products.push('Kaspersky');
                        if (content.includes('norton')) products.push('Norton');
                        if (content.includes('bitdefender')) products.push('Bitdefender');
                        if (content.includes('splunk')) products.push('Splunk');
                        if (content.includes('sentinelone')) products.push('SentinelOne');
                        if (content.includes('check point')) products.push('Check Point');
                        if (content.includes('rapid7')) products.push('Rapid7');
                        
                        // Browsers (standalone - Edge already covered under Microsoft)
                        if (content.includes('firefox')) {
                          products.push('Mozilla', 'Firefox');
                        }
                        if (content.includes('opera')) {
                          products.push('Opera Software', 'Opera');
                        }
                        if (content.includes('brave')) {
                          products.push('Brave Software', 'Brave');
                        }
                        if (content.includes('vivaldi')) {
                          products.push('Vivaldi Technologies', 'Vivaldi');
                        }
                        
                        // Database systems
                        if (content.includes('mysql')) {
                          products.push('Oracle', 'MySQL');
                        }
                        if (content.includes('postgresql') || content.includes('postgres')) {
                          products.push('PostgreSQL');
                        }
                        if (content.includes('mongodb')) {
                          products.push('MongoDB');
                        }
                        if (content.includes('oracle database') || content.includes('oracle db')) {
                          products.push('Oracle', 'Database');
                        }
                        if (content.includes('redis')) {
                          products.push('Redis');
                        }
                        if (content.includes('sql server') || content.includes('mssql')) {
                          products.push('Microsoft', 'SQL Server');
                        }
                        if (content.includes('mariadb')) {
                          products.push('MariaDB');
                        }
                        
                        // Cloud platforms
                        if (content.includes(' aws ') || content.includes('amazon web services')) {
                          products.push('Amazon', 'AWS');
                        }
                        if (content.includes('google cloud') || content.includes(' gcp ')) {
                          products.push('Google', 'Cloud');
                        }
                        if (content.includes('ibm cloud')) {
                          products.push('IBM', 'Cloud');
                        }
                        if (content.includes('oracle cloud')) {
                          products.push('Oracle', 'Cloud');
                        }
                        if (content.includes('digitalocean')) {
                          products.push('DigitalOcean');
                        }
                        if (content.includes('heroku')) {
                          products.push('Salesforce', 'Heroku');
                        }
                        if (content.includes('linode')) {
                          products.push('Akamai', 'Linode');
                        }
                        
                        // Enterprise software
                        if (content.includes(' sap ')) products.push('SAP');
                        if (content.includes('salesforce')) products.push('Salesforce');
                        if (content.includes('servicenow')) products.push('ServiceNow');
                        if (content.includes('workday')) products.push('Workday');
                        if (content.includes('tableau')) products.push('Tableau');
                        
                        // Communication/Collaboration
                        if (content.includes('outlook')) products.push('Outlook');
                        if (content.includes('zoom')) products.push('Zoom');
                        if (content.includes('slack')) products.push('Slack');
                        if (content.includes('webex')) products.push('Webex');
                        if (content.includes('discord')) products.push('Discord');
                        
                        // Development/DevOps tools
                        if (content.includes('github')) products.push('GitHub');
                        if (content.includes('gitlab')) products.push('GitLab');
                        if (content.includes('docker')) products.push('Docker');
                        if (content.includes('kubernetes') || content.includes('k8s')) products.push('Kubernetes');
                        if (content.includes('jenkins')) products.push('Jenkins');
                        if (content.includes('ansible')) products.push('Ansible');
                        if (content.includes('terraform')) products.push('Terraform');
                        if (content.includes('jira')) products.push('Jira');
                        
                        // Web servers
                        if (content.includes('apache')) products.push('Apache');
                        if (content.includes('nginx')) products.push('Nginx');
                        if (content.includes(' iis ') || content.includes('internet information services')) products.push('IIS');
                        if (content.includes('tomcat')) products.push('Tomcat');
                        
                        // CMS/Web platforms
                        if (content.includes('wordpress')) products.push('WordPress');
                        if (content.includes('drupal')) products.push('Drupal');
                        if (content.includes('joomla')) products.push('Joomla');
                        if (content.includes('magento')) products.push('Magento');
                        if (content.includes('shopify')) products.push('Shopify');
                        
                        // Linux/Unix
                        if (content.includes('linux')) products.push('Linux');
                        if (content.includes('ubuntu')) products.push('Ubuntu');
                        if (content.includes('debian')) products.push('Debian');
                        if (content.includes('centos')) products.push('CentOS');
                        if (content.includes('red hat') || content.includes('rhel')) products.push('Red Hat');
                        if (content.includes('unix')) products.push('Unix');
                        
                        // VPN/Remote access
                        if (content.includes('openvpn')) products.push('OpenVPN');
                        if (content.includes('citrix')) products.push('Citrix');
                        if (content.includes('teamviewer')) products.push('TeamViewer');
                        if (content.includes('anydesk')) products.push('AnyDesk');
                        
                        // Virtualization
                        if (content.includes('hyper-v')) products.push('Hyper-V');
                        if (content.includes('virtualbox')) products.push('VirtualBox');
                        if (content.includes('proxmox')) products.push('Proxmox');
                        
                        // CDN/Network services
                        if (content.includes('cloudflare')) products.push('Cloudflare');
                        if (content.includes('akamai')) products.push('Akamai');
                        if (content.includes('fastly')) products.push('Fastly');
                        
                        // Email security
                        if (content.includes('proofpoint')) products.push('Proofpoint');
                        if (content.includes('mimecast')) products.push('Mimecast');
                        
                        // Backup/Storage
                        if (content.includes('veeam')) products.push('Veeam');
                        if (content.includes('commvault')) products.push('Commvault');
                        if (content.includes('veritas')) products.push('Veritas');
                        
                        // Remove duplicates and limit to 4
                        return [...new Set(products)].slice(0, 4);
                      };
                      
                      const keywordsData = getKeywords();
                      const affectedProducts = getAffectedProducts();
                      
                      return (
                        <div
                          key={article.id || index}
                          className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-md p-3 hover:border-cyan-400/50 transition-all"
                        >
                          {/* Article Title - Large clickable headline */}
                          <h4
                            onClick={() => handleArticleClick(article)}
                            className="text-[15px] font-medium text-white mb-3 leading-tight hover:text-cyan-400 transition-colors cursor-pointer line-clamp-3"
                          >
                            {article.title || 'Untitled Article'}
                          </h4>

                          {/* Header: Time + Source */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-[#FBBF24]" />
                              <span className="text-xs font-medium text-[#FBBF24]">{relativeTime}</span>
                            </div>
                            <span className="text-xs text-purple-400/70 font-medium">
                              {source}
                            </span>
                          </div>

                          {/* Footer: Keywords + Affected Products */}
                          <div className="pt-2 border-t border-purple-500/20 space-y-2">
                            {/* Keywords Section */}
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Keywords Found</div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {keywordsData.displayed.map((keyword: string, i: number) => (
                                  <div key={i} className="inline-flex items-center px-3 py-0.5 rounded-full border text-[10px] font-semibold bg-[#6EE7B7]/10 border-[#6EE7B7]/30 text-[#6EE7B7]">
                                    {keyword}
                                  </div>
                                ))}
                                {keywordsData.total > 5 && (
                                  <div className="inline-flex items-center px-3 py-0.5 rounded-full border text-[10px] font-semibold bg-[#6EE7B7]/10 border-[#6EE7B7]/30 text-[#6EE7B7]">
                                    +{keywordsData.total - 5} more
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Products Section - Only show if products detected */}
                            {affectedProducts.length > 0 && (
                              <div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Products Affected</div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {affectedProducts.map((product: string, i: number) => (
                                    <div key={i} className="inline-flex items-center px-3 py-0.5 rounded-full border text-[10px] font-semibold bg-[#FF9B7F]/10 border-[#FF9B7F]/30 text-[#FF9B7F]">
                                      {product}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                        className="w-full text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-[#00FFFF] hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-[#00FFFF] hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-between"
                      >
                        <span>Go To Threat Tracker</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0 text-[#00FFFF] border border-[#00FFFF]/40 rounded-sm p-0.5" />
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
                  {/* Threat Cards */}
                  <div className="space-y-2.5">
                    {threatArticles.slice(0, 4).map((threat: any, index: number) => {
                      // Calculate security score and severity
                      const securityScore = typeof threat.securityScore === 'string' 
                        ? parseInt(threat.securityScore) 
                        : threat.securityScore || 0;
                      const percentage = securityScore * 10;
                      
                      // Determine severity level and styling
                      let severityColor = 'bg-blue-500';
                      let severityText = 'text-blue-400';
                      
                      if (securityScore >= 8) {
                        severityColor = 'bg-red-500';
                        severityText = 'text-red-400';
                      } else if (securityScore >= 6) {
                        severityColor = 'bg-orange-500';
                        severityText = 'text-orange-400';
                      } else if (securityScore >= 4) {
                        severityColor = 'bg-yellow-500';
                        severityText = 'text-yellow-400';
                      }
                      
                      // Get relative time
                      const getRelativeTime = (dateStr: string) => {
                        const now = new Date();
                        const then = new Date(dateStr);
                        const diffMs = now.getTime() - then.getTime();
                        const diffMins = Math.floor(diffMs / (1000 * 60));
                        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                        
                        if (diffMins < 1) return 'Just now';
                        if (diffMins < 60) return `${diffMins}min ago`;
                        if (diffHrs < 24) return `${diffHrs}hr${diffHrs === 1 ? '' : 's'} ago`;
                        return formatPublishDate(dateStr);
                      };
                      
                      const relativeTime = threat.publishDate ? getRelativeTime(threat.publishDate) :
                                          threat.scrapeDate ? getRelativeTime(threat.scrapeDate) :
                                          threat.createdAt ? getRelativeTime(threat.createdAt) : 'Unknown';
                      
                      // Get source name - formatted as URL domain with extension
                      const getSourceUrl = () => {
                        // Get the full domain from source or url
                        const fullDomain = threat.source?.split('/')[2] || threat.url?.split('/')[2];
                        
                        if (!fullDomain) {
                          // If we have a sourceName, format it as a URL
                          if (threat.sourceName) {
                            const name = threat.sourceName.toLowerCase().replace('www.', '');
                            // If it already has a domain extension, return as is
                            if (name.includes('.')) return name;
                            // Otherwise append .com
                            return `${name}.com`;
                          }
                          return 'unknown.com';
                        }
                        
                        // Return the domain without www (e.g., darkreading.com, bleepingcomputer.com)
                        return fullDomain.replace('www.', '');
                      };
                      const sourceName = getSourceUrl();
                      
                      // Count keywords
                      const getKeywordCount = () => {
                        if (!threat.detectedKeywords) return 0;
                        try {
                          const keywords = typeof threat.detectedKeywords === 'string' 
                            ? JSON.parse(threat.detectedKeywords) 
                            : threat.detectedKeywords;
                          
                          if (typeof keywords === 'object' && keywords !== null) {
                            return Object.values(keywords).flat().length;
                          }
                          return Array.isArray(keywords) ? keywords.length : 0;
                        } catch {
                          return 0;
                        }
                      };
                      
                      const keywordCount = getKeywordCount();
                      
                      // Generate action-oriented statement
                      const getActionStatement = () => {
                        const cve = threat.vulnerabilityId && threat.vulnerabilityId !== 'Unspecified' 
                          ? threat.vulnerabilityId 
                          : null;
                        
                        // Try to get a more specific target from available data
                        let target = threat.targetOS || threat.targetPlatform;
                        
                        // If no target, extract from title and summary
                        if (!target || target === 'Unknown' || target === 'N/A') {
                          const title = (threat.title || '').toLowerCase();
                          const summary = (threat.summary || '').toLowerCase();
                          const content = `${title} ${summary}`;
                          
                          // Check for specific product names first (most specific)
                          if (content.includes('log4j') || content.includes('log4shell')) target = 'Log4j applications';
                          else if (content.includes('exchange') || content.includes('outlook')) target = 'Microsoft Exchange';
                          else if (content.includes('sharepoint')) target = 'SharePoint servers';
                          else if (content.includes('active directory') || content.includes('ad domain')) target = 'Active Directory';
                          else if (content.includes('wordpress') || content.includes('wp-')) target = 'WordPress sites';
                          else if (content.includes('jenkins')) target = 'Jenkins servers';
                          else if (content.includes('confluence') || content.includes('jira')) target = 'Atlassian products';
                          else if (content.includes('gitlab')) target = 'GitLab instances';
                          else if (content.includes('splunk')) target = 'Splunk deployments';
                          else if (content.includes('citrix')) target = 'Citrix systems';
                          else if (content.includes('fortinet')) target = 'Fortinet appliances';
                          else if (content.includes('sophos')) target = 'Sophos products';
                          
                          // Check for platform/system categories
                          else if (content.includes('windows') || content.includes('microsoft')) target = 'Windows systems';
                          else if (content.includes('linux') || content.includes('ubuntu') || content.includes('debian') || content.includes('red hat')) target = 'Linux systems';
                          else if (content.includes('macos') || content.includes('apple') || content.includes('ios')) target = 'Apple systems';
                          else if (content.includes('android')) target = 'Android devices';
                          else if (content.includes('chrome') || content.includes('firefox') || content.includes('safari') || content.includes('browser')) target = 'web browsers';
                          else if (content.includes('apache') || content.includes('nginx') || content.includes('iis') || content.includes('web server')) target = 'web servers';
                          else if (content.includes('oracle') || content.includes('mysql') || content.includes('postgresql') || content.includes('sql server') || content.includes('database')) target = 'database servers';
                          else if (content.includes('cisco') || content.includes('router') || content.includes('firewall') || content.includes('switch')) target = 'network devices';
                          else if (content.includes('vmware') || content.includes('hypervisor') || content.includes('esxi') || content.includes('virtual')) target = 'virtualization platforms';
                          else if (content.includes('adobe') || content.includes('reader') || content.includes('acrobat')) target = 'Adobe products';
                          else if (content.includes('java') || content.includes('jre') || content.includes('jdk')) target = 'Java environments';
                          else if (content.includes('docker') || content.includes('kubernetes') || content.includes('k8s') || content.includes('container')) target = 'container platforms';
                          else if (content.includes('aws') || content.includes('amazon web')) target = 'AWS infrastructure';
                          else if (content.includes('azure') || content.includes('microsoft cloud')) target = 'Azure infrastructure';
                          else if (content.includes('gcp') || content.includes('google cloud')) target = 'Google Cloud';
                          else if (content.includes('cloud')) target = 'cloud infrastructure';
                          else if (content.includes('iot') || content.includes('smart device')) target = 'IoT devices';
                          else if (content.includes('vpn')) target = 'VPN services';
                          else if (content.includes('email') || content.includes('smtp') || content.includes('mail server')) target = 'email systems';
                          else if (content.includes('backup')) target = 'backup solutions';
                          else if (content.includes('endpoint')) target = 'endpoint devices';
                          
                          // Check keywords as last resort before generic fallback
                          else {
                            try {
                              const keywords = typeof threat.detectedKeywords === 'string' 
                                ? JSON.parse(threat.detectedKeywords) 
                                : threat.detectedKeywords;
                              
                              if (keywords && typeof keywords === 'object') {
                                const allKeywords = Object.values(keywords).flat().map((k: any) => k.toString().toLowerCase());
                                
                                // Look for system hints in keywords
                                if (allKeywords.some(k => k.includes('windows'))) target = 'Windows systems';
                                else if (allKeywords.some(k => k.includes('linux'))) target = 'Linux systems';
                                else if (allKeywords.some(k => k.includes('server'))) target = 'server infrastructure';
                                else if (allKeywords.some(k => k.includes('network'))) target = 'network infrastructure';
                                else if (allKeywords.some(k => k.includes('application'))) target = 'applications';
                                else target = 'critical systems';
                              } else {
                                target = 'critical systems';
                              }
                            } catch {
                              target = 'critical systems';
                            }
                          }
                        }
                        
                        const title = threat.title || '';
                        
                        // Extract key threat type from keywords or title
                        let threatType = '';
                        try {
                          const keywords = typeof threat.detectedKeywords === 'string' 
                            ? JSON.parse(threat.detectedKeywords) 
                            : threat.detectedKeywords;
                          
                          if (keywords && typeof keywords === 'object') {
                            const allKeywords = Object.values(keywords).flat() as string[];
                            // Look for common threat types in keywords
                            const priorityKeywords = ['ransomware', 'malware', 'exploit', 'vulnerability', 'breach', 'attack', 'phishing', 'backdoor', 'trojan', 'zero-day'];
                            threatType = allKeywords.find((k: string) => 
                              priorityKeywords.some(p => k.toLowerCase().includes(p))
                            ) || allKeywords[0] || '';
                          }
                        } catch {}
                        
                        // Critical severity - immediate action required
                        if (securityScore >= 8) {
                          if (cve) {
                            return `Apply emergency patch for ${cve} on ${target}`;
                          }
                          if (title.toLowerCase().includes('patch') || title.toLowerCase().includes('update')) {
                            return `Update ${target} immediately to prevent exploit`;
                          }
                          if (threatType) {
                            return `Block ${threatType} targeting ${target} immediately`;
                          }
                          return `Review and secure ${target} against active threat`;
                        }
                        
                        // High severity - urgent action needed
                        if (securityScore >= 6) {
                          if (cve) {
                            return `Patch ${cve} affecting ${target} urgently`;
                          }
                          if (title.toLowerCase().includes('zero-day')) {
                            return `Implement workarounds for zero-day in ${target}`;
                          }
                          if (threatType) {
                            return `Mitigate ${threatType} risk on ${target}`;
                          }
                          return `Update ${target} to latest security version`;
                        }
                        
                        // Medium severity - planned action
                        if (securityScore >= 4) {
                          if (cve) {
                            return `Schedule patch for ${cve} on ${target}`;
                          }
                          if (threatType) {
                            return `Monitor ${threatType} activity affecting ${target}`;
                          }
                          return `Review security updates for ${target}`;
                        }
                        
                        // Low severity - awareness
                        if (cve) {
                          return `Assess ${cve} impact on ${target}`;
                        }
                        return `Monitor potential threat to ${target}`;
                      };
                      
                      const actionStatement = getActionStatement();
                      
                      // Generate time urgency indicator
                      const getUrgencyIndicator = () => {
                        if (securityScore >= 8) {
                          return 'ACT NOW';
                        }
                        if (securityScore >= 6) {
                          return 'Urgent - 24hrs';
                        }
                        if (securityScore >= 4) {
                          return 'Review this week';
                        }
                        return 'Monitor';
                      };
                      
                      // Classify source type
                      const getSourceType = () => {
                        const source = (threat.source || threat.url || '').toLowerCase();
                        const title = (threat.title || '').toLowerCase();
                        
                        // Official vendor/company sources
                        if (source.includes('microsoft.com') || source.includes('cisco.com') || 
                            source.includes('google.com') || source.includes('apple.com') || 
                            source.includes('oracle.com') || source.includes('adobe.com') ||
                            title.includes('microsoft security') || title.includes('cisco advisory')) {
                          return 'Vendor Advisory';
                        }
                        
                        // Government/Official sources
                        if (source.includes('.gov') || source.includes('cisa') || source.includes('nist') ||
                            source.includes('nvd.nist')) {
                          return 'Official Advisory';
                        }
                        
                        // Security research/vulnerability discovery
                        if (source.includes('research') || source.includes('.edu') || 
                            source.includes('arxiv') || title.includes('researcher') ||
                            title.includes('vulnerability discovered')) {
                          return 'Security Research';
                        }
                        
                        // Security firms/vendors
                        if (source.includes('crowdstrike') || source.includes('paloalto') || 
                            source.includes('fireeye') || source.includes('mandiant') ||
                            source.includes('kaspersky') || source.includes('sophos')) {
                          return 'Threat Intel';
                        }
                        
                        // Security-specific news
                        if (source.includes('bleepingcomputer') || source.includes('securityweek') || 
                            source.includes('darkreading') || source.includes('threatpost') ||
                            source.includes('krebs')) {
                          return 'Security News';
                        }
                        
                        // General tech/industry news
                        return 'Industry News';
                      };
                      
                      // Determine patch/fix status
                      const getPatchStatus = () => {
                        const title = (threat.title || '').toLowerCase();
                        const summary = (threat.summary || '').toLowerCase();
                        const content = `${title} ${summary}`;
                        
                        // Check for patch availability
                        if (content.includes('patch available') || content.includes('update available') ||
                            content.includes('security update') || content.includes('hotfix') ||
                            content.includes('patch released')) {
                          return 'Patch available';
                        }
                        
                        // Check for workarounds
                        if (content.includes('workaround') || content.includes('mitigation') ||
                            content.includes('temporary fix') || content.includes('interim solution')) {
                          return 'Workaround exists';
                        }
                        
                        // Check for no fix scenarios
                        if (content.includes('no patch') || content.includes('no fix') ||
                            content.includes('zero-day') || content.includes('unpatched') ||
                            content.includes('awaiting patch')) {
                          return 'No fix yet';
                        }
                        
                        // Check for update recommendations
                        if (content.includes('update') || content.includes('upgrade') ||
                            content.includes('latest version')) {
                          return 'Update recommended';
                        }
                        
                        // Default based on severity (four levels)
                        if (securityScore >= 8) {
                          return 'Solution pending';
                        }
                        if (securityScore >= 6) {
                          return 'Check vendor status';
                        }
                        if (securityScore >= 4) {
                          return 'Monitor for updates';
                        }
                        return 'Assess exposure';
                      };
                      
                      const urgencyIndicator = getUrgencyIndicator();
                      const sourceType = getSourceType();
                      const patchStatus = getPatchStatus();
                      
                      return (
                        <div
                          key={threat.id || index}
                          onClick={() => handleThreatClick(threat)}
                          className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-md p-2.5 hover:border-cyan-400/50 transition-all cursor-pointer"
                        >
                          {/* Top Badges: Urgency Indicator + Patch Status */}
                          <div className="flex items-center gap-2 text-xs flex-wrap mb-2">
                            <span className={`${severityText} font-medium`}>{urgencyIndicator}</span>
                            <span className="text-blue-400 font-medium">{patchStatus}</span>
                          </div>
                          
                          {/* Action Statement */}
                          <div className="text-[15px] text-white font-medium mb-2 line-clamp-3 leading-tight">
                            {actionStatement}
                          </div>
                          
                          {/* Severity Bar - Pill Shape */}
                          <div className="bg-gray-700/30 rounded-full p-1.5 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-800/50 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full ${severityColor} transition-all`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className={`text-xs font-semibold ${severityText} pr-1`}>
                                {percentage}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Footer Metadata: Source Type + Timestamp */}
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="text-purple-400/70 font-medium truncate lowercase">
                              {sourceType === 'Security News' ? sourceName : sourceType}
                            </span>
                            <span className="text-amber-400 font-medium">{relativeTime}</span>
                          </div>
                        </div>
                      );
                    })}
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
            title="Report Center"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/dashboard/news-capsule/home');
                        }}
                        className="w-full text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-[#00FFFF] hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-[#00FFFF] hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-between"
                      >
                        <span>Go To Report Center</span>
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
                  {/* Recent Reports - 2 Column Grid */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {capsuleReports.slice(0, 4).map((report: any, index: number) => {
                        const articleCount = report.articles?.length || 0;
                        const topic = report.topic || 'Executive Brief';
                        
                        // Calculate unique sources
                        const uniqueSources = report.articles 
                          ? new Set(report.articles.map((a: any) => a.sourcePublication)).size 
                          : 0;
                        
                        // Count CVEs (articles with vulnerabilityId)
                        const cveCount = report.articles 
                          ? report.articles.filter((a: any) => a.vulnerabilityId && a.vulnerabilityId !== 'Unspecified').length 
                          : 0;
                        
                        // Get target platform (most common or first)
                        const targetPlatform = report.articles && report.articles.length > 0
                          ? report.articles[0].targetOS || 'Unknown'
                          : 'Unknown';
                        
                        // Format timestamp
                        const fullDate = report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'Unknown';
                        
                        // Calculate edition number for reports on the same date (higher number = more recent)
                        const reportDate = report.createdAt ? new Date(report.createdAt).toDateString() : null;
                        const editionNumber = reportDate 
                          ? capsuleReports.filter((r: any) => {
                              const rDate = r.createdAt ? new Date(r.createdAt).toDateString() : null;
                              return rDate === reportDate && new Date(r.createdAt).getTime() <= new Date(report.createdAt).getTime();
                            }).length
                          : 1;
                        
                        const fullTime = report.createdAt ? (() => {
                          const timeStr = new Date(report.createdAt).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            timeZoneName: 'short'
                          });
                          // Force standard time abbreviations
                          return timeStr
                            .replace('EDT', 'EST')
                            .replace('CDT', 'CST')
                            .replace('MDT', 'MST')
                            .replace('PDT', 'PST')
                            .replace('ADT', 'AST')
                            .replace('HDT', 'HST');
                        })() : '';
                        
                        // Calculate relative time
                        const getRelativeTime = (date: string) => {
                          const now = new Date();
                          const then = new Date(date);
                          const diffMs = now.getTime() - then.getTime();
                          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                          
                          if (diffHrs < 1) return 'Just now';
                          if (diffHrs < 24) return `${diffHrs}${diffHrs === 1 ? 'hr' : 'hrs'} ago`;
                          if (diffDays === 1) return 'Yesterday';
                          if (diffDays < 7) return `${diffDays} days ago`;
                          return '';
                        };
                        
                        const relativeTime = report.createdAt ? getRelativeTime(report.createdAt) : '';
                        
                        return (
                          <div
                            key={report.id || index}
                            onClick={(e) => handleCapsuleClick(e, report)}
                            className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-md px-3 py-5 hover:border-cyan-400/50 transition-all cursor-pointer"
                          >
                              <div className="text-sm text-white font-medium leading-tight">
                                {fullDate}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Edition {editionNumber}
                              </div>
                              
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-2">Generated</div>
                              <div className="text-xs text-[#FBBF24] mt-0.5">
                                {fullTime}
                              </div>
                              
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-2">Articles</div>
                              <div className="text-xs text-blue-400 mt-0.5">
                                {articleCount} analyzed
                              </div>
                              <div className="text-xs text-purple-400/70">
                                {uniqueSources} {uniqueSources === 1 ? 'source' : 'sources'}
                              </div>
                              
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-2">Vulnerabilities</div>
                              <div className="text-xs text-orange-500 mt-0.5">
                                {cveCount} {cveCount === 1 ? 'CVE' : 'CVEs'} identified
                              </div>
                              <div className="text-xs text-rose-400">
                                {targetPlatform}
                              </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex flex-col gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/dashboard/news-capsule/research');
                      }}
                      className="text-xs font-medium px-3 py-3 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-[#00FFFF] hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-[#00FFFF] hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-center gap-2"
                    >
                      <Radar className="w-3.5 h-3.5" />
                      <span>Create New Report</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/dashboard/news-capsule/home');
                      }}
                      className="text-xs font-medium px-3 py-3 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-[#00FFFF] hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-[#00FFFF] hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View All Reports</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (capsuleReports && capsuleReports.length > 0) {
                          navigate(`/dashboard/news-capsule/reports/${capsuleReports[0].id}`);
                        }
                      }}
                      disabled={!capsuleReports || capsuleReports.length === 0}
                      className="text-xs font-medium px-3 py-3 rounded-md transition-all duration-300 bg-gradient-to-r from-purple-500/20 to-purple-600/20 backdrop-blur-sm border border-purple-500/40 shadow-sm text-[#00FFFF] hover:from-purple-500/30 hover:to-purple-600/30 hover:border-purple-400/60 hover:text-[#00FFFF] hover:shadow-lg hover:shadow-purple-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-500/20 disabled:hover:to-purple-600/20 disabled:hover:border-purple-500/40"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Latest Report</span>
                    </button>
                  </div>
                  
                </>
              ) : (
                <div className="bg-black rounded-md p-4 border border-purple-500/30 text-center">
                  <Radar className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-1">No reports generated yet</p>
                  <p className="text-xs text-gray-500 mb-3">Start processing articles to create executive reports</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/dashboard/news-capsule/home');
                    }}
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
