import { db } from "backend/db/db";
import { eq, and, desc, gte, lte, count } from "drizzle-orm";
import {
  scrapingErrorLogs,
  type ScrapingErrorLog,
  type InsertScrapingErrorLog,
  type AppType,
  type ErrorType,
} from "@shared/db/schema/scraping-error-logs";

export interface IErrorLoggingStorage {
  // Create error log
  createErrorLog(errorLog: InsertScrapingErrorLog): Promise<ScrapingErrorLog>;
  
  // Get error logs with filtering
  getErrorLogs(options: {
    userId?: string;
    appType?: AppType;
    sourceId?: string;
    errorType?: ErrorType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ScrapingErrorLog[]>;
  
  // Get error logs by source
  getErrorLogsBySource(sourceId: string, userId?: string): Promise<ScrapingErrorLog[]>;
  
  // Get error log statistics
  getErrorLogStats(userId: string): Promise<{
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsByApp: Record<AppType, number>;
    recentErrors: number; // Last 24 hours
  }>;
  
  // Clear old error logs (for maintenance)
  clearOldErrorLogs(olderThan: Date): Promise<number>;
}

export class DatabaseErrorLoggingStorage implements IErrorLoggingStorage {
  async createErrorLog(errorLog: InsertScrapingErrorLog): Promise<ScrapingErrorLog> {
    const [created] = await db
      .insert(scrapingErrorLogs)
      .values({
        ...errorLog,
        timestamp: new Date(),
      } as any)
      .returning();

    return created;
  }

  async getErrorLogs(options: {
    userId?: string;
    appType?: AppType;
    sourceId?: string;
    errorType?: ErrorType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ScrapingErrorLog[]> {
    const conditions = [];

    if (options.userId) {
      conditions.push(eq(scrapingErrorLogs.userId, options.userId));
    }
    if (options.appType) {
      conditions.push(eq(scrapingErrorLogs.appType, options.appType));
    }
    if (options.sourceId) {
      conditions.push(eq(scrapingErrorLogs.sourceId, options.sourceId));
    }
    if (options.errorType) {
      conditions.push(eq(scrapingErrorLogs.errorType, options.errorType));
    }
    if (options.startDate) {
      conditions.push(gte(scrapingErrorLogs.timestamp, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(scrapingErrorLogs.timestamp, options.endDate));
    }

    // Build query with all conditions at once
    let baseQuery = db.select().from(scrapingErrorLogs);
    
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }

    baseQuery = baseQuery.orderBy(desc(scrapingErrorLogs.timestamp));

    if (options.limit) {
      baseQuery = baseQuery.limit(options.limit);
    }
    if (options.offset) {
      baseQuery = baseQuery.offset(options.offset);
    }

    return await baseQuery;
  }

  async getErrorLogsBySource(sourceId: string, userId?: string): Promise<ScrapingErrorLog[]> {
    const conditions = [eq(scrapingErrorLogs.sourceId, sourceId)];
    
    if (userId) {
      conditions.push(eq(scrapingErrorLogs.userId, userId));
    }

    return await db
      .select()
      .from(scrapingErrorLogs)
      .where(and(...conditions))
      .orderBy(desc(scrapingErrorLogs.timestamp));
  }

  async getErrorLogStats(userId: string): Promise<{
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsByApp: Record<AppType, number>;
    recentErrors: number;
  }> {
    // Get total errors for user
    const totalErrorsResult = await db
      .select({ count: count() })
      .from(scrapingErrorLogs)
      .where(eq(scrapingErrorLogs.userId, userId));

    // Get recent errors (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrorsResult = await db
      .select({ count: count() })
      .from(scrapingErrorLogs)
      .where(
        and(
          eq(scrapingErrorLogs.userId, userId),
          gte(scrapingErrorLogs.timestamp, oneDayAgo)
        )
      );

    // Get all errors for this user to calculate breakdowns
    const allErrors = await db
      .select({
        errorType: scrapingErrorLogs.errorType,
        appType: scrapingErrorLogs.appType,
      })
      .from(scrapingErrorLogs)
      .where(eq(scrapingErrorLogs.userId, userId));

    // Calculate breakdowns
    const errorsByType: Record<ErrorType, number> = {
      network: 0,
      parsing: 0,
      ai: 0,
      puppeteer: 0,
      timeout: 0,
      auth: 0,
      unknown: 0,
    };

    const errorsByApp: Record<AppType, number> = {
      'news-radar': 0,
      'threat-tracker': 0,
      'news-capsule': 0,
    };

    allErrors.forEach((error) => {
      errorsByType[error.errorType]++;
      errorsByApp[error.appType]++;
    });

    return {
      totalErrors: totalErrorsResult[0]?.count || 0,
      errorsByType,
      errorsByApp,
      recentErrors: recentErrorsResult[0]?.count || 0,
    };
  }

  async clearOldErrorLogs(olderThan: Date): Promise<number> {
    const result = await db
      .delete(scrapingErrorLogs)
      .where(lte(scrapingErrorLogs.timestamp, olderThan))
      .returning({ id: scrapingErrorLogs.id });

    return result.length;
  }
}

// Create a singleton instance for the error logging storage
export const errorLoggingStorage = new DatabaseErrorLoggingStorage();