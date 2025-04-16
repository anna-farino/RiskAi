import React, { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/query-client';
import { ArticleWithAnalysis } from '@/lib/news-capsule-types';
import { queryClient } from '@/lib/query-client';
import { serverUrl } from '@/utils/server-url';

interface UrlInputProps {
  onAnalysisComplete: (data: ArticleWithAnalysis) => void;
  setIsLoading: (loading: boolean) => void;
}

const UrlInput: React.FC<UrlInputProps> = ({ onAnalysisComplete, setIsLoading }) => {
  const [url, setUrl] = useState<string>('');
  const { toast } = useToast();

  const handleAnalyzeArticle = async (forceRefresh = false) => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid URL to analyze",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate URL format
      if (!url.match(/^(https?:\/\/)/i)) {
        setUrl(`https://${url}`);
      }

      setIsLoading(true);
      const apiAnalyze = '/api/news-capsule/analyze'
      
      // If forceRefresh is true, add a query parameter to bypass cache
      const requestUrl = forceRefresh 
        ? serverUrl + apiAnalyze + `?refresh=true` 
        : serverUrl + apiAnalyze;

      const response = await apiRequest('POST', requestUrl, { url });
      const data = response;
      //console.log("data from UrlInput", data)
      
      onAnalysisComplete(data);
      
      if (data.cached && !forceRefresh) {
        toast({
          title: "Analysis Retrieved",
          description: "Showing previously analyzed results for this URL",
          variant: "default",
        });
      } else {
        toast({
          title: forceRefresh ? "Fresh Analysis Complete" : "Analysis Complete",
          description: forceRefresh ? "Article re-analyzed with fresh data" : "Article successfully analyzed",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error analyzing article:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze the article. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle clearing the search bar
  const handleClearSearchBar = () => {
    setUrl('');
  };

  return (
    <div className="bg-card rounded-lg p-6 shadow-lg mb-8 border border-border">
      <h2 className="text-lg font-medium mb-4">Enter Article URL</h2>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="article-url" className="sr-only">Article URL</label>
          <input 
            type="url" 
            id="article-url" 
            placeholder="https://example.com/security-article" 
            className="w-full px-4 py-3 bg-muted border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAnalyzeArticle();
            }}
          />
          <p className="mt-2 text-sm text-muted-foreground">Paste a URL from a cybersecurity news source or blog</p>
        </div>
        <div className="flex-shrink-0 flex gap-2">
          {/* Clear button - placed between search bar and analyze button */}
          <button 
            className="w-full md:w-auto px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-md font-medium text-secondary-foreground flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary focus:ring-offset-background"
            onClick={() => handleClearSearchBar()}
            title="Clear search bar"
          >
            <i className="fas fa-xmark"></i>
          </button>
          
          {/* Analyze button */}
          <button 
            className="w-full md:w-auto px-6 py-3 bg-primary hover:bg-primary/80 rounded-md font-medium text-primary-foreground flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-background"
            onClick={() => handleAnalyzeArticle()}
          >
            <i className="fas fa-bolt-lightning mr-2"></i>
            Analyze
          </button>
        </div>
      </div>
    </div>
  );
};

export default UrlInput;
