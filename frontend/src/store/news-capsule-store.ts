import { ArticleWithAnalysis } from '@/lib/news-capsule-types';
import { create } from 'zustand'


type NewsCapsuleStore = {
  showExportModal: boolean,
  setShowExportModal: (b: boolean) => void

  currentReport: ArticleWithAnalysis | null,
  setCurrentReport: (a: ArticleWithAnalysis) => void

  allReports: ArticleWithAnalysis[]
  setAllReports: (articles: ArticleWithAnalysis[]) => void
}


export const useNewsCapsuleStore = create<NewsCapsuleStore>((set) => ({
  showExportModal: false,
  setShowExportModal: (b: boolean) => set({ showExportModal: b }),

  currentReport: null,
  setCurrentReport: (a: ArticleWithAnalysis) => set({ currentReport: a}),

  allReports: [],
  setAllReports: (articles: ArticleWithAnalysis[]) => set({ allReports: articles})
}));
