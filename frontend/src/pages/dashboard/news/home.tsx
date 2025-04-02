import { useQuery, useMutation } from "@tanstack/react-query";
import { ArticleCard } from "@/components/ui/article-card";
import { apiRequest } from "@/lib/query-client";
import type { Article } from "@shared/db/schema/news-tracker/index";
import { queryClient } from "@/lib/query-client";
import { Loader2, Newspaper, Filter, Search, ArrowRight, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { serverUrl } from "@/utils/server-url";
import { Link } from "react-router-dom";

export default function NewsHome() {
  const { toast } = useToast();
  const articles = useQuery<Article[]>({
    queryKey: ["/api/news-tracker/articles"],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-tracker/articles`)
        if (!response.ok) throw new Error()

        const data = await response.json()
        return data || []
      } catch (error) {
        console.error(error)
      }
    }
  });

  const deleteArticle = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/news-tracker/articles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/articles"] });
    },
  });
  
  const deleteAllArticles = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/news-tracker/articles");
    },
    onSuccess: (data: { success: boolean; message: string; deletedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-tracker/articles"] });
      toast({
        title: "Articles deleted",
        description: `Successfully deleted ${data.deletedCount} articles.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete articles. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <div className="flex flex-col gap-6 md:gap-10 mb-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            Intelligent <span className="text-primary">News</span> Aggregation
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl">
            Advanced web scraping and AI-driven content analysis for efficient
            news collection and processing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Newspaper className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                Automated
              </span>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              Content Scraping
            </h3>
            <p className="text-sm text-slate-400 flex-1">
              Automatically extract content from multiple sources with advanced
              browser automation
            </p>
            <div className="mt-4">
              <Button
                variant="link"
                size="sm"
                asChild
                className="p-0 h-auto text-primary hover:text-primary/80"
              >
                <a href="/sources" className="flex items-center gap-1">
                  Manage Sources <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Filter className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                Customizable
              </span>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              Keyword Filtering
            </h3>
            <p className="text-sm text-slate-400 flex-1">
              Set up keywords to automatically categorize and filter relevant
              articles
            </p>
            <div className="mt-4">
              <Button
                variant="link"
                size="sm"
                asChild
                className="p-0 h-auto text-primary hover:text-primary/80"
              >
                <a href="/keywords" className="flex items-center gap-1">
                  Manage Keywords <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-white">
                Recent Articles
              </h2>
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                {articles.data?.length || 0}
              </span>
            </div>
            <div className="flex items-center gap-2 w-[100%] justify-end">
              <Input
                placeholder="Search articles..."
                className="h-9 w-[200px] lg:w-[250px] bg-white/5 border-slate-700/50 text-white placeholder:text-slate-400"
              />
              <Button
                variant="outline"
                size="sm"
                className="border-slate-600 hover:bg-white/10 text-white"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              
              {articles.data && articles.data.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="ml-2"
                      disabled={deleteAllArticles.isPending}
                    >
                      {deleteAllArticles.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will permanently delete all {articles.data.length} articles. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteAllArticles.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Delete All Articles
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {articles.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 py-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-700/50 overflow-hidden"
                >
                  <div className="h-48 bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : articles.data?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Newspaper className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                No articles yet
              </h3>
              <p className="text-slate-400 max-w-md mb-6">
                Add sources and start scraping to populate your news feed with
                the latest articles.
              </p>
              <Button asChild>
                <Link to="/dashboard/news/sources">Get Started with Sources</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {articles.data?.map((article) => (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={article.id}
                  className="group"
                >
                  <ArticleCard
                    article={article}
                    onDelete={(id:any) => deleteArticle.mutate(id)}
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
