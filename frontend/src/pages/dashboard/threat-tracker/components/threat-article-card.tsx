import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Trash2,
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
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { DeleteAlertDialog } from "@/components/delete-alert-dialog";
import { Progress } from "@/components/ui/progress";

// Extend the ThreatArticle type to include securityScore
interface ExtendedThreatArticle extends ThreatArticle {
  securityScore: string | null;
}

interface ThreatArticleCardProps {
  article: ExtendedThreatArticle;
  onDelete: () => void;
  isPending?: boolean;
  onKeywordClick?: (keyword: string, category: string) => void;
  onSendToCapsule?: (url: string) => void;
  onMarkForCapsule?: () => void;
  onUnmarkFromCapsule?: () => void;
}

interface KeywordCategories {
  threats: string[];
  vendors: string[];
  clients: string[];
  hardware: string[];
}

export function ThreatArticleCard({
  article,
  onDelete,
  isPending = false,
  onKeywordClick,
  onSendToCapsule,
  onMarkForCapsule,
  onUnmarkFromCapsule,
}: ThreatArticleCardProps) {
  const [openAlert, setOpenAlert] = useState(false);
  const [sendingToCapsule, setSendingToCapsule] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  };

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

  // Safety check in case scores are NaN
  const normalizedRelevanceScore = isNaN(relevanceScore) ? 0 : relevanceScore;
  const normalizedSecurityScore = isNaN(securityScore) ? 0 : securityScore;

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

  // Get the accent color based on threat severity
  const getAccentColor = () => {
    if (normalizedSecurityScore >= 8) return "from-red-500/30";
    if (normalizedSecurityScore >= 6) return "from-orange-500/30";
    if (normalizedSecurityScore >= 4) return "from-yellow-500/30";
    return "from-green-500/30";
  };

  return (
    <div className="h-full overflow-hidden transition-all duration-300 group-hover:translate-y-[-3px]">
      <div
        className={cn(
          "h-full rounded-xl border border-slate-700/50 bg-gradient-to-b from-transparent to-black/10 backdrop-blur-sm overflow-hidden",
          "hover:border-slate-600/80 transition-all duration-300",
          "flex flex-col relative",
          isPending && "bg-black/30",
        )}
      >
        <div
          className={cn(
            "h-1.5 w-full bg-gradient-to-r",
            isPending
              ? "from-slate-500/50 to-slate-700/50 animate-pulse"
              : getAccentColor(),
          )}
        ></div>

        <div className="flex-1 p-5 flex flex-col">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-medium text-white line-clamp-2 group-hover:text-primary transition-colors pr-2">
              {article.title}
            </h3>

            {/* Threat severity score badge */}
            <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full">
              <Zap
                className={cn(
                  "h-3.5 w-3.5",
                  getScoreColor(normalizedSecurityScore),
                )}
              />
              <span
                className={cn(
                  "text-xs font-semibold",
                  getScoreColor(normalizedSecurityScore),
                )}
              >
                {normalizedSecurityScore}/10
              </span>
            </div>
          </div>

          {/* Score indicators */}
          <div className="space-y-3 mb-3">
            {/* Severity score indicator */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Threat Severity
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
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

            {/* Relevance score indicator */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Relevance Score
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    getScoreColor(normalizedRelevanceScore),
                  )}
                >
                  {normalizedRelevanceScore * 10}%
                </span>
              </div>
              <Progress
                value={normalizedRelevanceScore * 10}
                className="h-1.5 bg-slate-700/50"
                indicatorClassName={cn(
                  "transition-all",
                  getProgressColor(normalizedRelevanceScore),
                )}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            {article.author && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <User className="h-3 w-3" />
                <span>{article.author}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              <span>
                {article.publishDate
                  ? `Published ${formatDistanceToNow(new Date(article.publishDate))} ago`
                  : article.scrapeDate
                    ? `Scraped ${formatDistanceToNow(new Date(article.scrapeDate))} ago`
                    : "Unknown date"}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-300 mb-4 line-clamp-3 flex-1">
            {article.summary}
          </p>

          {hasKeywords && (
            <div className="space-y-2 mb-4">
              {detectedKeywords.threats &&
                detectedKeywords.threats.length > 0 && (
                  <div>
                    <span className="text-xs text-red-400 flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3 w-3" /> Threats
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedKeywords.threats.map((keyword: string) => (
                        <Badge
                          key={`threat-${keyword}`}
                          variant="outline"
                          className="bg-red-500/10 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-300 border-red-500/30 cursor-pointer transition-colors"
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
                    </div>
                  </div>
                )}

              {detectedKeywords.vendors &&
                detectedKeywords.vendors.length > 0 && (
                  <div>
                    <span className="text-xs text-blue-400 flex items-center gap-1 mb-1">
                      <Shield className="h-3 w-3" /> Vendors
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedKeywords.vendors.map((keyword: string) => (
                        <Badge
                          key={`vendor-${keyword}`}
                          variant="outline"
                          className="bg-blue-500/10 text-xs text-blue-300 hover:bg-blue-500/20 hover:text-blue-300 border-blue-500/30 cursor-pointer transition-colors"
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
                    </div>
                  </div>
                )}

              {detectedKeywords.clients &&
                detectedKeywords.clients.length > 0 && (
                  <div>
                    <span className="text-xs text-purple-400 flex items-center gap-1 mb-1">
                      <CheckCircle2 className="h-3 w-3" /> Clients
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedKeywords.clients.map((keyword: string) => (
                        <Badge
                          key={`client-${keyword}`}
                          variant="outline"
                          className="bg-purple-500/10 text-xs text-purple-300 hover:bg-purple-500/20 hover:text-purple-300 border-purple-500/30 cursor-pointer transition-colors"
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
                    </div>
                  </div>
                )}

              {detectedKeywords.hardware &&
                detectedKeywords.hardware.length > 0 && (
                  <div>
                    <span className="text-xs text-amber-400 flex items-center gap-1 mb-1">
                      <Shield className="h-3 w-3" /> Hardware/Software
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedKeywords.hardware.map((keyword: string) => (
                        <Badge
                          key={`hardware-${keyword}`}
                          variant="outline"
                          className="bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20 hover:text-amber-300 border-amber-500/30 cursor-pointer transition-colors"
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
                    </div>
                  </div>
                )}
            </div>
          )}

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-700/50">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary/80 underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              View Source
            </a>

            <div className="flex items-center gap-2">
              {onSendToCapsule && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending || sendingToCapsule}
                  onClick={handleSendToCapsule}
                  className={cn(
                    "h-fit w-fit p-2",
                    "border border-slate-700 rounded-full",
                    "text-slate-400 hover:text-blue-400 hover:bg-blue-400/10",
                    (isPending || sendingToCapsule) &&
                      "cursor-not-allowed opacity-70",
                  )}
                  title="Send to News Capsule"
                >
                  {sendingToCapsule ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}

              <DeleteAlertDialog
                open={openAlert}
                setOpen={setOpenAlert}
                action={(e: React.MouseEvent) => handleDelete(e)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenAlert(true);
                  }}
                  className={cn(
                    "h-fit w-fit p-2",
                    "border border-slate-700 rounded-full",
                    "text-slate-400 hover:text-red-400 hover:bg-red-400/10",
                    isPending && "cursor-not-allowed opacity-70",
                  )}
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </DeleteAlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
