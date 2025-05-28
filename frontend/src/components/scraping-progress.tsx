import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Loader2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrapingProgress {
  isActive: boolean;
  currentSource?: string;
  currentArticle?: string;
  articlesAdded: number;
  articlesSkipped: number;
  totalSources: number;
  currentSourceIndex: number;
  errors: string[];
  startTime?: string;
}

interface ScrapingProgressProps {
  apiEndpoint: string;
  title: string;
  className?: string;
}

export function ScrapingProgress({ apiEndpoint, title, className }: ScrapingProgressProps) {
  const { data: progress, isLoading } = useQuery<ScrapingProgress>({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch progress');
      }
      return response.json();
    },
    refetchInterval: progress?.isActive ? 2000 : false, // Poll every 2 seconds when active
    enabled: true,
  });

  // Don't show the component if scraping is not active
  if (!progress?.isActive || isLoading) {
    return null;
  }

  const progressPercentage = progress.totalSources > 0 
    ? Math.round((progress.currentSourceIndex / progress.totalSources) * 100)
    : 0;

  const hasErrors = progress.errors.length > 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-blue-500" />
          {title}
          <Badge variant={hasErrors ? "destructive" : "default"} className="ml-auto">
            {progress.isActive ? "Active" : "Completed"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sources Progress</span>
            <span>{progress.currentSourceIndex} / {progress.totalSources}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Current status */}
        {progress.currentSource && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium">Current Source:</span>
            </div>
            <p className="text-sm text-muted-foreground truncate">{progress.currentSource}</p>
          </div>
        )}

        {progress.currentArticle && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Processing Article:</span>
            <p className="text-sm text-muted-foreground truncate">{progress.currentArticle}</p>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-medium">{progress.articlesAdded}</p>
              <p className="text-xs text-muted-foreground">Added</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-gray-300" />
            <div>
              <p className="text-sm font-medium">{progress.articlesSkipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>
        </div>

        {/* Errors */}
        {hasErrors && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">Recent Errors:</span>
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {progress.errors.slice(-3).map((error, index) => (
                <p key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Start time */}
        {progress.startTime && (
          <p className="text-xs text-muted-foreground">
            Started: {new Date(progress.startTime).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}