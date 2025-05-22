export interface ArticleData {
  id: number;
  url: string;
  title: string;
  source: string;
  date: string;
  content: string;
  analyzedAt: string; // ISO date string
}

export type SeverityType = 'low' | 'medium' | 'high' | 'critical';

export type ThreatType = 'vulnerability' | 'malware' | 'ransomware' | 'zero-day' | 'exploit' | 'other';

export interface Product {
  name: string;
  versions?: string;
  icon?: string;
}

export interface Threat {
  type: ThreatType;
  name: string;
  details: string;
  cve?: string;
}

export interface AnalysisData {
  id: number;
  articleId: number;
  summary: string;
  severity: SeverityType;
  technicalDetails: string;
  recommendations: string;
  affectedProducts: Product[];
  threats: Threat[];
  createdAt: string; // ISO date string
}

export interface ArticleWithAnalysis {
  article: ArticleData;
  analysis: AnalysisData;
  cached?: boolean;
}

export interface HistoryItem {
  article: ArticleData;
  analysis: AnalysisData;
}
