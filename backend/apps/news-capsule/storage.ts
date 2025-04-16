import { 
  InsertArticle, Article, articles, 
  InsertAnalysis, Analysis, analyses,
  ArticleWithAnalysis
} from "./schema";

export interface IStorage {
  // Article operations
  getArticle(id: number): Promise<Article | undefined>;
  getArticleByUrl(url: string): Promise<Article | undefined>;
  createArticle(article: InsertArticle): Promise<Article>;
  deleteArticle(id: number): Promise<boolean>;
  getAllArticles(): Promise<Article[]>;
  
  // Analysis operations
  getAnalysis(id: number): Promise<Analysis | undefined>;
  getAnalysisByArticleId(articleId: number): Promise<Analysis | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  deleteAnalysis(id: number): Promise<boolean>;
  
  // Combined operations
  getArticleWithAnalysis(articleId: number): Promise<ArticleWithAnalysis | undefined>;
  getAllArticlesWithAnalyses(): Promise<ArticleWithAnalysis[]>;
  deleteArticleWithAnalysis(articleId: number): Promise<boolean>;
  clearAllHistory(): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private articles: Map<number, Article>;
  private analyses: Map<number, Analysis>;
  private articleCurrentId: number;
  private analysisCurrentId: number;

  constructor() {
    this.articles = new Map();
    this.analyses = new Map();
    this.articleCurrentId = 1;
    this.analysisCurrentId = 1;
  }

  // Article operations
  async getArticle(id: number): Promise<Article | undefined> {
    return this.articles.get(id);
  }

  async getArticleByUrl(url: string): Promise<Article | undefined> {
    return Array.from(this.articles.values()).find(
      (article) => article.url === url
    );
  }

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const id = this.articleCurrentId++;
    const article: Article = { 
      ...insertArticle, 
      id, 
      analyzedAt: new Date() 
    };
    this.articles.set(id, article);
    return article;
  }

  async deleteArticle(id: number): Promise<boolean> {
    return this.articles.delete(id);
  }

  async getAllArticles(): Promise<Article[]> {
    return Array.from(this.articles.values());
  }

  // Analysis operations
  async getAnalysis(id: number): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async getAnalysisByArticleId(articleId: number): Promise<Analysis | undefined> {
    return Array.from(this.analyses.values()).find(
      (analysis) => analysis.articleId === articleId
    );
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = this.analysisCurrentId++;
    const analysis: Analysis = {
      ...insertAnalysis,
      id,
      createdAt: new Date()
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async deleteAnalysis(id: number): Promise<boolean> {
    return this.analyses.delete(id);
  }

  // Combined operations
  async getArticleWithAnalysis(articleId: number): Promise<ArticleWithAnalysis | undefined> {
    const article = await this.getArticle(articleId);
    if (!article) return undefined;

    const analysis = await this.getAnalysisByArticleId(articleId);
    if (!analysis) return undefined;

    return { article, analysis };
  }

  async getAllArticlesWithAnalyses(): Promise<ArticleWithAnalysis[]> {
    const result: ArticleWithAnalysis[] = [];
    
    for (const article of this.articles.values()) {
      const analysis = await this.getAnalysisByArticleId(article.id);
      if (analysis) {
        result.push({ article, analysis });
      }
    }
    
    // Sort by analyzed date, newest first
    return result.sort((a, b) => 
      b.article.analyzedAt.getTime() - a.article.analyzedAt.getTime()
    );
  }

  async deleteArticleWithAnalysis(articleId: number): Promise<boolean> {
    const analysis = await this.getAnalysisByArticleId(articleId);
    if (analysis) {
      await this.deleteAnalysis(analysis.id);
    }
    
    return this.deleteArticle(articleId);
  }

  async clearAllHistory(): Promise<boolean> {
    this.articles.clear();
    this.analyses.clear();
    return true;
  }
}

export const storage = new MemStorage();
