import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNewsCapsuleStore } from "@/store/news-capsule-store";
import { cn } from "@/lib/utils";
import { ArticleWithAnalysis } from "@/lib/news-capsule-types";

export default function ExecutiveReporting() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { allReports, setAllReports } = useNewsCapsuleStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch("/api/news-capsule/reports");
        if (!response.ok) {
          throw new Error("Failed to fetch reports");
        }
        const data = await response.json();
        setAllReports(data);
      } catch (err) {
        setError("Failed to load reports. Please try again later.");
        console.error("Error fetching reports:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [setAllReports]);

  const handleAddNew = () => {
    navigate("/dashboard/capsule/research");
  };

  const removeFromReport = async (articleId: string) => {
    try {
      const response = await fetch(`/api/news-capsule/reports/${articleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove article from report");
      }

      // Update the local state
      setAllReports(allReports.filter(article => article.id !== articleId));
    } catch (err) {
      console.error("Error removing article:", err);
      setError("Failed to remove article. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Executive Reporting</h1>
          <p className="text-muted-foreground">
            View and manage articles for your executive report.
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md",
            "text-sm font-medium ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "h-10 px-4 py-2"
          )}
        >
          Add New Article
        </button>
      </div>

      {error && (
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {allReports.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <h3 className="text-xl font-medium mb-2">No articles in your report yet</h3>
          <p className="text-muted-foreground mb-4">
            Start by adding articles from the Capsule Research page.
          </p>
          <button
            onClick={handleAddNew}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md",
              "text-sm font-medium ring-offset-background transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "h-9 px-4 py-2"
            )}
          >
            Go to Research
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {allReports.map((article) => (
            <div key={article.id} className="border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{article.title}</h2>
                <div className="space-x-2">
                  <button
                    onClick={() => removeFromReport(article.id)}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md",
                      "text-sm font-medium ring-offset-background transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "disabled:pointer-events-none disabled:opacity-50",
                      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                      "h-9 px-4 py-2"
                    )}
                  >
                    Remove
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Summary</h3>
                  <p className="text-muted-foreground">{article.summary}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Threat Name</h3>
                    <p className="text-muted-foreground">{article.threatName}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Vulnerability ID</h3>
                    <p className="text-muted-foreground">{article.vulnerabilityId || "Unspecified"}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-1">Impacts</h3>
                  <p className="text-muted-foreground">{article.impacts}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Attack Vector</h3>
                    <p className="text-muted-foreground">{article.attackVector}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Microsoft Connection</h3>
                    <p className="text-muted-foreground">{article.microsoftConnection}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-1">Source</h3>
                  <p className="text-muted-foreground">
                    <a 
                      href={article.originalUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {article.sourcePublication}
                    </a>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}