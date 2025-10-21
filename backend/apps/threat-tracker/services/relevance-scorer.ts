import { db } from '../../../db/db';
import { globalArticles } from '../../../../shared/db/schema/global-tables';
import { articleRelevanceScores } from '../../../../shared/db/schema/threat-tracker/relevance-scoring';
import { 
  articleSoftware,
  articleHardware,
  articleCompanies,
  articleCves,
  articleThreatActors
} from '../../../../shared/db/schema/threat-tracker/entity-associations';
import {
  usersSoftware,
  usersHardware,
  usersCompanies
} from '../../../../shared/db/schema/threat-tracker/user-associations';
import {
  software,
  hardware,
  companies,
  threatActors
} from '../../../../shared/db/schema/threat-tracker/entities';
import { userKeywords } from '../../../../shared/db/schema/global-tables';
import { eq, and, inArray, isNull, gte, desc, sql } from 'drizzle-orm';

// Types
interface UserEntities {
  software: Array<{
    id: string;
    name: string | null;
    version: string | null;
    company: string | null;
    priority: number | null;
  }>;
  hardware: Array<{
    id: string;
    name: string | null;
    model: string | null;
    manufacturer: string | null;
    priority: number | null;
  }>;
  companies: Array<{
    id: string;
    name: string | null;
    type: string | null;
    relationshipType: string | null;
    priority: number | null;
  }>;
}

interface ArticleEntities {
  software: Array<{
    id: string;
    name: string;
    specificity?: 'generic' | 'partial' | 'specific';
    confidence?: number;
  }>;
  hardware: Array<{
    id: string;
    name: string;
    specificity?: 'generic' | 'partial' | 'specific';
    confidence?: number;
  }>;
  companies: Array<{
    id: string;
    name: string;
    type: string | null;
    specificity?: 'generic' | 'specific';
    confidence?: number;
  }>;
}

interface RelevanceScoreResult {
  total: number;
  software: number;
  client: number;
  vendor: number;
  hardware: number;
  keyword: number;
  matchedSoftware: string[];
  matchedCompanies: string[];
  matchedHardware: string[];
  matchedKeywords: string[];
  metadata: any;
}

export class RelevanceScorer {
  private readonly MAX_BATCH_SIZE = 2000;
  private readonly MAX_AGE_DAYS = 365; // 1 year
  
