import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { FileText, X, ExternalLink, Copy, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Define the form schema
const formSchema = z.object({
  url: z.string().url('Please enter a valid URL')
});

// Define the article type
type Article = {
  id: string;
  title: string;
  threatName: string;
  summary: string;
  impacts: string;
  osConnection: string;
  source: string;
  originalUrl: string;
  createdAt: string;
};

export default function NewsCapsuleHome() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [copied, setCopied] = useState(false);

  // Form handling
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: ''
    }
  });

  // Fetch articles
  const { data: articlesData, isLoading, isError } = useQuery({
    queryKey: ['/api/news-scraper/articles'],
    enabled: true
  });
  
  // Default empty array for articles if data is not available
  const articles = articlesData?.articles || [];

  // Process article mutation
  const processArticleMutation = useMutation({
    mutationFn: async (url: string) => {
      setProcessing(true);
      try {
        const data = await apiRequest('/api/news-scraper/process', {
          method: 'POST',
          body: JSON.stringify({ url })
        });
        return data;
      } finally {
        setProcessing(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/news-scraper/articles'] });
      toast({
        title: 'Success!',
        description: 'Article successfully processed.',
        variant: 'default'
      });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error processing article',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Handle form submission
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    processArticleMutation.mutate(data.url);
  };

  // Copy article summary to clipboard
  const copyToClipboard = () => {
    if (!selectedArticle) return;
    
    const formattedArticle = `
Title: ${selectedArticle.title}
Threat Name: ${selectedArticle.threatName}
Summary: ${selectedArticle.summary}
Impacts: ${selectedArticle.impacts}
OS Connection: ${selectedArticle.osConnection}
Source: ${selectedArticle.source}
    `.trim();
    
    navigator.clipboard.writeText(formattedArticle);
    setCopied(true);
    
    setTimeout(() => {
      setCopied(false);
    }, 2000);
    
    toast({
      title: 'Copied!',
      description: 'Article summary copied to clipboard',
      variant: 'default'
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left column - URL input and article list */}
        <div className="w-full lg:w-2/5">
          <div className="bg-black/40 border border-primary/20 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-white">News Capsule</h2>
            <p className="text-gray-300 mb-6">
              Enter a URL to scrape and summarize cybersecurity articles into executive-ready formats.
            </p>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-1">
                  Article URL
                </label>
                <div className="relative">
                  <Input
                    id="url"
                    placeholder="https://thehackernews.com/example-article"
                    {...form.register('url')}
                    className="bg-black/80 border-gray-700 text-white pr-10"
                  />
                  {form.formState.errors.url && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500">
                      <X size={16} />
                    </div>
                  )}
                </div>
                {form.formState.errors.url && (
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.url.message}</p>
                )}
              </div>
              
              <Button
                type="submit"
                disabled={processing || !form.formState.isValid}
                className="w-full"
                variant="default"
              >
                {processing ? 'Processing...' : 'Process Article'}
              </Button>
            </form>
          </div>
          
          <div className="bg-black/40 border border-primary/20 rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4 text-white">Recent Articles</h3>
            
            {isLoading ? (
              <div className="py-4 text-center text-gray-400">Loading articles...</div>
            ) : isError ? (
              <div className="py-4 text-center text-red-400">Error loading articles</div>
            ) : !articles || articles.length === 0 ? (
              <div className="py-4 text-center text-gray-400">No articles yet. Process your first article!</div>
            ) : (
              <div className="space-y-3">
                {articles.map((article: Article) => (
                  <div 
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedArticle?.id === article.id 
                        ? 'bg-primary/20 border border-primary/30' 
                        : 'bg-gray-900/60 hover:bg-gray-800/60 border border-gray-800'
                    }`}
                  >
                    <div className="flex items-start">
                      <FileText className="w-4 h-4 mt-1 mr-2 text-primary" />
                      <div>
                        <h4 className="font-medium text-white text-sm line-clamp-1">{article.title}</h4>
                        <p className="text-xs text-gray-400 mt-1">{article.source}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Right column - Article summary display */}
        <div className="w-full lg:w-3/5">
          {selectedArticle ? (
            <div className="bg-black/40 border border-primary/20 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-white">{selectedArticle.title}</h2>
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={copyToClipboard}
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy summary</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => window.open(selectedArticle.originalUrl, '_blank')}
                        >
                          <ExternalLink size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View original article</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-400 text-sm">Source: {selectedArticle.source}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300 border border-red-800/50">
                    {selectedArticle.threatName}
                  </span>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-md font-medium text-primary mb-2">Summary</h3>
                  <p className="text-white text-sm leading-relaxed">{selectedArticle.summary}</p>
                </div>
                
                <div>
                  <h3 className="text-md font-medium text-primary mb-2">Impacts</h3>
                  <p className="text-white text-sm leading-relaxed">{selectedArticle.impacts}</p>
                </div>
                
                <div>
                  <h3 className="text-md font-medium text-primary mb-2">OS Connection</h3>
                  <p className="text-white text-sm leading-relaxed">{selectedArticle.osConnection}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-black/40 border border-primary/20 rounded-lg p-6 h-full flex flex-col items-center justify-center text-center">
              <FileText className="w-16 h-16 mb-4 text-gray-600" />
              <h3 className="text-lg font-medium text-white mb-2">No Article Selected</h3>
              <p className="text-gray-400 max-w-md">
                Select an article from the list to view its summarized content, or process a new article.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}