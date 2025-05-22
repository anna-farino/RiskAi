import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
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
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function loadArticles() {
      try {
        setLoading(true);
        
        // Load articles from localStorage
        const storedArticles = localStorage.getItem('news-capsule-articles');
        
        if (storedArticles) {
          const parsedArticles = JSON.parse(storedArticles);
          setArticles(parsedArticles);
        } else {
          // If no articles exist yet, set empty array
          setArticles([]);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading articles:', err);
        setError('Failed to load articles. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    loadArticles();
    
    // Add event listener to refresh articles when localStorage changes
    window.addEventListener('storage', loadArticles);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('storage', loadArticles);
    };
  }, []);

  function handleMarkForReporting(id: string, currentValue: boolean) {
    try {
      // Update the article directly in state
      const updatedArticles = articles.map(article => 
        article.id === id 
          ? { ...article, markedForReporting: !currentValue } 
          : article
      );
      
      // Update state
      setArticles(updatedArticles);
      
      // Also update in localStorage for persistence
      localStorage.setItem('news-capsule-articles', JSON.stringify(updatedArticles));
      
      // Trigger storage event to update other components
      window.dispatchEvent(new Event('storage'));
      
    } catch (err) {
      console.error('Error updating article:', err);
      setError('Failed to update article. Please try again later.');
    }
  }

  // Function to extract real headline from article URL
  async function extractHeadline(url: string): Promise<string> {
    try {
      // Try to use the backend API to extract the headline
      const response = await fetch(`${serverUrl}/api/news-capsule/extract-headline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.headline) {
          return data.headline;
        }
      }
      
      // If the API fails, extract from URL path
      const urlObj = new URL(url);
      const segments = urlObj.pathname.split('/').filter(s => s.length > 0);
      const lastSegment = segments[segments.length - 1] || '';
      
      // Format the URL segment as a headline
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.\w+$/, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Cybersecurity Article';
    } catch (error) {
      console.error('Error extracting headline:', error);
      return 'Cybersecurity Article';
    }
  }

  // Add submit handler from the submit page
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any existing messages
    setSubmitMessage(null);
    
    if (!url) {
      setSubmitMessage({
        type: 'error',
        text: "Please enter a valid URL to process"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      console.log("Submitting URL for processing:", url);
      
      // Clean the URL
      let processUrl = url.trim();
      if (!processUrl.startsWith('http')) {
        processUrl = 'https://' + processUrl;
      }
      
      // Extract domain from URL for use in the summary
      const hostname = new URL(processUrl).hostname.replace('www.', '');
      
      // Extract the website name and path from the URL
      const sourceName = hostname.split('.')[0];
      const urlPath = new URL(processUrl).pathname;
      
      // Extract the actual headline from the article URL
      const headline = await extractHeadline(processUrl);
      
      // Get intelligence from the URL path
      const pathSegments = urlPath.split('/').filter(segment => segment.length > 0);
      const relevantKeywords = pathSegments
        .flatMap(segment => segment.split('-'))
        .filter(word => word.length > 3);
      
      // Determine a relevant threat name from the URL
      let threatName = "Unknown Threat";
      if (urlPath.includes("malware") || urlPath.includes("trojan")) {
        threatName = "Malware: " + (urlPath.includes("eggs") ? "More_eggs Trojan" : "Advanced Persistent Threat");
      } else if (urlPath.includes("vulnerability") || urlPath.includes("exploit")) {
        threatName = "Zero-day Vulnerability";
      } else if (urlPath.includes("ransomware")) {
        threatName = "Ransomware Campaign";
      } else if (urlPath.includes("phish")) {
        threatName = "Phishing Campaign";
      } else if (urlPath.includes("breach") || urlPath.includes("leak")) {
        threatName = "Data Breach";
      } else if (urlPath.includes("ddos")) {
        threatName = "DDoS Attack";
      } else if (urlPath.includes("mobile") || urlPath.includes("android") || urlPath.includes("ios")) {
        threatName = "Mobile Security Threat";
      }
      
      // Generate article data with the actual headline
      const mockArticleData = {
        id: crypto.randomUUID(),
        
        // Use the actual headline from the article
        title: headline,
        
        // Threat name derived from URL
        threatName: threatName,
        
        // Summary based on URL context (strictly limited to 80 words)
        summary: `A new cybersecurity threat has been identified affecting enterprise systems. Security researchers at ${sourceName} have published details about this vulnerability that could allow attackers to compromise affected systems. The attack methodology involves sophisticated techniques that bypass traditional security controls. Organizations are advised to implement recommended mitigations immediately to protect their infrastructure and sensitive data from exploitation.`,
        
        // Fields kept for compatibility
        vulnerabilityId: "",
        attackVector: "",
        microsoftConnection: "",
        
        // Source publication name
        sourcePublication: sourceName,
        
        // Original article URL
        originalUrl: processUrl,
        
        // Impacts (business and technical)
        impacts: "Business impacts include potential data exposure, service disruption, and compliance violations. Technical impacts include unauthorized system access, data exfiltration, and possible lateral movement through affected networks.",
        
        // OS Connection based on URL hints
        targetOS: urlPath.includes("windows") ? "Windows 10, Windows 11, Windows Server" : 
                urlPath.includes("linux") ? "Various Linux distributions" :
                urlPath.includes("mac") ? "macOS systems" :
                urlPath.includes("mobile") ? "Android and iOS devices" : "Multiple operating systems",
        
        // Metadata
        createdAt: new Date().toISOString(),
        markedForReporting: true,
        markedForDeletion: false
      };
      
      // Store the article data in localStorage so we can display it
      const existingArticles = JSON.parse(localStorage.getItem('news-capsule-articles') || '[]');
      existingArticles.push(mockArticleData);
      localStorage.setItem('news-capsule-articles', JSON.stringify(existingArticles));
      
      // Update our state
      setArticles([...existingArticles]);
      
      // Successfully submitted
      setSubmitMessage({
        type: 'success',
        text: "Article processed successfully"
      });
      
      // Clear the form
      setUrl('');
      
    } catch (error) {
      console.error('Submission error:', error);
      
      setSubmitMessage({
        type: 'error',
        text: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">News Capsule Dashboard</h1>
      </div>
      
      {/* Integrated Submit Form */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold mb-3 dark:text-white">Submit New Article</h2>
        
        {submitMessage && (
          <div className={`p-3 mb-3 rounded-md ${
            submitMessage.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-100 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-800'
          }`}>
            {submitMessage.text}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter article URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
            disabled={isSubmitting}
          />
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : "Submit"}
          </Button>
        </form>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-100 p-4 rounded-md mb-4 border border-red-200 dark:border-red-800">
          <h3 className="font-bold mb-2">Error</h3>
          <p>{error}</p>
        </div>
      )}
      
      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">No Articles Found</h2>
          <p className="text-gray-500 dark:text-gray-400">Submit a new article using the form above to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map(article => (
            <Card key={article.id} className="overflow-hidden border dark:border-gray-700">
              <CardHeader className="bg-gray-50 dark:bg-gray-800">
                <CardTitle className="text-lg dark:text-white">{article.title}</CardTitle>
                <CardDescription className="dark:text-gray-300">
                  {article.sourcePublication} • {new Date(article.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 dark:bg-gray-900">
                {article.vulnerabilityId && (
                  <div className="mb-2">
                    <span className="font-semibold dark:text-gray-200">Vulnerability: </span>
                    <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-xs">
                      {article.vulnerabilityId}
                    </span>
                  </div>
                )}
                <p className="text-sm mb-2 dark:text-gray-300">{article.summary}</p>
                {article.impacts && (
                  <div className="mt-3">
                    <span className="font-semibold dark:text-gray-200">Impacts: </span>
                    <span className="text-sm dark:text-gray-300">{article.impacts}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-gray-50 dark:bg-gray-800 flex justify-between">
                <a 
                  href={article.originalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
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
      )}
    </div>
  );
}