  /**
   * Batch calculate and store relevance scores for new articles
   * Called when user enters the frontend (login or returning with active session) or changes technology stack
   */
  async batchCalculateRelevance(
    userId: string,
    options?: { 
      forceRecalculate?: boolean; // For tech stack changes
      articleIds?: string[]; // Specific articles to calculate
    }
  ): Promise<void> {
    // Get user's current technology stack
    const userEntities = await this.getUserEntities(userId);
    
    // Find articles that need scoring
    const articlesToScore = await this.getArticlesNeedingScores(userId, options);
    
    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < articlesToScore.length; i += batchSize) {
      const batch = articlesToScore.slice(i, i + batchSize);
      await this.processBatch(batch, userId, userEntities);
    }
  }
  
  /**
   * Get articles that need relevance scores
   */
  private async getArticlesNeedingScores(
    userId: string,
    options?: { forceRecalculate?: boolean; articleIds?: string[] }
  ): Promise<any[]> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (options?.articleIds) {
      // Specific articles requested (e.g., for one-off scoring)
      return db.select()
        .from(globalArticles)
        .where(and(
          inArray(globalArticles.id, options.articleIds),
          eq(globalArticles.isCybersecurity, true)
        ))
        .limit(this.MAX_BATCH_SIZE);
    }
    
    if (options?.forceRecalculate) {
      // Tech stack changed - recalculate all scores within limits
      return db.select()
        .from(globalArticles)
        .where(and(
          eq(globalArticles.isCybersecurity, true),
          gte(globalArticles.publishDate, oneYearAgo)
        ))
        .orderBy(desc(globalArticles.publishDate))
        .limit(this.MAX_BATCH_SIZE);
    }
    
    // Normal case - only calculate missing scores
    const articlesWithScores = db.select({ id: globalArticles.id })
      .from(globalArticles)
      .leftJoin(
        articleRelevanceScores,
        and(
          eq(articleRelevanceScores.articleId, globalArticles.id),
          eq(articleRelevanceScores.userId, userId)
        )
      )
      .where(and(
        eq(globalArticles.isCybersecurity, true),
        gte(globalArticles.publishDate, oneYearAgo),
        isNull(articleRelevanceScores.id) // No existing score
      ))
      .orderBy(desc(globalArticles.publishDate))
      .limit(this.MAX_BATCH_SIZE);
    
    return articlesWithScores;
  }
  
  /**
   * Process a batch of articles and calculate relevance scores
   */
  private async processBatch(
    articles: any[], 
    userId: string, 
    userEntities: UserEntities
  ): Promise<void> {
    const scores = [];
    
    for (const article of articles) {
      const articleId = article.id || article.article?.id;
      if (!articleId) continue;
      
      const score = await this.calculateRelevanceScore(articleId, userId, userEntities);
      scores.push({
        articleId,
        userId,
        relevanceScore: score.total.toString(),
        softwareScore: score.software.toString(),
        clientScore: score.client.toString(),
        vendorScore: score.vendor.toString(),
        hardwareScore: score.hardware.toString(),
        keywordScore: score.keyword.toString(),
        matchedSoftware: score.matchedSoftware,
        matchedCompanies: score.matchedCompanies,
        matchedHardware: score.matchedHardware,
        matchedKeywords: score.matchedKeywords,
        calculatedAt: new Date(),
        calculationVersion: '1.0',
        metadata: score.metadata
      });
    }
    
    // Bulk insert/update scores
    if (scores.length > 0) {
      await db.insert(articleRelevanceScores)
        .values(scores)
        .onConflictDoUpdate({
          target: [articleRelevanceScores.articleId, articleRelevanceScores.userId],
          set: {
            relevanceScore: sql`excluded.relevance_score`,
            softwareScore: sql`excluded.software_score`,
            clientScore: sql`excluded.client_score`,
            vendorScore: sql`excluded.vendor_score`,
            hardwareScore: sql`excluded.hardware_score`,
            keywordScore: sql`excluded.keyword_score`,
            matchedSoftware: sql`excluded.matched_software`,
            matchedCompanies: sql`excluded.matched_companies`,
            matchedHardware: sql`excluded.matched_hardware`,
            matchedKeywords: sql`excluded.matched_keywords`,
            calculatedAt: sql`excluded.calculated_at`,
            calculationVersion: sql`excluded.calculation_version`,
            metadata: sql`excluded.metadata`
          }
        });
    }
  }
  
  /**
   * Calculate relevance score for a single article
   * Used both in batch processing and one-off calculations
   */
  async calculateRelevanceScore(
    articleId: string, 
    userId: string, 
    userEntities?: UserEntities
  ): Promise<RelevanceScoreResult> {
    // Get user entities if not provided
    if (!userEntities) {
      userEntities = await this.getUserEntities(userId);
    }
    
    // Get article's entities
    const articleEntities = await this.getArticleEntities(articleId);
    
    // Calculate component scores
    const scores = {
      software: await this.scoreSoftwareRelevance(articleEntities.software, userEntities.software, articleId),
      client: await this.scoreClientRelevance(articleEntities.companies, userEntities.companies, articleId),
      vendor: await this.scoreVendorRelevance(articleEntities.companies, userEntities.companies, articleId),
      hardware: await this.scoreHardwareRelevance(articleEntities.hardware, userEntities.hardware, articleId),
      keyword: await this.scoreKeywordActivity(articleId, userId)
    };
    
    // Apply rubric weights
    const totalScore = (
      (0.25 * scores.software) +
      (0.25 * scores.client) +
      (0.20 * scores.vendor) +
      (0.15 * scores.hardware) +
      (0.15 * scores.keyword)
    );
    
    return {
      total: Math.min(totalScore * 10, 100), // Convert to 0-100 scale
      ...scores,
      matchedSoftware: await this.getMatchedSoftwareIds(articleEntities.software, userEntities.software),
      matchedCompanies: await this.getMatchedCompanyIds(articleEntities.companies, userEntities.companies),
      matchedHardware: await this.getMatchedHardwareIds(articleEntities.hardware, userEntities.hardware),
      matchedKeywords: await this.getMatchedKeywords(articleId, userId),
      metadata: {
        userEntityCounts: {
          software: userEntities.software.length,
          companies: userEntities.companies.length,
          hardware: userEntities.hardware.length
        },
        articleEntityCounts: {
          software: articleEntities.software.length,
          companies: articleEntities.companies.length,
          hardware: articleEntities.hardware.length
        }
      }
    };
  }
  
  /**
   * Get user's technology stack entities
   */
  private async getUserEntities(userId: string): Promise<UserEntities> {
    const [softwareResults, hardwareResults, companiesResults] = await Promise.all([
      db.select({
        id: software.id,
        name: software.name,
        version: usersSoftware.version,
        company: companies.name,
        priority: usersSoftware.priority
      })
      .from(usersSoftware)
      .innerJoin(software, eq(usersSoftware.softwareId, software.id))
      .leftJoin(companies, eq(software.companyId, companies.id))
      .where(and(
        eq(usersSoftware.userId, userId),
        eq(usersSoftware.isActive, true)
      )),
      
      db.select({
        id: hardware.id,
        name: hardware.name,
        model: hardware.model,
        manufacturer: hardware.manufacturer,
        priority: usersHardware.priority
      })
      .from(usersHardware)
      .innerJoin(hardware, eq(usersHardware.hardwareId, hardware.id))
      .where(and(
        eq(usersHardware.userId, userId),
        eq(usersHardware.isActive, true)
      )),
      
      db.select({
        id: companies.id,
        name: companies.name,
        type: companies.type,
        relationshipType: usersCompanies.relationshipType,
        priority: usersCompanies.priority
      })
      .from(usersCompanies)
      .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
      .where(and(
        eq(usersCompanies.userId, userId),
        eq(usersCompanies.isActive, true)
      ))
    ]);
    
    return { 
      software: softwareResults, 
      hardware: hardwareResults, 
      companies: companiesResults 
    };
  }
  
  /**
   * Get article's extracted entities with metadata
   */
  private async getArticleEntities(articleId: string): Promise<ArticleEntities> {
    const [softwareResults, hardwareResults, companiesResults] = await Promise.all([
      db.select({
        id: software.id,
        name: software.name,
        confidence: articleSoftware.confidence,
        metadata: articleSoftware.metadata
      })
      .from(articleSoftware)
      .innerJoin(software, eq(articleSoftware.softwareId, software.id))
      .where(eq(articleSoftware.articleId, articleId)),
      
      db.select({
        id: hardware.id,
        name: hardware.name,
        confidence: articleHardware.confidence,
        metadata: articleHardware.metadata
      })
      .from(articleHardware)
      .innerJoin(hardware, eq(articleHardware.hardwareId, hardware.id))
      .where(eq(articleHardware.articleId, articleId)),
      
      db.select({
        id: companies.id,
        name: companies.name,
        type: companies.type,
        confidence: articleCompanies.confidence,
        metadata: articleCompanies.metadata,
        mentionType: articleCompanies.mentionType
      })
      .from(articleCompanies)
      .innerJoin(companies, eq(articleCompanies.companyId, companies.id))
      .where(eq(articleCompanies.articleId, articleId))
    ]);
    
    // Extract specificity from metadata
    const softwareEntities = softwareResults.map(s => ({
      id: s.id,
      name: s.name,
      specificity: (s.metadata as any)?.specificity || 'specific',
      confidence: parseFloat(s.confidence || '1')
    }));
    
    const hardwareEntities = hardwareResults.map(h => ({
      id: h.id,
      name: h.name,
      specificity: (h.metadata as any)?.specificity || 'specific',
      confidence: parseFloat(h.confidence || '1')
    }));
    
    const companyEntities = companiesResults.map(c => ({
      id: c.id,
      name: c.name,
      type: c.mentionType,
      specificity: (c.metadata as any)?.specificity || 'specific',
      confidence: parseFloat(c.confidence || '1')
    }));
    
    return { 
      software: softwareEntities, 
      hardware: hardwareEntities, 
      companies: companyEntities 
    };
  }
  
  /**
   * Calculate software relevance score with soft matching
   */
  private async scoreSoftwareRelevance(
    articleSoftware: ArticleEntities['software'],
    userSoftware: UserEntities['software'],
    articleId: string
  ): Promise<number> {
    if (!articleSoftware.length || !userSoftware.length) return 0;
    
    let maxScore = 0;
    
    for (const articleSw of articleSoftware) {
      for (const userSw of userSoftware) {
        let score = 0;
        
        // Exact match
        if (articleSw.id === userSw.id) {
          score = 10;
        }
        // Same vendor (if we have company info)
        else if (userSw.company && articleSw.name.toLowerCase().includes(userSw.company.toLowerCase())) {
          score = 7;
        }
        // Partial name match
        else if (this.isSoftwareRelated(articleSw.name, userSw.name || '')) {
          score = 5;
        }
        
        // Apply soft match handling
        if (articleSw.specificity === 'partial') {
          score *= 0.70; // 70% weight for partial matches
        } else if (articleSw.specificity === 'generic') {
          // Generic matches only count if confidence is decent
          if (articleSw.confidence >= 0.55) {
            score *= 0.45; // 45% weight for generic but confident
          } else {
            score = 0; // Too vague and low confidence - skip
          }
        }
        
        // Confidence threshold
        if (articleSw.confidence < 0.55) {
          score *= 0.3;
        }
        
        // Apply user priority weight (0.5 to 1.5 multiplier)
        if (userSw.priority) {
          score *= (0.5 + (userSw.priority / 100));
        }
        
        maxScore = Math.max(maxScore, score);
      }
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Calculate client relevance score
   */
  private async scoreClientRelevance(
    articleCompanies: ArticleEntities['companies'],
    userCompanies: UserEntities['companies'],
    articleId: string
  ): Promise<number> {
    if (!articleCompanies.length || !userCompanies.length) return 0;
    
    const clientCompanies = userCompanies.filter(c => 
      c.relationshipType === 'client' || c.type === 'client'
    );
    
    if (!clientCompanies.length) return 0;
    
    let maxScore = 0;
    
    for (const articleCo of articleCompanies) {
      // Only consider if mentioned as affected/client
      if (articleCo.type !== 'affected' && articleCo.type !== 'client') continue;
      
      for (const userCo of clientCompanies) {
        let score = 0;
        
        if (articleCo.id === userCo.id) {
          score = 10; // Direct client impact
        } else if (this.isCompanyRelated(articleCo.name, userCo.name || '')) {
          score = 6; // Related company
        }
        
        // Apply specificity handling
        if (articleCo.specificity === 'generic' && articleCo.confidence >= 0.55) {
          score *= 0.5; // Generic but confident
        }
        
        // Apply priority
        if (userCo.priority) {
          score *= (0.5 + (userCo.priority / 100));
        }
        
        maxScore = Math.max(maxScore, score);
      }
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Calculate vendor relevance score
   */
  private async scoreVendorRelevance(
    articleCompanies: ArticleEntities['companies'],
    userCompanies: UserEntities['companies'],
    articleId: string
  ): Promise<number> {
    if (!articleCompanies.length || !userCompanies.length) return 0;
    
    const vendorCompanies = userCompanies.filter(c => 
      c.relationshipType === 'vendor' || c.type === 'vendor'
    );
    
    if (!vendorCompanies.length) return 0;
    
    let maxScore = 0;
    
    for (const articleCo of articleCompanies) {
      // Consider if mentioned as vendor or affected
      if (articleCo.type !== 'vendor' && articleCo.type !== 'affected') continue;
      
      for (const userCo of vendorCompanies) {
        let score = 0;
        
        if (articleCo.id === userCo.id) {
          score = 8; // Vendor product issue
        } else if (this.isCompanyRelated(articleCo.name, userCo.name || '')) {
          score = 5; // Related vendor
        }
        
        // Apply specificity handling
        if (articleCo.specificity === 'generic' && articleCo.confidence >= 0.55) {
          score *= 0.5;
        }
        
        // Apply priority
        if (userCo.priority) {
          score *= (0.5 + (userCo.priority / 100));
        }
        
        maxScore = Math.max(maxScore, score);
      }
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Calculate hardware relevance score
   */
  private async scoreHardwareRelevance(
    articleHardware: ArticleEntities['hardware'],
    userHardware: UserEntities['hardware'],
    articleId: string
  ): Promise<number> {
    if (!articleHardware.length || !userHardware.length) return 0;
    
    let maxScore = 0;
    
    for (const articleHw of articleHardware) {
      for (const userHw of userHardware) {
        let score = 0;
        
        // Exact match
        if (articleHw.id === userHw.id) {
          score = 10;
        }
        // Same manufacturer
        else if (userHw.manufacturer && articleHw.name.toLowerCase().includes(userHw.manufacturer.toLowerCase())) {
          score = 7;
        }
        // Partial match
        else if (this.isHardwareRelated(articleHw.name, userHw.name || '', userHw.model || '')) {
          score = 5;
        }
        
        // Apply soft match handling
        if (articleHw.specificity === 'partial') {
          score *= 0.70;
        } else if (articleHw.specificity === 'generic') {
          if (articleHw.confidence >= 0.55) {
            score *= 0.45;
          } else {
            score = 0;
          }
        }
        
        // Confidence threshold
        if (articleHw.confidence < 0.55) {
          score *= 0.3;
        }
        
        // Apply priority
        if (userHw.priority) {
          score *= (0.5 + (userHw.priority / 100));
        }
        
        maxScore = Math.max(maxScore, score);
      }
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Calculate keyword activity score
   */
  private async scoreKeywordActivity(articleId: string, userId: string): Promise<number> {
    // Get user's keywords
    const keywords = await db.select()
      .from(userKeywords)
      .where(and(
        eq(userKeywords.userId, userId),
        eq(userKeywords.appContext, 'threat_tracker'),
        eq(userKeywords.isActive, true)
      ));
    
    if (!keywords.length) return 0;
    
    // Get article content
    const [article] = await db.select()
      .from(globalArticles)
      .where(eq(globalArticles.id, articleId))
      .limit(1);
    
    if (!article) return 0;
    
    const contentLower = (article.content + ' ' + article.title).toLowerCase();
    let matchCount = 0;
    let totalKeywords = keywords.length;
    
    for (const keyword of keywords) {
      if (keyword.term && contentLower.includes(keyword.term.toLowerCase())) {
        matchCount++;
      }
    }
    
    // Score based on percentage of keywords matched
    const matchPercentage = matchCount / totalKeywords;
    return Math.min(matchPercentage * 10, 10);
  }
  
  /**
   * Get matched entity IDs for display
   */
  private async getMatchedSoftwareIds(
    articleSoftware: ArticleEntities['software'],
    userSoftware: UserEntities['software']
  ): Promise<string[]> {
    const matched: string[] = [];
    const addedIds = new Set<string>();
    
    // Only return IDs that are actually in the user's tech stack
    for (const userSw of userSoftware) {
      for (const articleSw of articleSoftware) {
        if (articleSw.id === userSw.id || 
            this.isSoftwareRelated(articleSw.name, userSw.name || '')) {
          // Push the USER'S entity ID, not the article's, and avoid duplicates
          if (!addedIds.has(userSw.id)) {
            matched.push(userSw.id);
            addedIds.add(userSw.id);
          }
          break;
        }
      }
    }
    
    return matched;
  }
  
  private async getMatchedCompanyIds(
    articleCompanies: ArticleEntities['companies'],
    userCompanies: UserEntities['companies']
  ): Promise<string[]> {
    const matched: string[] = [];
    const addedIds = new Set<string>();
    
    // Only return IDs that are actually in the user's tech stack
    for (const userCo of userCompanies) {
      for (const articleCo of articleCompanies) {
        if (articleCo.id === userCo.id || 
            this.isCompanyRelated(articleCo.name, userCo.name || '')) {
          // Push the USER'S entity ID, not the article's, and avoid duplicates
          if (!addedIds.has(userCo.id)) {
            matched.push(userCo.id);
            addedIds.add(userCo.id);
          }
          break;
        }
      }
    }
    
    return matched;
  }
  
  private async getMatchedHardwareIds(
    articleHardware: ArticleEntities['hardware'],
    userHardware: UserEntities['hardware']
  ): Promise<string[]> {
    const matched: string[] = [];
    const addedIds = new Set<string>();
    
    // Only return IDs that are actually in the user's tech stack
    for (const userHw of userHardware) {
      for (const articleHw of articleHardware) {
        if (articleHw.id === userHw.id || 
            this.isHardwareRelated(articleHw.name, userHw.name || '', userHw.model || '')) {
          // Push the USER'S entity ID, not the article's, and avoid duplicates
          if (!addedIds.has(userHw.id)) {
            matched.push(userHw.id);
            addedIds.add(userHw.id);
          }
          break;
        }
      }
    }
    
    return matched;
  }
  
  private async getMatchedKeywords(articleId: string, userId: string): Promise<string[]> {
    const keywords = await db.select()
      .from(userKeywords)
      .where(and(
        eq(userKeywords.userId, userId),
        eq(userKeywords.appContext, 'threat_tracker'),
        eq(userKeywords.isActive, true)
      ));
    
    const [article] = await db.select()
      .from(globalArticles)
      .where(eq(globalArticles.id, articleId))
      .limit(1);
    
    if (!article) return [];
    
    const contentLower = (article.content + ' ' + article.title).toLowerCase();
    const matched: string[] = [];
    
    for (const keyword of keywords) {
      if (keyword.term && contentLower.includes(keyword.term.toLowerCase())) {
        matched.push(keyword.term);
      }
    }
    
    return matched;
  }
  
  /**
   * Get threat actors associated with an article
   */
  private async getArticleThreatActors(articleId: string): Promise<string[]> {
    const actors = await db.select({
      name: threatActors.name
    })
    .from(articleThreatActors)
    .innerJoin(threatActors, eq(articleThreatActors.threatActorId, threatActors.id))
    .where(eq(articleThreatActors.articleId, articleId));
    
    return actors.map(a => a.name);
  }
  
  /**
   * Get CVEs associated with an article
   */
  private async getArticleCves(articleId: string): Promise<string[]> {
    const cves = await db.select({
      cveId: articleCves.cveId
    })
    .from(articleCves)
    .where(eq(articleCves.articleId, articleId));
    
    return cves.map(c => c.cveId);
  }
  
  /**
   * Get threat keywords that match article content
   */
  private async getMatchedThreatKeywords(articleId: string, userId: string): Promise<string[]> {
    const keywords = await db.select()
      .from(userKeywords)
      .where(and(
        eq(userKeywords.userId, userId),
        eq(userKeywords.appContext, 'threat_tracker'),
        eq(userKeywords.isActive, true)
        // All threat_tracker keywords are considered threat keywords
      ));
    
    const [article] = await db.select()
      .from(globalArticles)
      .where(eq(globalArticles.id, articleId))
      .limit(1);
    
    if (!article) return [];
    
    const contentLower = ((article.content || '') + ' ' + (article.title || '')).toLowerCase();
    const matched: string[] = [];
    
    for (const keyword of keywords) {
      if (keyword.term && contentLower.includes(keyword.term.toLowerCase())) {
        matched.push(keyword.term);
      }
    }
    
    return matched;
  }
  
  /**
   * Helper functions for soft matching
   */
  private isSoftwareRelated(articleName: string, userName: string): boolean {
    const articleLower = articleName.toLowerCase();
    const userLower = userName.toLowerCase();
    
    // Direct substring match
    if (articleLower.includes(userLower) || userLower.includes(articleLower)) {
      return true;
    }
    
    // Common software variations
    const normalizedArticle = articleLower.replace(/[^a-z0-9]/g, '');
    const normalizedUser = userLower.replace(/[^a-z0-9]/g, '');
    
    return normalizedArticle.includes(normalizedUser) || 
           normalizedUser.includes(normalizedArticle);
  }
  
  private isCompanyRelated(articleName: string, userName: string): boolean {
    const articleLower = articleName.toLowerCase();
    const userLower = userName.toLowerCase();
    
    // Remove common suffixes
    const cleanArticle = articleLower.replace(/\s+(inc|corp|ltd|llc|co|company|corporation)\.?$/i, '');
    const cleanUser = userLower.replace(/\s+(inc|corp|ltd|llc|co|company|corporation)\.?$/i, '');
    
    return cleanArticle === cleanUser || 
           articleLower.includes(userLower) || 
           userLower.includes(articleLower);
  }
  
  private isHardwareRelated(articleName: string, userName: string, userModel: string): boolean {
    const articleLower = articleName.toLowerCase();
    const userLower = userName.toLowerCase();
    const modelLower = userModel.toLowerCase();
    
    // Check name or model match
    return articleLower.includes(userLower) || 
           articleLower.includes(modelLower) ||
           userLower.includes(articleLower);
  }
  
  /**
   * Handle one-off score generation for old articles
   */
  async generateOneOffScore(articleId: string, userId: string): Promise<void> {
    await this.batchCalculateRelevance(userId, { articleIds: [articleId] });
  }
  
  /**
   * Trigger recalculation when tech stack changes
   */
  async onTechStackChange(userId: string): Promise<void> {
    // Delete existing scores to force recalculation
    await db.delete(articleRelevanceScores)
      .where(eq(articleRelevanceScores.userId, userId));
    
    // Recalculate scores with current tech stack
    await this.batchCalculateRelevance(userId, { forceRecalculate: true });
  }
}

// Export singleton instance
export const relevanceScorer = new RelevanceScorer();