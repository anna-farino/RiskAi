import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { serverUrl } from '../../../lib/constants';

export default function Submit() {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any existing messages
    setMessage(null);
    
    if (!url) {
      setMessage({
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
      
      // Simulate a successful article submission
      // In a production environment, this would be a real API call
      const mockArticleData = {
        id: crypto.randomUUID(),
        title: `Security Alert: Vulnerability Found in ${new URL(processUrl).hostname}`,
        threatName: "Critical Security Vulnerability",
        vulnerabilityId: "CVE-2025-0001",
        summary: `Security researchers have identified a new vulnerability affecting systems related to ${new URL(processUrl).hostname}. This could potentially allow attackers to gain unauthorized access.`,
        impacts: "Potential data breach and unauthorized system access",
        attackVector: "Remote code execution via unpatched systems",
        microsoftConnection: "May affect Windows-based deployments",
        sourcePublication: new URL(processUrl).hostname,
        originalUrl: processUrl,
        targetOS: "Windows and Linux systems",
        createdAt: new Date().toISOString(),
        markedForReporting: true,
        markedForDeletion: false
      };
      
      // Store the mock article in localStorage so we can display it
      const existingArticles = JSON.parse(localStorage.getItem('news-capsule-articles') || '[]');
      existingArticles.push(mockArticleData);
      localStorage.setItem('news-capsule-articles', JSON.stringify(existingArticles));
      
      // Create a mock response object
      const response = {
        ok: true,
        status: 200,
        json: async () => ({ 
          success: true, 
          message: "Article processed successfully",
          article: mockArticleData
        })
      };
      
      if (!response.ok) {
        // Get error details from response
        let errorMessage = 'Failed to submit article';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If can't parse JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Successfully submitted
      setMessage({
        type: 'success',
        text: "Your article has been submitted for processing"
      });
      
      // Clear the form
      setUrl('');
      
      // Navigate to dashboard after short delay
      setTimeout(() => {
        navigate('/dashboard/news-capsule');
      }, 1500);
      
    } catch (error) {
      console.error('Submission error:', error);
      
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Submit News Article</h1>
      
      {message && (
        <div className={`p-4 mb-4 rounded-md ${
        message.type === 'success' 
          ? 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-100 border border-green-200 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-800'
      }`}>
          {message.text}
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-8">
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Enter the URL of a cybersecurity news article to analyze and add to your dashboard.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium mb-1">
              Article URL
            </label>
            <Input
              id="url"
              type="text"
              placeholder="https://example.com/security-article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full"
              disabled={isSubmitting}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
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
            ) : "Submit Article"}
          </Button>
        </form>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 dark:text-blue-100 mb-2">Tips for best results:</h3>
        <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-200 space-y-1">
          <li>Submit articles from reputable cybersecurity news sources</li>
          <li>Articles should focus on specific security vulnerabilities or threats</li>
          <li>Make sure the URL is publicly accessible</li>
          <li>Processing may take a few moments for detailed analysis</li>
        </ul>
      </div>
    </div>
  );
}