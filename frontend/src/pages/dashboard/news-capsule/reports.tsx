import React, { useEffect, useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { serverUrl } from '../../../lib/constants';
import { csfrHeaderObject } from '../../../lib/csrf';

// Article type definition (same as in home.tsx)
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

export default function Reports() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function loadReportArticles() {
      try {
        setLoading(true);
        
        // Load articles from localStorage
        const storedArticles = localStorage.getItem('news-capsule-articles');
        
        if (storedArticles) {
          // Parse articles and filter only those marked for reporting
          const parsedArticles = JSON.parse(storedArticles);
          const reportArticles = parsedArticles.filter(
            (article: Article) => article.markedForReporting === true
          );
          setArticles(reportArticles);
        } else {
          // If no articles exist yet, set empty array
          setArticles([]);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading report articles:', err);
        setError('Failed to load reports. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    loadReportArticles();
    
    // Refresh when localStorage changes
    window.addEventListener('storage', loadReportArticles);
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', loadReportArticles);
    };
  }, []);

  function generateReportDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${year}-${month}-${day}`;
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
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
        <h3 className="font-bold">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">No Articles Marked for Reporting</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Visit the dashboard to add articles to your report</p>
        <Button
          onClick={() => window.location.href = '/dashboard/news-capsule'}
          variant="outline"
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Cybersecurity News Report</h1>
          <p className="text-gray-500 dark:text-gray-400">Generated on {generateReportDate()}</p>
        </div>
        <Button>Export Report</Button>
      </div>

      <div className="space-y-8">
        {articles.map(article => (
          <Card key={article.id} className="overflow-hidden border dark:border-gray-700">
            <CardHeader className="dark:bg-gray-800">
              <CardTitle className="dark:text-white">{article.title}</CardTitle>
              <CardDescription className="dark:text-gray-300">
                Source: {article.sourcePublication} | Published: {new Date(article.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="dark:bg-gray-900">
              <div className="space-y-4">
                {/* Format Section: Title */}
                {/* Title is displayed in the CardTitle component above */}
                
                {/* Format Section: Threat Name(s) */}
                <div>
                  <h4 className="font-semibold text-lg dark:text-gray-200">Threat Name(s)</h4>
                  <p className="bg-red-50 dark:bg-red-900 inline-block px-3 py-1 rounded text-red-800 dark:text-red-200">
                    {article.threatName}
                  </p>
                </div>
                
                {/* Format Section: Summary (80 words maximum) */}
                <div>
                  <h4 className="font-semibold text-lg dark:text-gray-200">Summary</h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    {/* Limit summary to 80 words */}
                    {article.summary.split(' ').length > 80 
                      ? article.summary.split(' ').slice(0, 80).join(' ') + '...'
                      : article.summary
                    }
                  </p>
                  <div className="text-xs text-gray-500 mt-1">
                    Word count: {article.summary.split(' ').length}/80
                  </div>
                </div>
                
                {/* Format Section: Impacts */}
                <div>
                  <h4 className="font-semibold text-lg dark:text-gray-200">Impacts</h4>
                  <p className="text-gray-700 dark:text-gray-300">{article.impacts}</p>
                </div>
                
                {/* Format Section: OS Connection */}
                <div>
                  <h4 className="font-semibold text-lg dark:text-gray-200">OS Connection</h4>
                  <p className="text-gray-700 dark:text-gray-300">{article.targetOS}</p>
                </div>
                
                {/* Format Section: Source */}
                <div>
                  <h4 className="font-semibold text-lg dark:text-gray-200">Source</h4>
                  <p className="text-gray-700 dark:text-gray-300">{article.sourcePublication}</p>
                </div>
                
                <div className="pt-2">
                  <a 
                    href={article.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View Original Article
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}