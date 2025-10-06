import { db } from '../../../db/db';
import { and, eq, isNull, gte, desc, inArray, sql } from 'drizzle-orm';
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
import { software, hardware, companies } from '../../../../shared/db/schema/threat-tracker/entities';
import { entityManager } from '../../../services/entity-manager';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface UserEntities {
  software: Array<{ id: string; priority: number; version?: string }>;
  hardware: Array<{ id: string; priority: number }>;
  companies: Array<{ id: string; priority: number; relationshipType?: string }>;
  keywords: string[];
}

interface RelevanceScore {
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

// =====================================================
// RELEVANCE SCORER CLASS
// =====================================================

export class RelevanceScorer {
  private readonly MAX_BATCH_SIZE = 2000;
  private readonly MAX_AGE_DAYS = 365; // 1 year
  
  /**
   * Batch calculate and store relevance scores for new articles
   * Called when user logs in or changes technology stack
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
   * Get user's technology stack
   */
  private async getUserEntities(userId: string): Promise<UserEntities> {
    const [userSoftware, userHardware, userCompanies] = await Promise.all([
      // Get user's software
      db.select({
        id: usersSoftware.softwareId,
        priority: usersSoftware.priority,
        version: usersSoftware.version
      })
        .from(usersSoftware)
        .where(and(
          eq(usersSoftware.userId, userId),
          eq(usersSoftware.isActive, true)
        )),
      
      // Get user's hardware
      db.select({
        id: usersHardware.hardwareId,
        priority: usersHardware.priority
      })
        .from(usersHardware)
        .where(and(
          eq(usersHardware.userId, userId),
          eq(usersHardware.isActive, true)
        )),
      
      // Get user's companies
      db.select({
        id: usersCompanies.companyId,
        priority: usersCompanies.priority,
        relationshipType: usersCompanies.relationshipType
      })
        .from(usersCompanies)
        .where(and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.isActive, true)
        ))
    ]);
    
    // TODO: Get user keywords from user settings
    const keywords: string[] = [];
    
    return {
      software: userSoftware.map(s => ({ 
        id: s.id, 
        priority: s.priority || 50,
        version: s.version || undefined
      })),
      hardware: userHardware.map(h => ({ 
        id: h.id, 
        priority: h.priority || 50 
      })),
      companies: userCompanies.map(c => ({ 
        id: c.id, 
        priority: c.priority || 50,
        relationshipType: c.relationshipType || undefined
      })),
      keywords
    };
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
    const articlesWithoutScores = await db.select({
      id: globalArticles.id,
      title: globalArticles.title,
      content: globalArticles.content,
      url: globalArticles.url,
      publishedAt: globalArticles.publishDate,
      isCybersecurity: globalArticles.isCybersecurity
    })
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
    
