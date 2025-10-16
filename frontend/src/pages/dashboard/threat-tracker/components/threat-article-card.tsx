import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock,
  User,
  Loader2,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Zap,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ThreatArticle } from "@shared/db/schema/threat-tracker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { formatDateOnly } from "@/utils/date-utils";


// Extend the ThreatArticle type to include securityScore and sourceName
interface ExtendedThreatArticle extends ThreatArticle {
  securityScore: string | null;
  sourceName?: string | null;
  matchedKeywords?: string[];
  matchedSoftware?: string[];
  matchedCompanies?: string[];
  matchedHardware?: string[];
  threatSeverityScore?: string | number | null;
  threatLevel?: string | null;
  threatMetadata?: any;
  cves?: string[];
  affectedSoftware?: Array<{
    name: string;
    confidence: number;
    specificity: string;
  }>;
  attackVectors?: string[];
  threatActors?: string[];
}

interface ThreatArticleCardProps {
  article: ExtendedThreatArticle;
  isPending?: boolean;
  onKeywordClick?: (keyword: string, category: string) => void;
  onSendToCapsule?: (url: string) => void;
  articleIndex?: number;
  totalArticles?: number;
}

interface KeywordCategories {
  threats: string[];
  vendors: string[];
  clients: string[];
  hardware: string[];
}

