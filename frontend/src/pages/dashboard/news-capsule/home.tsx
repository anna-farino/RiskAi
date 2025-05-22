import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { serverUrl } from '@/lib/constants';

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

export default function NewsCapsulesHome() {
  const [url, setUrl] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch articles when the component mounts
  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${serverUrl}/api/scraper/articles`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }
      
      const data = await response.json();
      
      if (data.success && data.articles) {
        setArticles(data.articles);
      } else {
        setError(data.error || 'Failed to fetch articles');
      }
    } catch (err) {
      setError('Error fetching articles. Please try again later.');
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset states
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    
    // Basic URL validation
    if (!url.trim()) {
      setError('Please enter a URL');
      setSubmitting(false);
      return;
    }
    
    // Ensure URL has a protocol
    let processUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      processUrl = 'https://' + url;
    }
    
    try {
      console.log('Submitting URL for processing:', processUrl);
      
      const response = await fetch(`${serverUrl}/api/scraper/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ url: processUrl }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccess('Article processed successfully!');
        setUrl('');
        
        // Add the new article to the list and refresh
        fetchArticles();
      } else {
        setError(data.error || 'Failed to process article');
      }
    } catch (err) {
      setError('Error processing article. Please try again later.');
      console.error('Error extracting article content:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">News Scraper</h1>
      
      {/* URL Input Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Submit a URL to Scrape</CardTitle>
          <CardDescription>
            Enter the URL of a cybersecurity article to extract and summarize its content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="url" className="font-medium">
                Article URL
              </label>
              <Input
                id="url"
                placeholder="https://example.com/security-article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={submitting}
              />
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-50 text-green-800 border-green-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Submit URL'
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Recent Articles */}
      <h2 className="text-xl font-semibold mb-4">Recent Articles</h2>
      
      {loading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <Card key={article.id} className="flex flex-col h-full">
              <CardHeader>
                <CardTitle className="text-lg">{article.title}</CardTitle>
                <CardDescription>{article.source}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="mb-2">
                  <span className="font-medium">Threat: </span>
                  {article.threatName}
                </div>
                <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                  {article.summary}
                </div>
                <div className="text-xs">
                  <div className="mb-1"><span className="font-medium">Impacts: </span>{article.impacts}</div>
                  <div><span className="font-medium">OS: </span>{article.osConnection}</div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 text-xs text-gray-500">
                {new Date(article.createdAt).toLocaleDateString()}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 p-8 text-center rounded-lg">
          <p>No articles yet. Submit a URL to get started!</p>
        </div>
      )}
    </div>
  );
}