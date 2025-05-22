import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function CapsuleResearch() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articleSummary, setArticleSummary] = useState<any>(null);
  const navigate = useNavigate();

  // Sample for demo mode only
  const demoArticle = {
    title: "Critical Zero-Day Vulnerability in Microsoft Exchange Server Under Active Exploitation",
    threatName: "Microsoft Exchange Zero-Day Vulnerability",
    vulnerabilityId: "CVE-2025-12345",
    summary: "Security researchers have discovered a zero-day vulnerability in Microsoft Exchange Server that is being actively exploited in the wild. The vulnerability allows attackers to execute remote code without authentication, potentially leading to complete system compromise and data theft.",
    impacts: "Organizations running on-premises Microsoft Exchange Server are at high risk. Successful exploitation enables attackers to gain domain administrator privileges, access sensitive emails, and potentially move laterally through the network.",
    attackVector: "The attack begins with specially crafted HTTP requests to vulnerable Exchange servers. No user interaction is required, making this vulnerability particularly dangerous.",
    microsoftConnection: "This is a critical vulnerability in Microsoft's Exchange Server product affecting all supported versions. Microsoft has released an emergency out-of-band patch that should be applied immediately.",
    sourcePublication: "Security News Research",
    originalUrl: "https://demo.example.com/article",
    targetOS: "Microsoft Windows Server",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    
    // Handle demo mode
    if (url.toLowerCase() === "demo" || url.toLowerCase().includes("demo.example.com")) {
      console.log("Using demo article");
      setTimeout(() => {
        setArticleSummary(demoArticle);
        setLoading(false);
      }, 500); // Small delay for better UX
      return;
    }
    
    try {
      // Ensure URL has http/https
      const processUrl = url.startsWith("http") ? url : `https://${url}`;
      console.log("Submitting URL for processing:", processUrl);
      
      // Call our backend API to scrape and analyze the article
      const response = await fetch("/api/news-capsule/scrape-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: processUrl }),
      });

      // If we got a non-ok response, try to parse error or throw a default message
      if (!response.ok) {
        let errorMessage = "Failed to analyze article";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }

      // Try to parse the response data
      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error("Error parsing JSON response:", e);
        throw new Error("Invalid response from server. Please try again.");
      }

      // Set the article summary from the response data
      console.log("Article data received:", data);
      setArticleSummary(data);
    } catch (error) {
      console.error("Error processing article:", error);
      
      // Provide a helpful error message when scraping fails
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze article";
      setError(
        `${errorMessage}. Please check the URL is correct and try again, or use the "demo" option to see an example.`
      );
    } finally {
      setLoading(false);
    }
  };

  const addToReport = async () => {
    if (!articleSummary) return;
    
    try {
      // Call our backend API to save the article to the report
      const response = await fetch("/api/news-capsule/add-to-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(articleSummary),
      });

      // Handle error response
      if (!response.ok) {
        let errorMessage = "Failed to add to report";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }

      // Navigate to the reporting page to view the report
      navigate("/dashboard/capsule/reporting");
    } catch (error) {
      console.error("Error adding to report:", error);
      setError(error instanceof Error ? error.message : "Failed to add to report. Please try again.");
    }
  };

  const handleDemoClick = () => {
    setUrl("demo");
    
    // Immediately show the demo data without making any API calls
    setTimeout(() => {
      setLoading(false);
      setArticleSummary(demoArticle);
    }, 500);
    
    // Show loading indicator briefly for better UX
    setLoading(true);
  };

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Capsule Research</h1>
        <p className="text-slate-300">
          Enter a URL to analyze and summarize an article for your executive report.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-red-500 bg-red-500/10 text-red-400 rounded-md">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="url" className="text-sm font-medium">
              Article URL
            </label>
            <div className="flex gap-2">
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                className={cn(
                  "flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2",
                  "text-sm ring-offset-background file:border-0 file:bg-transparent",
                  "file:text-sm file:font-medium placeholder:text-slate-500",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                )}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md",
                  "text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "bg-purple-700 text-white hover:bg-purple-600",
                  "h-10 px-4 py-2"
                )}
              >
                {loading ? "Processing..." : "Analyze"}
              </button>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-400 mt-1">
                Try: cybersecuritynews.com, gbhackers.com, arstechnica.com/security, or cyberpress.org
              </p>
              <button 
                type="button" 
                onClick={handleDemoClick}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Use demo URL
              </button>
            </div>
          </div>
        </form>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            <p className="ml-3 text-slate-300">Analyzing article...</p>
          </div>
        )}

        {articleSummary && !loading && (
          <div className="mt-8 border border-slate-700 rounded-lg p-6 bg-slate-900 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{articleSummary.title}</h2>
              <button
                onClick={addToReport}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md",
                  "text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "bg-purple-700 text-white hover:bg-purple-600",
                  "h-9 px-4 py-2"
                )}
              >
                Add to Report
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Summary</h3>
                <p className="text-slate-300">{articleSummary.summary}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Threat Name</h3>
                  <p className="text-slate-300">{articleSummary.threatName}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Vulnerability ID</h3>
                  <p className="text-slate-300">{articleSummary.vulnerabilityId || "Unspecified"}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-1">Impacts</h3>
                <p className="text-slate-300">{articleSummary.impacts}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Attack Vector</h3>
                  <p className="text-slate-300">{articleSummary.attackVector}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Microsoft Connection</h3>
                  <p className="text-slate-300">{articleSummary.microsoftConnection}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-1">Source</h3>
                <p className="text-slate-300">
                  <a 
                    href={articleSummary.originalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    {articleSummary.sourcePublication}
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}