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
          <h1 className="text-2xl font-bold">Cybersecurity News Report</h1>
          <p className="text-gray-500">Generated on {generateReportDate()}</p>
        </div>
        <Button>Export Report</Button>
      </div>

      <div className="space-y-8">
        {articles.map(article => (
          <Card key={article.id} className="overflow-hidden">
            <CardHeader>
              <CardTitle>{article.title}</CardTitle>
              <CardDescription>
                Source: {article.sourcePublication} | Published: {new Date(article.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {article.vulnerabilityId && (
                  <div>
                    <h4 className="font-semibold text-lg">Vulnerability ID</h4>
                    <p className="bg-red-50 inline-block px-3 py-1 rounded text-red-800">
                      {article.vulnerabilityId}
                    </p>
                  </div>
                )}
                
                <div>
                  <h4 className="font-semibold text-lg">Summary</h4>
                  <p className="text-gray-700">{article.summary}</p>
                </div>
                
                {article.impacts && (
                  <div>
                    <h4 className="font-semibold text-lg">Potential Impact</h4>
                    <p className="text-gray-700">{article.impacts}</p>
                  </div>
                )}
                
                {article.attackVector && (
                  <div>
                    <h4 className="font-semibold text-lg">Attack Vector</h4>
                    <p className="text-gray-700">{article.attackVector}</p>
                  </div>
                )}
                
                {article.targetOS && (
                  <div>
                    <h4 className="font-semibold text-lg">Affected Systems</h4>
                    <p className="text-gray-700">{article.targetOS}</p>
                  </div>
                )}
                
                <div className="pt-2">
                  <a 
                    href={article.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
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