#!/usr/bin/env tsx
/**
 * Script to analyze existing articles and extract threat metadata
 * Run this to process articles that were scraped without threat analysis
 */

import { db } from '../../../db/db';
import { globalArticles } from '../../../../shared/db/schema/global-tables';
import { eq, isNull, or } from 'drizzle-orm';
import { ThreatAnalyzer } from '../../../services/threat-analysis';
import { EntityManager } from '../../../services/entity-manager';
import { extractArticleEntities, analyzeCybersecurity } from '../../../services/openai';
import { log } from '../../../utils/log';

async function analyzeExistingArticles() {
  try {
    console.log('🔄 Starting threat metadata extraction for existing articles...');
    
    // Find articles that haven't been analyzed yet
    const unanalyzedArticles = await db.select()
      .from(globalArticles)
      .where(
        or(
          isNull(globalArticles.threatMetadata),
          isNull(globalArticles.threatSeverityScore),
          eq(globalArticles.entitiesExtracted, false)
        )
      )
      .limit(20); // Process in smaller batches for testing
    
    console.log(`📊 Found ${unanalyzedArticles.length} articles to analyze`);
    
    if (unanalyzedArticles.length === 0) {
      console.log('✅ All articles have been analyzed!');
      return;
    }
    
    const threatAnalyzer = new ThreatAnalyzer();
    const entityManager = new EntityManager();
    
    let processed = 0;
    let cybersecurityCount = 0;
    let errors = 0;
    
    for (const article of unanalyzedArticles) {
      try {
        console.log(`\n⏳ Processing article: ${article.title?.substring(0, 60)}...`);
        
        // First check if it's cybersecurity related
        const cyberAnalysis = await analyzeCybersecurity({
          title: article.title || '',
          content: article.content || '',
          url: article.url || ''
        });
        
        if (cyberAnalysis.isCybersecurity) {
          cybersecurityCount++;
          console.log(`  ✓ Cybersecurity article (confidence: ${cyberAnalysis.confidence})`);
          
          // Extract entities
          console.log('  📦 Extracting entities...');
          const entities = await extractArticleEntities({
            title: article.title || '',
            content: article.content || '',
            url: article.url || ''
          });
          
          console.log(`  ✓ Found: ${entities.software.length} software, ${entities.hardware.length} hardware, ` +
                     `${entities.companies.length} companies, ${entities.cves.length} CVEs, ` +
                     `${entities.threatActors.length} threat actors`);
          
          // Link entities to article
          await entityManager.linkArticleToEntities(article.id, entities);
          
          // Calculate severity score
          console.log('  📊 Calculating threat severity...');
          const severityAnalysis = await threatAnalyzer.calculateSeverityScore(article, entities);
          
          // Update article with threat metadata
          await db.update(globalArticles)
            .set({
              threatMetadata: severityAnalysis.metadata,
              threatSeverityScore: severityAnalysis.severityScore.toString(),
              threatLevel: severityAnalysis.threatLevel,
              entitiesExtracted: true,
              lastThreatAnalysis: new Date(),
              threatAnalysisVersion: '2.0',
              securityScore: Math.round(severityAnalysis.severityScore * 10), // Backward compatibility
            })
            .where(eq(globalArticles.id, article.id));
          
          console.log(`  ✅ Severity: ${severityAnalysis.severityScore.toFixed(2)} (${severityAnalysis.threatLevel})`);
        } else {
          console.log(`  ⚠️ Not cybersecurity related (confidence: ${cyberAnalysis.confidence})`);
          
          // Mark as analyzed but with no threat data
          await db.update(globalArticles)
            .set({
              entitiesExtracted: true,
              lastThreatAnalysis: new Date(),
              threatAnalysisVersion: '2.0',
              threatSeverityScore: '0',
              threatLevel: 'low',
            })
            .where(eq(globalArticles.id, article.id));
        }
        
        processed++;
        
      } catch (error: any) {
        errors++;
        console.error(`  ❌ Error processing article ${article.id}:`, error.message);
        continue;
      }
    }
    
    console.log('\n📈 Analysis Complete:');
    console.log(`  - Total processed: ${processed}`);
    console.log(`  - Cybersecurity articles: ${cybersecurityCount}`);
    console.log(`  - Errors: ${errors}`);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
analyzeExistingArticles()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });