import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Clock, User, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Article } from "@shared/db/schema/news-tracker/index";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { DeleteAlertDialog } from "../delete-alert-dialog";

// Type interface to handle both detectedKeywords and detected_keywords
interface ArticleWithKeywords extends Article {
  detected_keywords?: string[];
  sourceName?: string;
}

interface ArticleCardProps {
  article: ArticleWithKeywords;
  onDelete: (id: string) => void;
  isPending?: boolean;
  onKeywordClick?: (keyword: string) => void;
  onSendToCapsule?: (url: string) => void;
}

export function ArticleCard({
  article,
  onDelete,
  isPending = false,
  onKeywordClick,
  onSendToCapsule,
}: ArticleCardProps) {
  const [openAlert, setOpenAlert] = useState(false);
  const [sendingToCapsule, setSendingToCapsule] = useState(false);
  // Generate a random color for the card accent (in a real app, this could be based on source or category)
  const getRandomAccent = () => {
    const accents = [
      "from-blue-500/20",
      "from-green-500/20",
      "from-purple-500/20",
      "from-amber-500/20",
      "from-pink-500/20",
    ];
    const random0To4 = Math.floor(Math.random() * 5);
    return accents[random0To4];
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(article.id);
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

  // Removed threat level categorization - will implement better category solution later

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
            "h-1 sm:h-1.5 w-full bg-gradient-to-r",
            isPending
              ? "from-slate-500/50 to-slate-700/50 animate-pulse"
              : getRandomAccent(),
          )}
        ></div>

        <div className="flex-1 p-3 sm:p-4 md:p-5 flex flex-col">
          <h3 className="text-base sm:text-lg font-medium text-white line-clamp-2 mb-1.5 sm:mb-2 group-hover:text-primary transition-colors">
            {article.title}
          </h3>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-400 truncate">
              {article.sourceName}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            {/*Author disabled*/}
            {article.author && false && (
              <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-slate-400">
                <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="text-[10px] sm:text-xs">{article.author}</span>
              </div>
            )}

            {article.publishDate && (
              <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-slate-400">
                <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="text-[10px] sm:text-xs">
                  {format(new Date(article.publishDate), "MMM d, yyyy")}
                </span>
              </div>
            )}

            {article.sourceName && (
              <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-slate-400">
                <span className="text-[10px] sm:text-xs font-medium">
                  {article.sourceName}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs sm:text-sm text-slate-300 mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3 flex-1">
            {article.summary}
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mt-auto pt-3 border-t border-slate-700/50">
            <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
              {Array.isArray(keywords) &&
                keywords.slice(0, 2).map((keyword: string) => (
                  <Badge
                    key={keyword}
                    variant="outline"
                    className="bg-white/5 text-xs text-slate-300 hover:bg-primary/20 hover:text-primary hover:border-primary/30 border-slate-700 cursor-pointer transition-colors truncate max-w-20"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onKeywordClick) onKeywordClick(keyword);
                    }}
                  >
                    {keyword}
                  </Badge>
                ))}

              {Array.isArray(keywords) && keywords.length > 2 && (
                <span className="text-xs text-slate-500">
                  +{keywords.length - 2} more
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
                    "h-fit w-fit p-1.5 sm:p-2",
                    "border border-slate-700 rounded-full",
                    "text-slate-400 hover:text-blue-400 hover:bg-blue-400/10",
                    (isPending || sendingToCapsule) &&
                      "cursor-not-allowed opacity-70",
                  )}
                  title="Send to News Capsule"
                >
                  {sendingToCapsule ? (
                    <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
                    "h-fit w-fit p-1.5 sm:p-2",
                    "border border-slate-700 rounded-full",
                    "text-slate-400 hover:text-red-400 hover:bg-red-400/10",
                    isPending && "cursor-not-allowed opacity-70",
                  )}
                >
                  {isPending ? (
                    <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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