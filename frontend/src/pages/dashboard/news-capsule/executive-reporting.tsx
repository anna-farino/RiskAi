import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function ExecutiveReporting() {
  // For our basic implementation, we'll use a mock article
  const [mockReports] = useState([
    {
      id: "mock-id-123",
      title: "Recent Cybersecurity Vulnerability Discovered",
      threatName: "Critical Remote Code Execution",
      vulnerabilityId: "CVE-2023-12345",
      summary: "Researchers have discovered a critical vulnerability affecting multiple systems. This vulnerability allows attackers to execute arbitrary code remotely, potentially leading to complete system compromise.",
      impacts: "Affects systems across multiple industries. Organizations with exposed services are particularly vulnerable.",
      attackVector: "Remote exploitation via specially crafted HTTP requests",
      microsoftConnection: "Affects Microsoft Windows servers with specific configurations",
      sourcePublication: "Security Research Blog",
      originalUrl: "https://example.com/security-article",
      targetOS: "Microsoft / Windows",
      createdAt: new Date().toISOString(),
      userId: "user-123"
    }
  ]);
  
  const [reports, setReports] = useState(mockReports);
  const navigate = useNavigate();

  const handleAddNew = () => {
    navigate("/dashboard/capsule/research");
  };

  const removeFromReport = (articleId: string) => {
    // Filter out the removed article
    setReports(reports.filter(article => article.id !== articleId));
  };

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Executive Reporting</h1>
          <p className="text-slate-300">
            View and manage articles for your executive report.
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md",
            "text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
            "disabled:pointer-events-none disabled:opacity-50",
            "bg-purple-700 text-white hover:bg-purple-600",
            "h-10 px-4 py-2"
          )}
        >
          Add New Article
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 border border-slate-700 rounded-lg bg-slate-900">
          <h3 className="text-xl font-medium mb-2">No articles in your report yet</h3>
          <p className="text-slate-400 mb-4">
            Start by adding articles from the Capsule Research page.
          </p>
          <button
            onClick={handleAddNew}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md",
              "text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
              "disabled:pointer-events-none disabled:opacity-50",
              "bg-purple-700 text-white hover:bg-purple-600",
              "h-9 px-4 py-2"
            )}
          >
            Go to Research
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((article) => (
            <div key={article.id} className="border border-slate-700 rounded-lg p-6 bg-slate-900 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{article.title}</h2>
                <div className="space-x-2">
                  <button
                    onClick={() => removeFromReport(article.id)}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md",
                      "text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                      "disabled:pointer-events-none disabled:opacity-50",
                      "bg-red-800 text-white hover:bg-red-700",
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
                  <p className="text-slate-300">{article.summary}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Threat Name</h3>
                    <p className="text-slate-300">{article.threatName}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Vulnerability ID</h3>
                    <p className="text-slate-300">{article.vulnerabilityId || "Unspecified"}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-1">Impacts</h3>
                  <p className="text-slate-300">{article.impacts}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Attack Vector</h3>
                    <p className="text-slate-300">{article.attackVector}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Microsoft Connection</h3>
                    <p className="text-slate-300">{article.microsoftConnection}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-1">Source</h3>
                  <p className="text-slate-300">
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