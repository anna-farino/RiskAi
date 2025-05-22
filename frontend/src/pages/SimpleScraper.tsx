import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, X } from 'lucide-react';

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
};

export default function SimpleScraper() {
  const [processing, setProcessing] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form handling
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: ''
    }
  });

  // Handle form submission
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setProcessing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/news-scraper/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: data.url })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process article');
      }
      
      const result = await response.json();
      setArticle(result.article);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-black/40 border border-primary/20 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">News Scraper</h2>
        <p className="text-gray-300 mb-6">
          Enter a URL to scrape and summarize cybersecurity articles.
        </p>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <div className="relative">
              <input
                id="url"
                placeholder="https://thehackernews.com/example-article"
                {...form.register('url')}
                className="w-full bg-black/80 border border-gray-700 text-white px-4 py-2 rounded-md"
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
          
          <button
            type="submit"
            disabled={processing || !form.formState.isValid}
            className={`w-full bg-primary text-white px-4 py-2 rounded-md ${
              processing || !form.formState.isValid ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'
            }`}
          >
            {processing ? 'Processing...' : 'Process Article'}
          </button>
        </form>
      </div>
      
      {error && (
        <div className="bg-red-900/30 border border-red-800/50 text-red-300 p-4 rounded-lg mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {article ? (
        <div className="bg-black/40 border border-primary/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-primary mt-1" />
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">{article.title}</h2>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-400 text-sm">{article.source}</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300 border border-red-800/50">
                  {article.threatName}
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-md font-medium text-primary mb-1">Summary</h3>
                  <p className="text-white text-sm leading-relaxed">{article.summary}</p>
                </div>
                
                <div>
                  <h3 className="text-md font-medium text-primary mb-1">Impacts</h3>
                  <p className="text-white text-sm leading-relaxed">{article.impacts}</p>
                </div>
                
                <div>
                  <h3 className="text-md font-medium text-primary mb-1">OS Connection</h3>
                  <p className="text-white text-sm leading-relaxed">{article.osConnection}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-black/40 border border-gray-800 rounded-lg p-6 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">
            Enter a URL above to scrape and summarize an article
          </p>
        </div>
      )}
    </div>
  );
}