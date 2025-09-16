import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Article } from "@shared/db/schema/news-tracker/index";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Type interface to handle both detectedKeywords and detected_keywords
interface ArticleWithKeywords extends Article {
  detected_keywords?: string[];
  sourceName?: string;
}

interface ArticleCardProps {
  article: ArticleWithKeywords;
  isPending?: boolean;
  onKeywordClick?: (keyword: string) => void;
  onSendToCapsule?: (url: string) => void;
}

export function ArticleCard({
  article,
  isPending = false,
  onKeywordClick,
  onSendToCapsule,
}: ArticleCardProps) {
  const [openAlert, setOpenAlert] = useState(false);
  const [sendingToCapsule, setSendingToCapsule] = useState(false);
  // Unified accent colors using primary palette and severity scale
  const getUnifiedAccent = () => {
    const accents = [
      "from-[#00FFFF]/30", // Primary cyan
      "from-[#BF00FF]/30", // Primary magenta
      "from-blue-500/30",   // High priority
      "from-yellow-500/30", // Medium priority
      "from-orange-500/30", // Lower priority
    ];
    // Use article ID hash for consistent coloring per article
    const hash = article.id.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return accents[Math.abs(hash) % accents.length];
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

  // Get keywords from either detected_keywords or detectedKeywords
  const getKeywords = (): string[] => {
    // @ts-ignore: Handle both naming conventions
    return (article.detected_keywords ||
      article.detectedKeywords ||
      []) as string[];
  };

  const keywords = getKeywords();

  // Unified color palette using consistent severity/priority mapping
  const getUnifiedKeywordColor = (index: number) => {
    // Consistent color scale: red→orange→yellow→blue→cyan (primary colors)
    const colors = [
      {
        bg: "bg-[#00FFFF]/10", // Primary cyan
        text: "text-[#00FFFF]", 
        border: "border-[#00FFFF]/30",
        hover: "hover:bg-[#00FFFF]/20 hover:text-[#00FFFF]"
      },
      {
        bg: "bg-[#BF00FF]/10", // Primary magenta
        text: "text-[#BF00FF]",
        border: "border-[#BF00FF]/30", 
        hover: "hover:bg-[#BF00FF]/20 hover:text-[#BF00FF]"
      },
      {
        bg: "bg-blue-500/10", // High priority - blue
        text: "text-blue-400",
        border: "border-blue-500/30",
        hover: "hover:bg-blue-500/20 hover:text-blue-400"
      },
      {
        bg: "bg-yellow-500/10", // Medium priority - yellow
        text: "text-yellow-400",
        border: "border-yellow-500/30",
        hover: "hover:bg-yellow-500/20 hover:text-yellow-400"
      },
      {
        bg: "bg-orange-500/10", // Lower priority - orange
        text: "text-orange-400",
        border: "border-orange-500/30",
        hover: "hover:bg-orange-500/20 hover:text-orange-400"
      }
    ];
    return colors[index % colors.length];
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
              : getUnifiedAccent(),
          )}
        ></div>

        <div className="flex-1 p-4 sm:p-5 flex flex-col">
          <h3 className="text-lg font-semibold text-white line-clamp-2 mb-3 leading-6 group-hover:text-[#00FFFF] transition-colors">
            {article.title}
          </h3>

          <div className="flex items-center gap-3 mb-3">
            {article.author && article.author !== "Unknown" ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 leading-4">
                <User className="h-3 w-3" />
                <span className="font-medium">{article.author}</span>
              </div>
            ) : null}

            {article.publishDate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 leading-4">
                <Clock className="h-3 w-3" />
                <span className="font-medium">
                  {format(new Date(article.publishDate), "MMM d, yyyy")}
                </span>
              </div>
            )}

            {article.sourceName && (
              <div className="flex items-center gap-1.5 text-xs leading-4">
                <span className="font-semibold text-[#BF00FF]">
                  {article.sourceName}
                </span>
              </div>
            )}
          </div>

          <p className="text-sm text-slate-300 mb-4 line-clamp-3 flex-1 leading-5">
            {article.summary}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-auto pt-3 border-t border-slate-700/50">
            <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
              {Array.isArray(keywords) &&
                keywords.slice(0, 3).map((keyword: string, index: number) => {
                  const colors = getUnifiedKeywordColor(index);
                  return (
                    <Badge
                      key={keyword}
                      variant="outline"
                      className={cn(
                        "text-xs font-medium cursor-pointer transition-colors truncate max-w-24 leading-4",
                        colors.bg,
                        colors.text,
                        colors.border,
                        colors.hover
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onKeywordClick) onKeywordClick(keyword);
                      }}
                    >
                      {keyword}
                    </Badge>
                  );
                })}

              {Array.isArray(keywords) && keywords.length > 3 && (
                <span className="text-xs font-medium text-[#00FFFF] leading-4">
                  +{keywords.length - 3} more
                </span>
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
