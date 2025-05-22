export interface ArticleWithAnalysis {
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
  userId: string;
}