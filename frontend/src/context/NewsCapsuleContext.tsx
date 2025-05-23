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

interface NewsCapsuleContextType {
  processedArticles: ArticleSummary[];
  addProcessedArticle: (article: ArticleSummary) => void;
  removeProcessedArticle: (id: string) => void;
  clearProcessedArticles: () => void;
}

const NewsCapsuleContext = createContext<NewsCapsuleContextType | undefined>(undefined);

export function NewsCapsuleProvider({ children }: { children: ReactNode }) {
  const [processedArticles, setProcessedArticles] = useState<ArticleSummary[]>([]);

  const addProcessedArticle = (article: ArticleSummary) => {
    setProcessedArticles(prev => [article, ...prev]);
  };

  const removeProcessedArticle = (id: string) => {
    setProcessedArticles(prev => prev.filter(article => article.id !== id));
  };

  const clearProcessedArticles = () => {
    setProcessedArticles([]);
  };

  return (
    <NewsCapsuleContext.Provider
      value={{
        processedArticles,
        addProcessedArticle,
        removeProcessedArticle,
        clearProcessedArticles
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