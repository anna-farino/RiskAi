import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { serverUrl } from '../../../lib/constants';

// Article type definition
type Article = {
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
  markedForReporting: boolean;
  createdAt: string;
};

export default function Dashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true);
        const response = await fetch(`${serverUrl}/api/news-capsule/articles`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch articles');
        }

        const data = await response.json();
        setArticles(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching articles:', err);
        setError('Failed to load articles. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchArticles();
  }, []);

  async function handleMarkForReporting(id: string, currentValue: boolean) {
    try {
      const response = await fetch(`${serverUrl}/api/news-capsule/articles/${id}/reporting`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ markedForReporting: !currentValue })
      });

      if (!response.ok) {
        throw new Error('Failed to update article');
      }

      // Update articles state
      setArticles(articles.map(article => 
        article.id === id 
          ? { ...article, markedForReporting: !currentValue } 
          : article
      ));
    } catch (err) {
      console.error('Error updating article:', err);
      setError('Failed to update article. Please try again later.');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-100 p-4 rounded-md mb-4 border border-red-200 dark:border-red-800">
        <h3 className="font-bold mb-2">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-semibold mb-4">No Articles Found</h2>
        <p className="text-gray-500 mb-6">Submit a new article to get started</p>
        <Link to="/dashboard/news-capsule/submit">
          <Button>Submit Article</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">News Capsule Dashboard</h1>
        <Link to="/dashboard/news-capsule/submit">
          <Button>Submit New Article</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.map(article => (
          <Card key={article.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50">
              <CardTitle className="text-lg">{article.title}</CardTitle>
              <CardDescription>
                {article.sourcePublication} • {new Date(article.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {article.vulnerabilityId && (
                <div className="mb-2">
                  <span className="font-semibold">Vulnerability: </span>
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                    {article.vulnerabilityId}
                  </span>
                </div>
              )}
              <p className="text-sm mb-2">{article.summary}</p>
              {article.impacts && (
                <div className="mt-3">
                  <span className="font-semibold">Impacts: </span>
                  <span className="text-sm">{article.impacts}</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-gray-50 flex justify-between">
              <a 
                href={article.originalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                View Original
              </a>
              <Button 
                variant={article.markedForReporting ? "default" : "outline"}
                size="sm"
                onClick={() => handleMarkForReporting(article.id, article.markedForReporting)}
              >
                {article.markedForReporting ? "In Report ✓" : "Add to Report"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}