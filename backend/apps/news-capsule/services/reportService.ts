import { CapsuleArticle } from "@shared/db/schema/news-capsule/index";
import { getAllArticles } from "../queries";

export interface ThreatReport {
  id: string;
  title: string;
  threatName: string;
  occurrences: number;
  articles: CapsuleArticle[];
  lastReported: Date;
  microsoftImpact: string;
  // Field renamed, but kept for backward compatibility
  osConnection: string; // More generic field name for OS-specific content
  businessImpacts: string[];
}

/**
 * Generate a report that groups articles by threat name
 */
export async function generateThreatReport(): Promise<ThreatReport[]> {
  // Get all articles
  try {
    const allArticles = await getAllArticles();
    
    // Log all articles
    console.log("All articles:", allArticles.map(a => ({
      title: a.title,
      forReporting: a.markedForReporting,
      forDeletion: a.markedForDeletion
    })));
    
    // Filter articles based on management flags
    // Only include articles that are marked for reporting AND not marked for deletion
    // This excludes hidden articles from appearing in reports
    const articles = allArticles.filter(article => 
      article.markedForReporting === true && article.markedForDeletion === false
    );
    
    console.log("Articles found for report generation:", articles.length);
    
    // Group articles by threat name
    const threatMap = new Map<string, CapsuleArticle[]>();
    
    articles.forEach(article => {
      // Log each article's threat name for debugging
      console.log(`Processing article: ID=${article.title}, Threat=${article.threatName}`);
      
      if (!threatMap.has(article.threatName)) {
        threatMap.set(article.threatName, []);
      }
      threatMap.get(article.threatName)?.push(article);
    });
    
    // Convert map to array of report objects
    const reports: ThreatReport[] = [];
    
    threatMap.forEach((articles, threatName) => {
      // Find most recent article
      const sortedArticles = [...articles].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Extract business impacts from all articles about this threat
      const businessImpacts = new Set<string>();
      articles.forEach(article => {
        const impacts = article.impacts.split(',').map(impact => impact.trim());
        impacts.forEach(impact => businessImpacts.add(impact));
      });
      
      // Create report - use threat name as the report title for uniqueness
      reports.push({
        id: threatName.toLowerCase().replace(/\s+/g, '-'),
        title: `${threatName} - Threat Alert`, // Use the threat name as title for uniqueness
        threatName,
        occurrences: articles.length,
        articles: sortedArticles,
        lastReported: new Date(sortedArticles[0].createdAt),
        microsoftImpact: getMicrosoftImpactSummary(articles), // Keep for backward compatibility
        osConnection: getMicrosoftImpactSummary(articles), // Same value, will be transformed on client
        businessImpacts: Array.from(businessImpacts)
      });
    });
    
    console.log(`Generated ${reports.length} threat reports`);
    
    // Sort reports by number of occurrences (descending)
    return reports.sort((a, b) => b.occurrences - a.occurrences);
  } catch(error) {
    console.error(error)
    return []
  }
}

/**
 * Generate a summary of Microsoft impacts based on multiple articles
 */
function getMicrosoftImpactSummary(articles: CapsuleArticle[]): string {
  // In a real implementation, this would use NLP to generate a coherent summary
  // For now, we'll use the most recent article's Microsoft connection
  const latestArticle = [...articles].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
  
  return latestArticle.microsoftConnection;
}
