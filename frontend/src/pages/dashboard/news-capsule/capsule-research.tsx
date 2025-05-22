import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function CapsuleResearch() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [articleSummary, setArticleSummary] = useState<any>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    // Simplified version for basic working page
    setLoading(true);
    try {
      // Simulate API call with a timeout
      setTimeout(() => {
        const mockData = {
          id: "mock-id-123",
          title: "Recent Cybersecurity Vulnerability Discovered",
          threatName: "Critical Remote Code Execution",
          vulnerabilityId: "CVE-2023-12345",
          summary: "Researchers have discovered a critical vulnerability affecting multiple systems. This vulnerability allows attackers to execute arbitrary code remotely, potentially leading to complete system compromise.",
          impacts: "Affects systems across multiple industries. Organizations with exposed services are particularly vulnerable.",
          attackVector: "Remote exploitation via specially crafted HTTP requests",
          microsoftConnection: "Affects Microsoft Windows servers with specific configurations",
          sourcePublication: "Security Research Blog",
          originalUrl: url,
          targetOS: "Microsoft / Windows",
          createdAt: new Date().toISOString(),
          userId: "user-123"
        };
        
        setArticleSummary(mockData);
        setLoading(false);
      }, 1500);
    } catch (error) {
      console.error("Error in demo mode:", error);
      setLoading(false);
    }
  };

  const addToReport = () => {
    if (!articleSummary) return;
    
    // In this basic implementation, we'll just navigate to reporting
    navigate("/dashboard/capsule/reporting");
  };

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Capsule Research</h1>
        <p className="text-slate-300">
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
          </div>
        </form>

        {articleSummary && (
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