import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText } from 'lucide-react';
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

export default function Reports() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Function to generate a simple text report
  const generateTextReport = () => {
    if (!articles.length) return '';

    let report = 'CYBERSECURITY THREAT INTELLIGENCE REPORT\n';
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    
    articles.forEach((article, index) => {
      report += `ARTICLE ${index + 1}\n`;
      report += `Title: ${article.title}\n`;
      report += `Threat Name(s): ${article.threatName}\n`;
      report += `Summary: ${article.summary}\n`;
      report += `Impacts: ${article.impacts}\n`;
      report += `OS Connection: ${article.osConnection}\n`;
      report += `Source: ${article.source}\n\n`;
    });
    
    return report;
  };

  // Download report
  const downloadReport = () => {
    const reportText = generateTextReport();
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Executive Reports</h2>
        <Button
          onClick={downloadReport}
          disabled={loading || articles.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download Report
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-red-500">
            {error}
          </CardContent>
        </Card>
      ) : articles.length > 0 ? (
        <div className="space-y-6">
          {articles.map((article) => (
            <Card key={article.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{article.title}</CardTitle>
                    <CardDescription>{article.source} • {new Date(article.createdAt).toLocaleDateString()}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Threat Name(s)</h3>
                    <p>{article.threatName}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">OS Connection</h3>
                    <p>{article.osConnection}</p>
                  </div>
                  <div className="md:col-span-2">
                    <h3 className="font-semibold mb-2">Summary</h3>
                    <p>{article.summary}</p>
                  </div>
                  <div className="md:col-span-2">
                    <h3 className="font-semibold mb-2">Impacts</h3>
                    <p>{article.impacts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Reports Available</h3>
            <p className="text-gray-500 mb-4">
              Submit articles in the dashboard to generate executive reports.
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard/news-capsule'}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}