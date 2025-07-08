import { log } from "backend/utils/log";
import { ScrapingConfig } from '../structure-detector';
import { extractPublishDate } from 'backend/apps/threat-tracker/services/date-extractor';

/**
 * Extract publish date using enhanced date extraction
 * Integrates Threat Tracker's comprehensive date extraction
 */
export async function extractPublishDateEnhanced(html: string, config?: ScrapingConfig): Promise<Date | null> {
  try {
    log(`[ContentExtractor] Extracting publish date`, "scraper");
    
    // Convert ScrapingConfig to the format expected by extractPublishDate
    const htmlStructure = config ? {
      date: config.dateSelector,
      dateAlternatives: []
    } : undefined;
    
    // Use Threat Tracker's enhanced date extraction with AI-detected selectors
    const publishDate = await extractPublishDate(html, htmlStructure);
    
    if (publishDate) {
      log(`[ContentExtractor] Successfully extracted publish date: ${publishDate.toISOString()}`, "scraper");
      return publishDate;
    } else {
      log(`[ContentExtractor] Could not extract publish date, will use null`, "scraper");
      return null;
    }
  } catch (error: any) {
    log(`[ContentExtractor] Error extracting publish date: ${error.message}`, "scraper-error");
    return null;
  }
}