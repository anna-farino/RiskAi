import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Clock, User, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Article } from "@shared/db/schema/news-tracker/index";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { DeleteAlertDialog } from "../delete-alert-dialog";

interface ArticleCardProps {
  article: Article;
  onDelete: (id: string) => void;
  isPending?: boolean;
}

export function ArticleCard({ article, onDelete, isPending = false }: ArticleCardProps) {
  const [ openAlert, setOpenAlert ] = useState(false)
  // Generate a random color for the card accent (in a real app, this could be based on source or category)
  const getRandomAccent = () => {
    const accents = ['from-blue-500/20', 'from-green-500/20', 'from-purple-500/20', 'from-amber-500/20', 'from-pink-500/20'];
    const random0To4 = Math.floor(Math.random()* 5)
    return accents[random0To4];
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(article.id);
  };

  return (
    <div className="h-full overflow-hidden transition-all duration-300 group-hover:translate-y-[-3px]">
      <div 
        className={cn(
          "h-full rounded-xl border border-slate-700/50 bg-gradient-to-b from-transparent to-black/10 backdrop-blur-sm overflow-hidden", 
          "hover:border-slate-600/80 transition-all duration-300",
          "flex flex-col relative",
          isPending && "bg-black/30"
        )}
      >
        <div className={cn(
          "h-1.5 w-full bg-gradient-to-r", 
          isPending ? "from-slate-500/50 to-slate-700/50 animate-pulse" : getRandomAccent()
        )}></div>
        
        <div className="flex-1 p-5 flex flex-col">
          <h3 className="text-lg font-medium text-white line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          
          <div className="flex items-center gap-3 mb-3">
            {/*Author disabled*/}
            {article.author && false && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <User className="h-3 w-3" />
                <span>{article.author}</span>
              </div>
            )}
            
            {article.publishDate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(new Date(article.publishDate))} ago</span>
              </div>
            )}
          </div>
          
          <p className="text-sm text-slate-300 mb-4 line-clamp-3 flex-1">
            {article.summary}
          </p>
          
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-700/50">
            <div className="flex flex-wrap gap-1.5">
              {/* First, console log the article to debug */}
              {console.log('Article detectedKeywords in ArticleCard:', article.detectedKeywords)}
              
              {Array.isArray(article.detectedKeywords) &&
                article.detectedKeywords.slice(0, 3).map((keyword: any, index: number) => {
                  // Handle both string arrays and object arrays (with term property)
                  const keywordText = typeof keyword === 'string' ? keyword : keyword?.term || JSON.stringify(keyword);
                  
                  return (
                    <Badge 
                      key={index} 
                      variant="outline"
                      className="bg-white/5 text-xs text-slate-300 hover:bg-white/10 border-slate-700"
                    >
                      {keywordText}
                    </Badge>
                  );
                })}
              
              {Array.isArray(article.detectedKeywords) && article.detectedKeywords.length > 3 && (
                <span className="text-xs text-slate-500">+{article.detectedKeywords.length - 3} more</span>
              )}
            </div>
            
            <DeleteAlertDialog
              open={openAlert}
              setOpen={setOpenAlert}
              action={(e: React.MouseEvent) => handleDelete(e)}
            >
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={(e)=> {
                  e.preventDefault()
                  setOpenAlert(true)
                }}
                className={cn(
                  "h-fit w-fit p-2",
                  "border border-slate-700 rounded-full",
                  "text-slate-400 hover:text-red-400 hover:bg-red-400/10",
                  isPending && "cursor-not-allowed opacity-70"
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
  );
}
