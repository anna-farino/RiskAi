import React, { createContext, useState, useContext, ReactNode } from "react";

interface ArticleSummary {
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
  createdAt: string;
  markedForReporting: boolean;
  markedForDeletion: boolean;
}

interface Report {
  id: string;
  createdAt: string;
  articles: ArticleSummary[];
  versionNumber?: number;
}

interface NewsCapsuleContextType {
  processedArticles: ArticleSummary[];
  addProcessedArticle: (article: ArticleSummary) => void;
  removeProcessedArticle: (id: string) => void;
  clearProcessedArticles: () => void;
  reports: Report[];
  addReport: (report: Report) => void;
  removeReport: (id: string) => void;
  updateReport: (id: string, updatedReport: Report) => void;
}

const initialContext: NewsCapsuleContextType = {
  processedArticles: [],
  addProcessedArticle: () => {},
  removeProcessedArticle: () => {},
  clearProcessedArticles: () => {},
  reports: [],
  addReport: () => {},
  removeReport: () => {},
  updateReport: () => {}
};

const NewsCapsuleContext = createContext<NewsCapsuleContextType>(initialContext);

export function NewsCapsuleProvider({ children }: { children: ReactNode }) {
  // Load saved articles from localStorage if available
  const savedArticles = localStorage.getItem('newsCapsuleArticles');
  const initialArticles = savedArticles ? JSON.parse(savedArticles) : [];
  const [processedArticles, setProcessedArticles] = useState<ArticleSummary[]>(initialArticles);

  // Load saved reports from localStorage if available
  const savedReports = localStorage.getItem('newsCapsuleReports');
  const initialReports = savedReports ? JSON.parse(savedReports) : [];
  const [reports, setReports] = useState<Report[]>(initialReports);

  // Save articles to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('newsCapsuleArticles', JSON.stringify(processedArticles));
  }, [processedArticles]);

  // Save reports to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('newsCapsuleReports', JSON.stringify(reports));
  }, [reports]);

  const addProcessedArticle = (article: ArticleSummary) => {
    setProcessedArticles(prev => {
      // Avoid duplicates by checking if article with same ID already exists
      const exists = prev.some(a => a.id === article.id);
      if (exists) return prev;
      return [article, ...prev];
    });
  };

  const removeProcessedArticle = (id: string) => {
    setProcessedArticles(prev => prev.filter(article => article.id !== id));
  };

  const clearProcessedArticles = () => {
    setProcessedArticles([]);
  };

  const addReport = (report: Report) => {
    setReports(prev => {
      // Calculate version number based on reports from same day
      const today = new Date(report.createdAt).toDateString();
      const reportsFromToday = prev.filter(r => 
        new Date(r.createdAt).toDateString() === today
      );
      
      const newReport = {
        ...report,
        versionNumber: reportsFromToday.length + 1
      };
      
      return [newReport, ...prev];
    });
  };

  const removeReport = (id: string) => {
    setReports(prev => prev.filter(report => report.id !== id));
  };

  const updateReport = (id: string, updatedReport: Report) => {
    setReports(prev => 
      prev.map(report => report.id === id ? updatedReport : report)
    );
  };

  return (
    <NewsCapsuleContext.Provider
      value={{
        processedArticles,
        addProcessedArticle,
        removeProcessedArticle,
        clearProcessedArticles,
        reports,
        addReport,
        removeReport,
        updateReport
      }}
    >
      {children}
    </NewsCapsuleContext.Provider>
  );
}

export function useNewsCapsule() {
  const context = useContext(NewsCapsuleContext);
  if (context === undefined) {
    throw new Error("useNewsCapsule must be used within a NewsCapsuleProvider");
  }
  return context;
}