    return articlesWithoutScores;
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
      const score = await this.calculateRelevanceScore(article.id, userId, userEntities);
      scores.push({
        articleId: article.id,
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
   */
  async calculateRelevanceScore(
    articleId: string, 
    userId: string,
    userEntities: UserEntities
  ): Promise<RelevanceScore> {
    // Get article's entities
    const [articleSoftwareList, articleHardwareList, articleCompaniesList] = await Promise.all([
      // Get article's software
      db.select({
        softwareId: articleSoftware.softwareId,
        versionFrom: articleSoftware.versionFrom,
        versionTo: articleSoftware.versionTo
      })
        .from(articleSoftware)
        .where(eq(articleSoftware.articleId, articleId)),
      
      // Get article's hardware
      db.select({
        hardwareId: articleHardware.hardwareId
      })
        .from(articleHardware)
        .where(eq(articleHardware.articleId, articleId)),
      
      // Get article's companies
      db.select({
        companyId: articleCompanies.companyId,
        mentionType: articleCompanies.mentionType
      })
        .from(articleCompanies)
        .where(eq(articleCompanies.articleId, articleId))
    ]);
    
    // Calculate software score
    let softwareScore = 0;
    const matchedSoftware: string[] = [];
    
    for (const userSw of userEntities.software) {
      const match = articleSoftwareList.find(as => as.softwareId === userSw.id);
      if (match) {
        // Check version relevance if user has specific version
        let versionMultiplier = 1;
        if (userSw.version && (match.versionFrom || match.versionTo)) {
          versionMultiplier = this.checkVersionMatch(
            userSw.version, 
            match.versionFrom || undefined, 
            match.versionTo || undefined
          );
        }
        
        const score = (userSw.priority / 100) * 30 * versionMultiplier; // Max 30 points
        softwareScore += score;
        matchedSoftware.push(userSw.id);
      }
    }
    
    // Calculate hardware score
    let hardwareScore = 0;
    const matchedHardware: string[] = [];
    
    for (const userHw of userEntities.hardware) {
      const match = articleHardwareList.find(ah => ah.hardwareId === userHw.id);
      if (match) {
        const score = (userHw.priority / 100) * 20; // Max 20 points
        hardwareScore += score;
        matchedHardware.push(userHw.id);
      }
    }
    
    // Calculate company scores (vendor/client)
    let vendorScore = 0;
    let clientScore = 0;
    const matchedCompanies: string[] = [];
    
    for (const userCo of userEntities.companies) {
      const match = articleCompaniesList.find(ac => ac.companyId === userCo.id);
      if (match) {
        const baseScore = (userCo.priority / 100) * 25; // Max 25 points per category
        
        if (userCo.relationshipType === 'vendor' && 
            (match.mentionType === 'vendor' || match.mentionType === 'affected')) {
          vendorScore += baseScore;
        } else if (userCo.relationshipType === 'client' && 
                   (match.mentionType === 'client' || match.mentionType === 'affected')) {
          clientScore += baseScore;
        } else {
          // General match
          vendorScore += baseScore * 0.5;
        }
        
        matchedCompanies.push(userCo.id);
      }
    }
    
    // Calculate keyword score
    let keywordScore = 0;
    const matchedKeywords: string[] = [];
    // TODO: Implement keyword matching when user keywords are available
    
    // Calculate total score (0-100)
    const total = Math.min(100, softwareScore + hardwareScore + vendorScore + clientScore + keywordScore);
    
    return {
      total,
      software: softwareScore,
      client: clientScore,
      vendor: vendorScore,
      hardware: hardwareScore,
      keyword: keywordScore,
      matchedSoftware,
      matchedCompanies,
      matchedHardware,
      matchedKeywords,
      metadata: {
        calculatedAt: new Date(),
        entityCounts: {
          software: articleSoftwareList.length,
          hardware: articleHardwareList.length,
          companies: articleCompaniesList.length
        }
      }
    };
  }
  
  /**
   * Check if user's version matches article's version range
   */
  private checkVersionMatch(
    userVersion: string, 
    versionFrom?: string, 
    versionTo?: string
  ): number {
    // Simple version matching - can be enhanced with semver library
    if (!versionFrom && !versionTo) return 1;
    
    if (versionFrom && versionTo) {
      // Range specified - check if user version is in range
      // TODO: Implement proper version comparison
      return 1; // Simplified for now
    }
    
    if (versionFrom === userVersion || versionTo === userVersion) {
      return 1; // Exact match
    }
    
    return 0.5; // Partial match
  }
  
  /**
   * Get relevance scores for display
   */
  async getArticleRelevanceScores(
    userId: string,
    articleIds: string[]
  ): Promise<Map<string, number>> {
    const scores = await db.select({
      articleId: articleRelevanceScores.articleId,
      relevanceScore: articleRelevanceScores.relevanceScore
    })
      .from(articleRelevanceScores)
      .where(and(
        eq(articleRelevanceScores.userId, userId),
        inArray(articleRelevanceScores.articleId, articleIds)
      ));
    
    const scoreMap = new Map<string, number>();
    scores.forEach(s => {
      scoreMap.set(s.articleId, parseFloat(s.relevanceScore || '0'));
    });
    
    return scoreMap;
  }
  
  /**
   * Trigger relevance calculation for older articles (> 1 year)
   */
  async calculateOldArticleRelevance(
    userId: string,
    articleId: string
  ): Promise<void> {
    await this.batchCalculateRelevance(userId, { articleIds: [articleId] });
  }
}

// Export singleton instance
export const relevanceScorer = new RelevanceScorer();