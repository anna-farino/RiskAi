import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function CapsuleResearch() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articleSummary, setArticleSummary] = useState<any>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    
    try {
      // Call our backend API to scrape and analyze the article
      const response = await fetch("/api/news-capsule/scrape-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to scrape article");
      }

      const data = await response.json();
      setArticleSummary(data);
    } catch (error) {
      console.error("Error scraping article:", error);
      setError(error instanceof Error ? error.message : "Failed to scrape article. Please try again.");
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add to report");
      }

      // Navigate to the reporting page to view the report
      navigate("/dashboard/capsule/reporting");
    } catch (error) {
      console.error("Error adding to report:", error);
      setError(error instanceof Error ? error.message : "Failed to add to report. Please try again.");
    }
  };

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Capsule Research</h1>
        <p className="text-slate-300">
          Enter a URL to scrape and summarize an article for your executive report.
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
            <p className="text-xs text-slate-400 mt-1">
              Example: https://cybersecuritynews.com/more_eggs-malware-exploits-job-application-emails/
            </p>
          </div>
        </form>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            <p className="ml-3 text-slate-300">Scraping and analyzing article...</p>
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
              
              <div className="grid grid-cols-2 gap-4">
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
              
              <div className="grid grid-cols-2 gap-4">
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