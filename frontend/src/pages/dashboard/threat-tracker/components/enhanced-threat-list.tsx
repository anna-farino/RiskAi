import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useFetch } from "@/hooks/use-fetch";
import { ThreatArticleCard } from "./threat-article-card";
import { ThreatScoreBreakdown } from "./threat-score-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw, 
  Loader2, 
  SortAsc, 
  Filter,
  AlertTriangle,
  Zap,
  Target,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EnhancedThreatArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  author?: string | null;
  publishDate?: string | null;
  scrapeDate?: string | null;
  isCybersecurity: boolean;
  
  // Severity scores (user-independent)
  threatSeverityScore?: string | null;
  cvssScore?: string | null;
  exploitabilityScore?: string | null;
  impactScore?: string | null;
  attackVectorScore?: string | null;
  
  // Relevance scores (user-specific)
  relevanceScore?: string | null;
  softwareScore?: string | null;
  hardwareScore?: string | null;
  vendorScore?: string | null;
  clientScore?: string | null;
  keywordScore?: string | null;
  
  // Matched entities
  matchedSoftware?: string[];
  matchedCompanies?: string[];
  matchedHardware?: string[];
  matchedKeywords?: string[];
  
  // Source information
  sourceName?: string | null;
}

interface ArticleEntities {
  software?: Array<{ name: string; versionFrom?: string; versionTo?: string }>;
  hardware?: Array<{ name: string; manufacturer?: string }>;
  companies?: Array<{ name: string; type: string; mentionType?: string }>;
  cves?: Array<{ cveId: string; cvssScore?: number }>;
  threatActors?: Array<{ name: string; type?: string }>;
}

