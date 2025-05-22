import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Check, XCircle, AlertTriangle, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { serverUrl } from '@/lib/constants';
import { csfrHeaderObject } from '@/lib/csrf';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';

// Article type
interface Article {
  id: string;
  title: string;
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  microsoftConnection: string;
  sourcePublication: string;
  originalUrl: string;
  targetOS: string;
  createdAt: string;
  markedForReporting: boolean;
  markedForDeletion: boolean;
  userId: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // Fetch articles data
  const articles = useQuery<Article[]>({
    queryKey: ['/api/news-capsule/articles'],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-capsule/articles`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch articles');
        
        const data = await response.json();
        return data || [];
      } catch (error) {
        console.error(error);
        return [];
      }
    }
  });

  // Fetch processing queue status
  const queueStatus = useQuery({
    queryKey: ['/api/news-capsule/queue/status'],
    queryFn: async () => {
      try {
        const response = await fetch(`${serverUrl}/api/news-capsule/queue/status`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject()
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch queue status');
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error(error);
        return { queueLength: 0, isProcessing: false };
      }
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Filter articles by the selected criteria
  const filteredArticles = React.useMemo(() => {
    if (!articles.data) return [];

    let filtered = [...articles.data];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(query) || 
        article.threatName.toLowerCase().includes(query) ||
        article.vulnerabilityId.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.targetOS.toLowerCase().includes(query) ||
        article.sourcePublication.toLowerCase().includes(query)
      );
    }
    
    switch (filter) {
      case 'microsoft':
        return filtered.filter(article => 
          article.targetOS.toLowerCase().includes('windows') || 
          article.microsoftConnection.toLowerCase().includes('microsoft')
        );
      case 'vulnerability':
        return filtered.filter(article => 
          article.vulnerabilityId !== 'Unspecified' && 
          article.vulnerabilityId !== ''
        );
      case 'reporting':
        return filtered.filter(article => article.markedForReporting);
      default:
        return filtered;
    }
  }, [articles.data, filter, searchQuery]);

  const handleDeleteArticle = async (id: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/news-capsule/articles/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject()
        }
      });
      
      if (!response.ok) throw new Error('Failed to delete article');
      
      await queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/articles'] });
      
      toast({
        title: "Article removed",
        description: "The article has been removed from your dashboard",
        variant: "default"
      });
      
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete the article",
        variant: "destructive"
      });
    }
  };

  const handleToggleReporting = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${serverUrl}/api/news-capsule/articles/${id}/reporting`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csfrHeaderObject()
        },
        body: JSON.stringify({ markedForReporting: !currentStatus })
      });
      
      if (!response.ok) throw new Error('Failed to update article');
      
      await queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/articles'] });
      
      toast({
        title: !currentStatus ? "Added to reporting" : "Removed from reporting",
        description: !currentStatus 
          ? "The article has been added to your report list" 
          : "The article has been removed from your report list",
        variant: "default"
      });
      
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update the article",
        variant: "destructive"
      });
    }
  };

  const handleClearAll = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/news-capsule/articles/clear-all`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject()
        }
      });
      
      if (!response.ok) throw new Error('Failed to clear articles');
      
      await queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/articles'] });
      
      toast({
        title: "All cleared",
        description: "All articles have been removed from your dashboard",
        variant: "default"
      });
      
      setClearDialogOpen(false);
      
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to clear articles",
        variant: "destructive"
      });
    }
  };

  const refreshArticles = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/articles'] });
    queryClient.invalidateQueries({ queryKey: ['/api/news-capsule/queue/status'] });
    
    toast({
      title: "Refreshing data",
      description: "Getting the latest threat intelligence...",
      variant: "default"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">Threat Intelligence Dashboard</h2>
            <p className="text-slate-400">
              AI-generated cybersecurity threat summaries
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={refreshArticles}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
            
            <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all articles from your dashboard. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {/* Processing status indicator */}
        {queueStatus.data?.isProcessing && (
          <div className="bg-blue-900/30 border border-blue-700/30 p-3 rounded-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <div>
              <p className="font-medium text-blue-300">Processing articles</p>
              <p className="text-sm text-blue-400">
                {queueStatus.data.queueLength > 0 
                  ? `${queueStatus.data.queueLength} more in queue`
                  : 'Finishing current article'}
              </p>
            </div>
          </div>
        )}
        
        {/* Filter row */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="max-w-xs">
            <Select
              value={filter}
              onValueChange={setFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Intelligence</SelectItem>
                <SelectItem value="microsoft">Microsoft/Windows</SelectItem>
                <SelectItem value="vulnerability">CVE/Vulnerabilities</SelectItem>
                <SelectItem value="reporting">Marked for Reporting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <Input
              placeholder="Search threats, CVEs, OS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {/* Articles grid */}
      {articles.isLoading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : filteredArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((article) => (
            <Card key={article.id} className="bg-slate-800 border-slate-700 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between gap-2">
                  <Badge variant="outline" className="bg-purple-900/50 text-purple-300 border-purple-700">
                    {article.vulnerabilityId !== 'Unspecified' 
                      ? article.vulnerabilityId 
                      : article.threatName.split(' ')[0]}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <CardTitle className="mt-2 line-clamp-2">{article.title}</CardTitle>
                <CardDescription className="line-clamp-1 text-slate-400">
                  {article.threatName}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm text-slate-300 line-clamp-3 mb-2">
                  {article.summary}
                </p>
                
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-400">Source:</span>
                    <span className="text-slate-300">{article.sourcePublication}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-400">OS:</span>
                    <span className="text-slate-300">{article.targetOS}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-400">Attack Vector:</span>
                    <span className="text-slate-300">{article.attackVector}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => window.open(article.originalUrl, '_blank')}
                  className="text-blue-400 hover:text-blue-300"
                >
                  View Source
                </Button>
                
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleToggleReporting(article.id, article.markedForReporting)}
                    className={article.markedForReporting 
                      ? "text-green-500 hover:text-green-400 hover:bg-green-900/20" 
                      : "text-slate-400 hover:text-slate-300"}
                  >
                    <FileText size={18} />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
                    onClick={() => handleDeleteArticle(article.id)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="h-40 flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-xl bg-slate-800/50 p-6">
          <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
          <h3 className="font-semibold text-lg">No articles found</h3>
          <p className="text-slate-400 text-center mt-1">
            {searchQuery || filter !== 'all' 
              ? "Try adjusting your search or filters"
              : "Submit some article URLs to get started"}
          </p>
        </div>
      )}
    </div>
  );
}