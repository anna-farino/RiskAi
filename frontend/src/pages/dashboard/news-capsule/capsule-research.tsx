import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNewsCapsuleStore } from "@/store/news-capsule-store";
import { cn } from "@/lib/utils";

export default function CapsuleResearch() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [articleSummary, setArticleSummary] = useState<any>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    try {
      const response = await fetch("/api/news-capsule/scrape-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to scrape article");
      }

      const data = await response.json();
      setArticleSummary(data);
    } catch (error) {
      console.error("Error scraping article:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToReport = async () => {
    if (!articleSummary) return;
    
    try {
      const response = await fetch("/api/news-capsule/add-to-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(articleSummary),
      });

      if (!response.ok) {
        throw new Error("Failed to add article to report");
      }

      // Navigate to the executive reporting page
      navigate("/dashboard/capsule/reporting");
    } catch (error) {
      console.error("Error adding to report:", error);
    }
  };

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Capsule Research</h1>
        <p className="text-muted-foreground">
          Enter a URL to scrape and summarize an article for your executive report.
        </p>
      </div>

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
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
                  "text-sm ring-offset-background file:border-0 file:bg-transparent",
                  "file:text-sm file:font-medium placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                )}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md",
                  "text-sm font-medium ring-offset-background transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "h-10 px-4 py-2"
                )}
              >
                {loading ? "Processing..." : "Analyze"}
              </button>
            </div>
          </div>
        </form>

        {articleSummary && (
          <div className="mt-8 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{articleSummary.title}</h2>
              <button
                onClick={addToReport}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md",
                  "text-sm font-medium ring-offset-background transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "h-9 px-4 py-2"
                )}
              >
                Add to Report
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Summary</h3>
                <p className="text-muted-foreground">{articleSummary.summary}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Threat Name</h3>
                  <p className="text-muted-foreground">{articleSummary.threatName}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Vulnerability ID</h3>
                  <p className="text-muted-foreground">{articleSummary.vulnerabilityId || "Unspecified"}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-1">Impacts</h3>
                <p className="text-muted-foreground">{articleSummary.impacts}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Attack Vector</h3>
                  <p className="text-muted-foreground">{articleSummary.attackVector}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Microsoft Connection</h3>
                  <p className="text-muted-foreground">{articleSummary.microsoftConnection}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-1">Source</h3>
                <p className="text-muted-foreground">
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