export function EnhancedThreatList() {
  const fetchWithAuth = useFetch();
  const [sortBy, setSortBy] = useState<'relevance' | 'severity' | 'date'>('relevance');
  const [minSeverity, setMinSeverity] = useState<number>(0);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [articleEntities, setArticleEntities] = useState<ArticleEntities | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Fetch articles with relevance scores
  const { data: articles, isLoading, refetch } = useQuery({
    queryKey: ['/api/threat-tracker/articles/with-relevance', sortBy, minSeverity],
    queryFn: async () => {
      const params = new URLSearchParams({
        sortBy,
        minSeverity: minSeverity.toString(),
        limit: '50'
      });
      const response = await fetch(`/api/threat-tracker/articles/with-relevance?${params}`);
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json() as Promise<EnhancedThreatArticle[]>;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });
  
  // Fetch relevance calculation status
  const { data: relevanceStatus } = useQuery({
    queryKey: ['/api/threat-tracker/relevance/status'],
    queryFn: async () => {
      const response = await fetch('/api/threat-tracker/relevance/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json();
    },
    refetchInterval: 5000 // Check status every 5 seconds
  });
  
  // Trigger relevance calculation mutation
  const calculateRelevance = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth('/api/threat-tracker/relevance/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRecalculate: false })
      });
      if (!response.ok) throw new Error('Failed to start relevance calculation');
      return response.json();
    },
    onSuccess: () => {
      setIsCalculating(true);
      // Refetch status and articles after starting calculation
      queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/relevance/status'] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/threat-tracker/articles/with-relevance'] });
      }, 2000);
    }
  });
  
  // Fetch article entities when an article is selected
  const fetchArticleEntities = async (articleId: string) => {
    try {
      const response = await fetch(`/api/threat-tracker/articles/${articleId}/entities`);
      if (!response.ok) throw new Error('Failed to fetch entities');
      const entities = await response.json();
      setArticleEntities(entities);
    } catch (error) {
      console.error('Error fetching entities:', error);
      setArticleEntities(null);
    }
  };
  
  // Monitor calculation progress
  useEffect(() => {
    if (relevanceStatus && isCalculating) {
      if (relevanceStatus.pendingArticles === 0) {
        setIsCalculating(false);
        refetch();
      }
    }
  }, [relevanceStatus, isCalculating, refetch]);
  
  const handleArticleClick = (articleId: string) => {
    setSelectedArticle(articleId);
    fetchArticleEntities(articleId);
    setShowDetails(true);
  };
  
  const getSeverityBadgeVariant = (score: number): "destructive" | "secondary" | "default" | "outline" => {
    if (score >= 8) return "destructive";
    if (score >= 6) return "secondary";
    if (score >= 4) return "default";
    return "outline";
  };
  
  const parseScore = (score: string | null | undefined): number => {
    if (!score) return 0;
    const parsed = typeof score === 'string' ? parseFloat(score) : score;
    return isNaN(parsed) ? 0 : parsed;
  };
  
  // Calculate statistics
  const stats = {
    totalArticles: articles?.length || 0,
    highSeverity: articles?.filter(a => parseScore(a.threatSeverityScore) >= 7).length || 0,
    highRelevance: articles?.filter(a => parseScore(a.relevanceScore) >= 7).length || 0,
    criticalThreats: articles?.filter(a => 
      parseScore(a.threatSeverityScore) >= 8 && parseScore(a.relevanceScore) >= 7
    ).length || 0
  };
  
  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card className="border-slate-700/50 bg-gradient-to-b from-transparent to-black/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Enhanced Threat Analysis</CardTitle>
            <div className="flex items-center gap-2">
              {relevanceStatus && relevanceStatus.pendingArticles > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Calculating: {relevanceStatus.scoredArticles}/{relevanceStatus.totalArticles}
                </Badge>
              )}
              <Button 
                size="sm"
                variant="outline"
                onClick={() => calculateRelevance.mutate()}
                disabled={calculateRelevance.isPending || isCalculating}
              >
                {(calculateRelevance.isPending || isCalculating) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Calculate Relevance
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{stats.totalArticles}</div>
              <div className="text-xs text-slate-400">Total Threats</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{stats.highSeverity}</div>
              <div className="text-xs text-slate-400">High Severity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{stats.highRelevance}</div>
              <div className="text-xs text-slate-400">High Relevance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{stats.criticalThreats}</div>
              <div className="text-xs text-slate-400">Critical to You</div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <SortAsc className="h-4 w-4 text-slate-400" />
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">By Relevance</SelectItem>
                  <SelectItem value="severity">By Severity</SelectItem>
                  <SelectItem value="date">By Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <Select value={minSeverity.toString()} onValueChange={(value) => setMinSeverity(parseInt(value))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Severities</SelectItem>
                  <SelectItem value="3">Low+ (≥3)</SelectItem>
                  <SelectItem value="5">Medium+ (≥5)</SelectItem>
                  <SelectItem value="7">High+ (≥7)</SelectItem>
                  <SelectItem value="9">Critical (≥9)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Progress indicator if calculating */}
          {isCalculating && relevanceStatus && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Processing relevance scores...</span>
                <span className="text-sm text-slate-300">
                  {Math.round((relevanceStatus.scoredArticles / relevanceStatus.totalArticles) * 100)}%
                </span>
              </div>
              <Progress 
                value={(relevanceStatus.scoredArticles / relevanceStatus.totalArticles) * 100}
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Threat Articles List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#00FFFF]" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles?.map((article) => (
            <div 
              key={article.id} 
              className="cursor-pointer"
              onClick={() => handleArticleClick(article.id)}
            >
              <div className="relative">
                <ThreatArticleCard
                  article={{
                    id: article.id,
                    title: article.title,
                    summary: article.summary,
                    url: article.url,
                    author: article.author ?? null,
                    publishDate: article.publishDate ? new Date(article.publishDate) : null,
                    scrapeDate: article.scrapeDate ? new Date(article.scrapeDate) : null,
                    relevanceScore: article.relevanceScore ?? null,
                    securityScore: article.threatSeverityScore ?? null,
                    detectedKeywords: {
                      threats: [],
                      vendors: [],
                      clients: [],
                      hardware: []
                    },
                    content: article.summary,
                    userId: '',
                    sourceId: '',
                    markedForCapsule: false,
                    sourceName: article.sourceName ?? null,
                    matchedKeywords: article.matchedKeywords ?? []
                  }}
                />
                {/* Overlay indicators for high scores */}
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  {parseScore(article.threatSeverityScore) >= 8 && (
                    <Badge variant="destructive" className="text-xs flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Critical
                    </Badge>
                  )}
                  {parseScore(article.relevanceScore) >= 8 && (
                    <Badge className="bg-blue-500 text-xs flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Relevant
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Article Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {selectedArticle && articles?.find(a => a.id === selectedArticle)?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedArticle && articles?.find(a => a.id === selectedArticle) && (
            <ThreatScoreBreakdown
              threatSeverityScore={parseScore(articles.find(a => a.id === selectedArticle)?.threatSeverityScore)}
              cvssScore={parseScore(articles.find(a => a.id === selectedArticle)?.cvssScore)}
              exploitabilityScore={parseScore(articles.find(a => a.id === selectedArticle)?.exploitabilityScore)}
              impactScore={parseScore(articles.find(a => a.id === selectedArticle)?.impactScore)}
              attackVectorScore={parseScore(articles.find(a => a.id === selectedArticle)?.attackVectorScore)}
              relevanceScore={parseScore(articles.find(a => a.id === selectedArticle)?.relevanceScore)}
              softwareScore={parseScore(articles.find(a => a.id === selectedArticle)?.softwareScore)}
              hardwareScore={parseScore(articles.find(a => a.id === selectedArticle)?.hardwareScore)}
              vendorScore={parseScore(articles.find(a => a.id === selectedArticle)?.vendorScore)}
              clientScore={parseScore(articles.find(a => a.id === selectedArticle)?.clientScore)}
              keywordScore={parseScore(articles.find(a => a.id === selectedArticle)?.keywordScore)}
              entities={articleEntities || {}}
              matchedSoftware={articles.find(a => a.id === selectedArticle)?.matchedSoftware}
              matchedHardware={articles.find(a => a.id === selectedArticle)?.matchedHardware}
              matchedCompanies={articles.find(a => a.id === selectedArticle)?.matchedCompanies}
              matchedKeywords={articles.find(a => a.id === selectedArticle)?.matchedKeywords}
            />
          )}
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedArticle) {
                  const article = articles?.find(a => a.id === selectedArticle);
                  if (article) {
                    window.open(article.url, '_blank');
                  }
                }
              }}
            >
              View Full Article
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}