export function ThreatArticleCard({
  article,
  isPending = false,
  onKeywordClick,
  onSendToCapsule,
  articleIndex,
  totalArticles,
}: ThreatArticleCardProps) {
  const [openAlert, setOpenAlert] = useState(false);
  const [sendingToCapsule, setSendingToCapsule] = useState(false);

  const handleSendToCapsule = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSendToCapsule) {
      setSendingToCapsule(true);
      try {
        await onSendToCapsule(article.url);
      } finally {
        setSendingToCapsule(false);
      }
    }
  };

  // Parse the relevance score (either string or number)
  const relevanceScore =
    typeof article.relevanceScore === "string"
      ? parseInt(article.relevanceScore, 10)
      : article.relevanceScore || 0;

  // Parse the security/severity score (either string or number)
  const securityScore =
    typeof article.securityScore === "string"
      ? parseInt(article.securityScore, 10)
      : article.securityScore || 0;
      
  // Parse the new threat severity score (0-100 scale)
  const threatSeverityScore = 
    typeof article.threatSeverityScore === "string"
      ? parseFloat(article.threatSeverityScore)
      : typeof article.threatSeverityScore === "number"
      ? article.threatSeverityScore
      : 0;

  // Safety check in case scores are NaN
  const normalizedRelevanceScore = isNaN(relevanceScore) ? 0 : relevanceScore;
  const normalizedSecurityScore = isNaN(securityScore) ? 0 : securityScore;
  const normalizedThreatSeverity = isNaN(threatSeverityScore) ? 0 : threatSeverityScore;

  // Calculate color based on score (0-10 scale)
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-red-500";
    if (score >= 6) return "text-orange-500";
    if (score >= 4) return "text-yellow-500";
    return "text-green-500";
  };

  // Progress bar color based on score
  const getProgressColor = (score: number) => {
    if (score >= 8) return "bg-red-500";
    if (score >= 6) return "bg-orange-500";
    if (score >= 4) return "bg-yellow-500";
    return "bg-green-500";
  };
  
  // Get threat level badge color and styling
  const getThreatLevelColor = (level: string) => {
    switch(level?.toLowerCase()) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  
  // Determine which score to use for display
  const displayScore = normalizedThreatSeverity > 0 ? normalizedThreatSeverity / 10 : normalizedSecurityScore;
  const threatLevel = article.threatLevel || (
    displayScore >= 8 ? 'critical' :
    displayScore >= 6 ? 'high' :
    displayScore >= 4 ? 'medium' : 'low'
  );

  // Get all detected keywords from the different categories
  const getDetectedKeywords = (): KeywordCategories => {
    if (!article.detectedKeywords)
      return { threats: [], vendors: [], clients: [], hardware: [] };

    try {
      // If it's already an object with categories
      if (
        typeof article.detectedKeywords === "object" &&
        !Array.isArray(article.detectedKeywords)
      ) {
        return article.detectedKeywords as KeywordCategories;
      }

      // If it's a string, parse it
      if (typeof article.detectedKeywords === "string") {
        try {
          return JSON.parse(article.detectedKeywords) as KeywordCategories;
        } catch (e) {
          return { threats: [], vendors: [], clients: [], hardware: [] };
        }
      }

      // Default empty structure
      return { threats: [], vendors: [], clients: [], hardware: [] };
    } catch (e) {
      console.error("Error parsing detected keywords:", e);
      return { threats: [], vendors: [], clients: [], hardware: [] };
    }
  };

  const detectedKeywords = getDetectedKeywords();
  const hasKeywords = Object.values(detectedKeywords).some(
    (arr: string[]) => arr.length > 0,
  );

  // Unified accent color based on threat severity using consistent scale
  const getUnifiedAccentColor = () => {
    if (normalizedSecurityScore >= 8) return "from-red-500/30";    // Critical - red
    if (normalizedSecurityScore >= 6) return "from-orange-500/30"; // High - orange  
    if (normalizedSecurityScore >= 4) return "from-yellow-500/30"; // Medium - yellow
    if (normalizedSecurityScore >= 2) return "from-blue-500/30";   // Low - blue
    return "from-[#00FFFF]/30"; // Minimal - primary cyan
  };

  return (
    <div className="h-full overflow-hidden transition-all duration-300 group-hover:translate-y-[-3px]">
      <div
        className={cn(
          "h-full rounded-md border border-slate-700/50 bg-gradient-to-b from-transparent to-black/10 backdrop-blur-sm overflow-hidden",
          "hover:border-[#00FFFF]/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)] transition-all duration-300",
          "flex flex-col relative",
          isPending && "bg-black/30",
        )}
      >
        <div
          className={cn(
            "h-1.5 w-full bg-gradient-to-r",
            isPending
              ? "from-slate-500/50 to-slate-700/50 animate-pulse"
              : getUnifiedAccentColor(),
          )}
        ></div>

        <div className="flex-1 p-4 sm:p-5 flex flex-col">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-white line-clamp-2 leading-6 group-hover:text-[#00FFFF] transition-colors flex-1 pr-2">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                {article.title}
              </a>
            </h3>

            {/* Threat level and severity score badges */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Threat level badge */}
              {threatLevel && (
                <Badge
                  className={cn(
                    "text-xs px-2 py-0.5",
                    getThreatLevelColor(threatLevel)
                  )}
                >
                  {threatLevel.toUpperCase()}
                </Badge>
              )}
              
              {/* Threat severity score */}
              <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full">
                <Zap
                  className={cn(
                    "h-3.5 w-3.5",
                    getScoreColor(displayScore),
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-semibold leading-4",
                    getScoreColor(displayScore),
                  )}
                >
                  {displayScore.toFixed(1)}/10
                </span>
              </div>
            </div>
          </div>

          {/* Score indicators */}
          <div className="space-y-3 mb-3">
            {/* Severity score indicator */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400 flex items-center gap-1 leading-4">
                  <Zap className="h-3 w-3" /> Threat Severity
                </span>
                <span
                  className={cn(
                    "text-xs font-medium leading-4",
                    getScoreColor(normalizedSecurityScore),
                  )}
                >
                  {normalizedSecurityScore * 10}%
                </span>
              </div>
              <Progress
                value={normalizedSecurityScore * 10}
                className="h-1.5 bg-slate-700/50"
                indicatorClassName={cn(
                  "transition-all",
                  getProgressColor(normalizedSecurityScore),
                )}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            {(article.author && article.author !== "Unknown") ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 leading-4">
                <User className="h-3 w-3" />
                <span className="font-medium">{article.author}</span>
              </div>
            ) : article.sourceName ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 leading-4">
                <User className="h-3 w-3" />
                <span className="font-medium">{article.sourceName}</span>
              </div>
            ) : null}

            <div className="flex items-center gap-1.5 text-xs text-slate-400 leading-4">
              <Clock className="h-3 w-3" />
              <span className="font-medium">
                {article.publishDate
                  ? formatDateOnly(article.publishDate)
                  : article.scrapeDate
                    ? formatDateOnly(article.scrapeDate)
                    : "Unknown date"}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-300 mb-4 line-clamp-3 flex-1 leading-5">
            {article.summary}
          </p>

          {hasKeywords && (
            <div className="space-y-2 mb-4">
              {detectedKeywords.threats &&
                detectedKeywords.threats.length > 0 && (
                  <div>
                    <span className="text-xs text-red-400 flex items-center gap-1 mb-1 leading-4 font-medium">
                      <AlertTriangle className="h-3 w-3" /> Threats
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedKeywords.threats
                        .slice(0, 3)
                        .map((keyword: string) => (
                          <Badge
                            key={`threat-${keyword}`}
                            variant="outline"
                            className="bg-red-500/10 text-xs font-medium text-red-400 hover:bg-red-500/20 hover:text-red-400 border-red-500/30 cursor-pointer transition-colors truncate max-w-24 leading-4"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onKeywordClick)
                                onKeywordClick(keyword, "threat");
                            }}
                          >
                            {keyword}
                          </Badge>
                        ))}
                      {detectedKeywords.threats.length > 3 && (
                        <span className="text-xs font-medium text-red-400 leading-4">
                          +{detectedKeywords.threats.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {detectedKeywords.vendors &&
                detectedKeywords.vendors.length > 0 && (
                  <div>
                    <span className="text-xs text-blue-400 flex items-center gap-1 mb-1 leading-4 font-medium">
                      <Shield className="h-3 w-3" /> Vendors
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedKeywords.vendors
                        .slice(0, 3)
                        .map((keyword: string) => (
                          <Badge
                            key={`vendor-${keyword}`}
                            variant="outline"
                            className="bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/20 hover:text-blue-400 border-blue-500/30 cursor-pointer transition-colors truncate max-w-24 leading-4"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onKeywordClick)
                                onKeywordClick(keyword, "vendor");
                            }}
                          >
                            {keyword}
                          </Badge>
                        ))}
                      {detectedKeywords.vendors.length > 3 && (
                        <span className="text-xs font-medium text-blue-400 leading-4">
                          +{detectedKeywords.vendors.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {detectedKeywords.clients &&
                detectedKeywords.clients.length > 0 && (
                  <div>
                    <span className="text-xs text-[#BF00FF] flex items-center gap-1 mb-1 leading-4 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Clients
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedKeywords.clients
                        .slice(0, 3)
                        .map((keyword: string) => (
                          <Badge
                            key={`client-${keyword}`}
                            variant="outline"
                            className="bg-[#BF00FF]/10 text-xs font-medium text-[#BF00FF] hover:bg-[#BF00FF]/20 hover:text-[#BF00FF] border-[#BF00FF]/30 cursor-pointer transition-colors truncate max-w-24 leading-4"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onKeywordClick)
                                onKeywordClick(keyword, "client");
                            }}
                          >
                            {keyword}
                          </Badge>
                        ))}
                      {detectedKeywords.clients.length > 3 && (
                        <span className="text-xs font-medium text-[#BF00FF] leading-4">
                          +{detectedKeywords.clients.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {detectedKeywords.hardware &&
                detectedKeywords.hardware.length > 0 && (
                  <div>
                    <span className="text-xs text-[#00FFFF] flex items-center gap-1 mb-1 leading-4 font-medium">
                      <Shield className="h-3 w-3" /> Hardware/Software
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedKeywords.hardware
                        .slice(0, 3)
                        .map((keyword: string) => (
                          <Badge
                            key={`hardware-${keyword}`}
                            variant="outline"
                            className="bg-[#00FFFF]/10 text-xs font-medium text-[#00FFFF] hover:bg-[#00FFFF]/20 hover:text-[#00FFFF] border-[#00FFFF]/30 cursor-pointer transition-colors truncate max-w-24 leading-4"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onKeywordClick)
                                onKeywordClick(keyword, "hardware");
                            }}
                          >
                            {keyword}
                          </Badge>
                        ))}
                      {detectedKeywords.hardware.length > 3 && (
                        <span className="text-xs font-medium text-[#00FFFF] leading-4">
                          +{detectedKeywords.hardware.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mt-auto pt-3 border-t border-slate-700/50">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
              {/* Matched Tech Stack Items */}
              {((article.matchedSoftware && article.matchedSoftware.length > 0) ||
                (article.matchedHardware && article.matchedHardware.length > 0) ||
                (article.matchedCompanies && article.matchedCompanies.length > 0) ||
                (article.matchedKeywords && article.matchedKeywords.length > 0)) && (
                <>
                  {/* Software Matches */}
                  {article.matchedSoftware && article.matchedSoftware.slice(0, 2).map((item) => (
                    <Badge
                      key={`software-${item}`}
                      variant="outline"
                      className="text-xs font-medium cursor-pointer transition-colors truncate max-w-32 leading-4 bg-[#00FFFF]/10 text-[#00FFFF] border-[#00FFFF]/30 hover:bg-[#00FFFF]/20"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onKeywordClick) onKeywordClick(item, "software");
                      }}
                      title={`Software: ${item}`}
                    >
                      <Shield className="h-3 w-3 mr-1 flex-shrink-0" />
                      {item}
                    </Badge>
                  ))}
                  
                  {/* Hardware Matches */}
                  {article.matchedHardware && article.matchedHardware.slice(0, 2).map((item) => (
                    <Badge
                      key={`hardware-${item}`}
                      variant="outline"
                      className="text-xs font-medium cursor-pointer transition-colors truncate max-w-32 leading-4 bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onKeywordClick) onKeywordClick(item, "hardware");
                      }}
                      title={`Hardware: ${item}`}
                    >
                      <Zap className="h-3 w-3 mr-1 flex-shrink-0" />
                      {item}
                    </Badge>
                  ))}
                  
                  {/* Company Matches */}
                  {article.matchedCompanies && article.matchedCompanies.slice(0, 2).map((item) => (
                    <Badge
                      key={`company-${item}`}
                      variant="outline"
                      className="text-xs font-medium cursor-pointer transition-colors truncate max-w-32 leading-4 bg-[#BF00FF]/10 text-[#BF00FF] border-[#BF00FF]/30 hover:bg-[#BF00FF]/20"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onKeywordClick) onKeywordClick(item, "company");
                      }}
                      title={`Company: ${item}`}
                    >
                      <User className="h-3 w-3 mr-1 flex-shrink-0" />
                      {item}
                    </Badge>
                  ))}
                  
                  {/* Keyword Matches */}
                  {article.matchedKeywords && article.matchedKeywords.slice(0, 2).map((keyword) => (
                    <Badge
                      key={`keyword-${keyword}`}
                      variant="outline"
                      className="text-xs font-medium cursor-pointer transition-colors truncate max-w-32 leading-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onKeywordClick) onKeywordClick(keyword, "keyword");
                      }}
                      title={`Keyword: ${keyword}`}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                      {keyword}
                    </Badge>
                  ))}
                  
                  {/* Show count of additional matches */}
                  {(() => {
                    const totalMatches = 
                      (article.matchedSoftware?.length || 0) + 
                      (article.matchedHardware?.length || 0) + 
                      (article.matchedCompanies?.length || 0) + 
                      (article.matchedKeywords?.length || 0);
                    const shownMatches = 
                      Math.min(2, article.matchedSoftware?.length || 0) + 
                      Math.min(2, article.matchedHardware?.length || 0) + 
                      Math.min(2, article.matchedCompanies?.length || 0) + 
                      Math.min(2, article.matchedKeywords?.length || 0);
                    const additionalCount = totalMatches - shownMatches;
                    
                    return additionalCount > 0 ? (
                      <span className="text-xs font-medium text-slate-400 leading-4">
                        +{additionalCount} more
                      </span>
                    ) : null;
                  })()}
                </>
              )}
              
              {/* Article counter - only show if no matches */}
              {(!article.matchedSoftware || article.matchedSoftware.length === 0) && 
               (!article.matchedHardware || article.matchedHardware.length === 0) && 
               (!article.matchedCompanies || article.matchedCompanies.length === 0) && 
               (!article.matchedKeywords || article.matchedKeywords.length === 0) && 
               articleIndex !== undefined && totalArticles !== undefined && (
                <div className="text-xs text-slate-400 flex-shrink-0">
                  Article {articleIndex + 1} of {totalArticles}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onSendToCapsule && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending || sendingToCapsule}
                  onClick={handleSendToCapsule}
                  className={cn(
                    "h-8 w-8 p-2",
                    "border border-slate-700 rounded-full",
                    "text-slate-400 hover:text-[#00FFFF] hover:bg-[#00FFFF]/10 hover:border-[#00FFFF]/30",
                    "transition-all duration-200",
                    (isPending || sendingToCapsule) &&
                      "cursor-not-allowed opacity-70",
                  )}
                  title="Send to News Capsule"
                >
                  {sendingToCapsule ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
