/**
 * Test fact extraction against 10 real articles from the database
 * 
 * This script:
 * 1. Retrieves 10 recent cybersecurity articles from global_articles
 * 2. Re-runs fact extraction with updated validation thresholds
 * 3. Compares results: baseline vs fact-based scoring
 * 4. Shows improvement metrics
 */

import { db } from '../db/db';
import { globalArticles } from '@shared/db/schema/global-tables';
import { 
  software, 
  hardware, 
  companies, 
  threatActors 
} from '@shared/db/schema/threat-tracker/entities';
import {
  articleSoftware,
  articleHardware,
  articleCompanies,
  articleThreatActors,
} from '@shared/db/schema/threat-tracker/entity-associations';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import { ThreatAnalyzer } from '../services/threat-analysis';

interface TestArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  publishDate: Date | null;
  isCybersecurity: boolean | null;
  oldExtractedFacts: any;
  oldThreatMetadata: any;
  oldSeverityScore: string | null;
  oldThreatLevel: string | null;
}

interface TestResult {
  article: TestArticle;
  newExtractedFacts: any;
  newSeverityScore: number;
  newThreatLevel: string;
  newMetadata: any;
  improvement: {
    factsExtracted: boolean;
    scoringMethod: 'fact-based' | 'baseline';
    scoreChanged: boolean;
    scoreDelta: number;
  };
}

async function getTestArticles(limit: number = 10): Promise<TestArticle[]> {
  console.log(`\n📥 Retrieving ${limit} recent cybersecurity articles from database...`);
  
  const articles = await db.select({
    id: globalArticles.id,
    title: globalArticles.title,
    content: globalArticles.content,
    url: globalArticles.url,
    publishDate: globalArticles.publishDate,
    isCybersecurity: globalArticles.isCybersecurity,
    oldExtractedFacts: globalArticles.extractedFacts,
    oldThreatMetadata: globalArticles.threatMetadata,
    oldSeverityScore: globalArticles.threatSeverityScore,
    oldThreatLevel: globalArticles.threatLevel
  })
  .from(globalArticles)
  .where(
    and(
      eq(globalArticles.isCybersecurity, true),
      isNotNull(globalArticles.content)
    )
  )
  .orderBy(desc(globalArticles.scrapedAt))
  .limit(limit);
  
  console.log(`✅ Retrieved ${articles.length} articles`);
  return articles;
}

async function getArticleEntities(articleId: string) {
  // Get all entities associated with this article
  const [softwareEntities, hardwareEntities, companyEntities, threatActorEntities] = await Promise.all([
    db.select({ entity: software })
      .from(articleSoftware)
      .innerJoin(software, eq(articleSoftware.softwareId, software.id))
      .where(eq(articleSoftware.articleId, articleId)),
    
    db.select({ entity: hardware })
      .from(articleHardware)
      .innerJoin(hardware, eq(articleHardware.hardwareId, hardware.id))
      .where(eq(articleHardware.articleId, articleId)),
    
    db.select({ entity: companies })
      .from(articleCompanies)
      .innerJoin(companies, eq(articleCompanies.companyId, companies.id))
      .where(eq(articleCompanies.articleId, articleId)),
    
    db.select({ entity: threatActors })
      .from(articleThreatActors)
      .innerJoin(threatActors, eq(articleThreatActors.threatActorId, threatActors.id))
      .where(eq(articleThreatActors.articleId, articleId))
  ]);
  
  return {
    software: softwareEntities.map(e => e.entity),
    hardware: hardwareEntities.map(e => e.entity),
    companies: companyEntities.map(e => e.entity),
    threatActors: threatActorEntities.map(e => e.entity),
    cves: [], // CVEs are extracted during analysis
    attackVectors: []
  };
}

