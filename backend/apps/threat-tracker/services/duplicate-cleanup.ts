/**
 * Utility functions for cleaning up duplicate articles
 */

import { storage } from "../queries/threat-tracker";
import { normalizeUrl } from "./url-utils";
import { log } from "backend/utils/log";
import { ThreatArticle } from "@shared/db/schema/threat-tracker";

interface DuplicateGroup {
  normalizedUrl: string;
  articles: ThreatArticle[];
}

/**
 * Find and remove duplicate articles for a user
 * Keeps the most recent article and removes older duplicates
 */
export async function removeDuplicatesForUser(userId: string): Promise<{
  duplicatesFound: number;
  duplicatesRemoved: number;
  errors: string[];
}> {
  log(`[ThreatTracker] Starting duplicate cleanup for user: ${userId}`, "duplicate-cleanup");
  
  const errors: string[] = [];
  let duplicatesFound = 0;
  let duplicatesRemoved = 0;

  try {
    // Get all articles for the user
    const allArticles = await storage.getArticles({ userId });
    log(`[ThreatTracker] Found ${allArticles.length} total articles for user`, "duplicate-cleanup");

    // Group articles by normalized URL
    const urlGroups = new Map<string, ThreatArticle[]>();
    
    for (const article of allArticles) {
      const normalizedUrl = normalizeUrl(article.url);
      
      if (!urlGroups.has(normalizedUrl)) {
        urlGroups.set(normalizedUrl, []);
      }
      urlGroups.get(normalizedUrl)!.push(article);
    }

    // Find groups with duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    for (const [normalizedUrl, articles] of urlGroups.entries()) {
      if (articles.length > 1) {
        duplicateGroups.push({ normalizedUrl, articles });
        duplicatesFound += articles.length - 1; // Don't count the one we'll keep
      }
    }

    log(`[ThreatTracker] Found ${duplicateGroups.length} groups with duplicates, total ${duplicatesFound} duplicates to remove`, "duplicate-cleanup");

    // Remove duplicates, keeping the most recent
    for (const group of duplicateGroups) {
      try {
        // Sort by scrape date (most recent first)
        const sortedArticles = group.articles.sort((a, b) => {
          const dateA = a.scrapeDate ? new Date(a.scrapeDate).getTime() : 0;
          const dateB = b.scrapeDate ? new Date(b.scrapeDate).getTime() : 0;
          return dateB - dateA;
        });

        // Keep the first (most recent) article, remove the rest
        const toKeep = sortedArticles[0];
        const toRemove = sortedArticles.slice(1);

        log(`[ThreatTracker] For URL ${group.normalizedUrl}: keeping article ${toKeep.id}, removing ${toRemove.length} duplicates`, "duplicate-cleanup");

        // Remove duplicates
        for (const article of toRemove) {
          await storage.deleteArticle(article.id, userId);
          duplicatesRemoved++;
          log(`[ThreatTracker] Removed duplicate article: ${article.id} - ${article.title}`, "duplicate-cleanup");
        }

      } catch (error: any) {
        const errorMsg = `Failed to remove duplicates for URL ${group.normalizedUrl}: ${error.message}`;
        log(`[ThreatTracker] ${errorMsg}`, "duplicate-cleanup-error");
        errors.push(errorMsg);
      }
    }

    log(`[ThreatTracker] Duplicate cleanup completed. Removed ${duplicatesRemoved} duplicates, ${errors.length} errors`, "duplicate-cleanup");

    return {
      duplicatesFound,
      duplicatesRemoved,
      errors
    };

  } catch (error: any) {
    const errorMsg = `Error during duplicate cleanup: ${error.message}`;
    log(`[ThreatTracker] ${errorMsg}`, "duplicate-cleanup-error");
    return {
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      errors: [errorMsg]
    };
  }
}

/**
 * Find duplicate articles without removing them (for reporting)
 */
export async function findDuplicatesForUser(userId: string): Promise<{
  duplicateGroups: Array<{
    normalizedUrl: string;
    count: number;
    titles: string[];
    urls: string[];
  }>;
  totalDuplicates: number;
}> {
  try {
    const allArticles = await storage.getArticles({ userId });
    
    // Group articles by normalized URL
    const urlGroups = new Map<string, ThreatArticle[]>();
    
    for (const article of allArticles) {
      const normalizedUrl = normalizeUrl(article.url);
      
      if (!urlGroups.has(normalizedUrl)) {
        urlGroups.set(normalizedUrl, []);
      }
      urlGroups.get(normalizedUrl)!.push(article);
    }

    // Find groups with duplicates
    const duplicateGroups = [];
    let totalDuplicates = 0;
    
    for (const [normalizedUrl, articles] of urlGroups.entries()) {
      if (articles.length > 1) {
        duplicateGroups.push({
          normalizedUrl,
          count: articles.length,
          titles: articles.map(a => a.title),
          urls: articles.map(a => a.url)
        });
        totalDuplicates += articles.length - 1; // Don't count the one we'd keep
      }
    }

    return {
      duplicateGroups,
      totalDuplicates
    };

  } catch (error: any) {
    log(`[ThreatTracker] Error finding duplicates: ${error.message}`, "duplicate-cleanup-error");
    return {
      duplicateGroups: [],
      totalDuplicates: 0
    };
  }
}