async function runTests() {
  console.log('🧪 Testing Fact Extraction Against Real Database Articles');
  console.log('=' .repeat(80));
  
  const articles = await getTestArticles(10);
  const analyzer = new ThreatAnalyzer();
  const results: TestResult[] = [];
  
  let factsExtractedCount = 0;
  let factBasedCount = 0;
  let scoreImprovements = 0;
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`\n📝 Test ${i + 1}/${articles.length}: ${article.title}`);
    console.log('-'.repeat(80));
    
    try {
      // Get entities for this article
      const entities = await getArticleEntities(article.id);
      
      // Re-run threat analysis with updated validation
      const analysis = await analyzer.analyzeThreat(
        {
          title: article.title,
          content: article.content,
          url: article.url,
          publishDate: article.publishDate,
          attackVectors: []
        },
        entities
      );
      
      // Calculate improvement metrics
      const oldScore = article.oldSeverityScore ? parseFloat(article.oldSeverityScore) : 0;
      const scoreDelta = analysis.severityScore - oldScore;
      const factsExtracted = analysis.extractedFacts !== null && 
                            analysis.extractedFacts !== undefined &&
                            analysis.metadata.scoring_method === 'fact-based';
      
      if (factsExtracted) {
        factsExtractedCount++;
      }
      
      if (analysis.metadata.scoring_method === 'fact-based') {
        factBasedCount++;
      }
      
      if (Math.abs(scoreDelta) > 5) {
        scoreImprovements++;
      }
      
      // Display results
      console.log(`\n📊 Results:`);
      console.log(`   Old Score: ${oldScore.toFixed(2)}/100 (${article.oldThreatLevel || 'unknown'})`);
      console.log(`   New Score: ${analysis.severityScore.toFixed(2)}/100 (${analysis.threatLevel})`);
      console.log(`   Scoring Method: ${analysis.metadata.scoring_method}`);
      console.log(`   Facts Extracted: ${factsExtracted ? '✅ YES' : '❌ NO (baseline fallback)'}`);
      
      if (analysis.extractedFacts) {
        console.log(`\n🔍 Extracted Facts Summary:`);
        console.log(`   Exploitation confidence: ${(analysis.extractedFacts.exploitation.confidence * 100).toFixed(0)}%`);
        console.log(`   Impact confidence: ${(analysis.extractedFacts.impact.confidence * 100).toFixed(0)}%`);
        console.log(`   Overall confidence: ${(analysis.extractedFacts.metadata.overall_confidence * 100).toFixed(0)}%`);
        
        if (analysis.extractedFacts.metadata.warnings.length > 0) {
          console.log(`   ⚠️  Warnings: ${analysis.extractedFacts.metadata.warnings.join(', ')}`);
        }
        
        // Show key facts
        const keyFacts: string[] = [];
        if (analysis.extractedFacts.exploitation.is_zero_day) keyFacts.push('Zero-day');
        if (analysis.extractedFacts.exploitation.is_actively_exploited) keyFacts.push('Actively exploited');
        if (analysis.extractedFacts.impact.allows_remote_code_execution) keyFacts.push('RCE');
        if (analysis.extractedFacts.patch_status.patch_available === false) keyFacts.push('No patch');
        if (analysis.extractedFacts.patch_status.patch_available === true) keyFacts.push('Patched');
        
        if (keyFacts.length > 0) {
          console.log(`   Key facts: ${keyFacts.join(', ')}`);
        }
      }
      
      results.push({
        article,
        newExtractedFacts: analysis.extractedFacts,
        newSeverityScore: analysis.severityScore,
        newThreatLevel: analysis.threatLevel,
        newMetadata: analysis.metadata,
        improvement: {
          factsExtracted,
          scoringMethod: analysis.metadata.scoring_method,
          scoreChanged: Math.abs(scoreDelta) > 1,
          scoreDelta
        }
      });
      
    } catch (error) {
      console.error(`❌ Error analyzing article: ${error}`);
    }
  }
  
  // Summary statistics
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY STATISTICS');
  console.log('='.repeat(80));
  console.log(`\nTotal Articles Tested: ${articles.length}`);
  console.log(`\n📈 Fact Extraction Performance:`);
  console.log(`   Facts Successfully Extracted: ${factsExtractedCount}/${articles.length} (${((factsExtractedCount/articles.length) * 100).toFixed(1)}%)`);
  console.log(`   Fact-Based Scoring Used: ${factBasedCount}/${articles.length} (${((factBasedCount/articles.length) * 100).toFixed(1)}%)`);
  console.log(`   Baseline Fallback: ${articles.length - factBasedCount}/${articles.length} (${(((articles.length - factBasedCount)/articles.length) * 100).toFixed(1)}%)`);
  
  console.log(`\n📉 Score Changes:`);
  console.log(`   Significant Changes (>5 points): ${scoreImprovements}/${articles.length}`);
  
  // Show articles that improved
  const improved = results.filter(r => r.improvement.factsExtracted && r.improvement.scoringMethod === 'fact-based');
  if (improved.length > 0) {
    console.log(`\n✅ Articles Now Using Fact-Based Scoring (${improved.length}):`);
    improved.forEach((result, idx) => {
      console.log(`   ${idx + 1}. ${result.article.title.substring(0, 60)}...`);
      console.log(`      Score: ${result.newSeverityScore.toFixed(1)}/100 | Confidence: ${(result.newExtractedFacts.metadata.overall_confidence * 100).toFixed(0)}%`);
    });
  }
  
  // Show articles still using baseline
  const baseline = results.filter(r => r.improvement.scoringMethod === 'baseline');
  if (baseline.length > 0) {
    console.log(`\n⚠️  Articles Still Using Baseline (${baseline.length}):`);
    baseline.forEach((result, idx) => {
      console.log(`   ${idx + 1}. ${result.article.title.substring(0, 60)}...`);
      if (result.newExtractedFacts?.metadata?.warnings) {
        console.log(`      Warnings: ${result.newExtractedFacts.metadata.warnings.slice(0, 2).join(', ')}`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Testing Complete!');
  console.log('='.repeat(80) + '\n');
}

// Run the tests
runTests().catch(console.error);
