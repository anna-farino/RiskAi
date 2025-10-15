import { db } from '../db/db';
import { globalArticles } from '../../shared/db/schema/global-tables';
import { 
  articleSoftware, 
  articleHardware, 
  articleCompanies, 
  articleCves,
  articleThreatActors 
} from '../../shared/db/schema/threat-tracker/entity-associations';
import { desc, sql } from 'drizzle-orm';
import { EntityManager } from '../services/entity-manager';
import { ThreatAnalyzer } from '../services/threat-analysis';

async function reprocessArticlesEntities() {
  console.log('='.repeat(80));
  console.log('REPROCESSING ARTICLES FOR ENTITY EXTRACTION & THREAT SEVERITY SCORING');
  console.log('='.repeat(80));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const entityManager = new EntityManager();
  const threatAnalyzer = new ThreatAnalyzer();
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let severityScoresCalculated = 0;
  let totalEntitiesExtracted = {
    software: 0,
    hardware: 0,
    companies: 0,
    cves: 0,
    threatActors: 0
  };

  try {
    // Fetch latest 100 cybersecurity articles that haven't had entities extracted
    console.log('📚 Fetching latest 100 cybersecurity articles without extracted entities...\n');
    const articles = await db
      .select()
      .from(globalArticles)
      .where(sql`${globalArticles.isCybersecurity} = true AND ${globalArticles.entitiesExtracted} = false`)
      .orderBy(desc(globalArticles.scrapedAt))
      .limit(100);

    console.log(`Found ${articles.length} cybersecurity articles to process\n`);
    
    if (articles.length === 0) {
      console.log('ℹ️  No unprocessed cybersecurity articles found. Checking for any articles to process...\n');
      const anyArticles = await db
        .select()
        .from(globalArticles)
        .where(sql`${globalArticles.entitiesExtracted} = false`)
        .orderBy(desc(globalArticles.scrapedAt))
        .limit(100);
      
      if (anyArticles.length > 0) {
        console.log(`Found ${anyArticles.length} general articles to process\n`);
        articles.push(...anyArticles);
      } else {
        console.log('✅ All articles have been processed!');
        return;
      }
    }

    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const progress = `[${i + 1}/${articles.length}]`;
      
      try {
        // Check if article already has extracted entities
        const [existingSoftware, existingHardware, existingCompanies, existingCves, existingActors] = await Promise.all([
          db.select({ count: sql<number>`count(*)` })
            .from(articleSoftware)
            .where(sql`${articleSoftware.articleId} = ${article.id}`),
          db.select({ count: sql<number>`count(*)` })
            .from(articleHardware)
            .where(sql`${articleHardware.articleId} = ${article.id}`),
          db.select({ count: sql<number>`count(*)` })
            .from(articleCompanies)
            .where(sql`${articleCompanies.articleId} = ${article.id}`),
          db.select({ count: sql<number>`count(*)` })
            .from(articleCves)
            .where(sql`${articleCves.articleId} = ${article.id}`),
          db.select({ count: sql<number>`count(*)` })
            .from(articleThreatActors)
            .where(sql`${articleThreatActors.articleId} = ${article.id}`)
        ]);

        const hasExistingEntities = 
          (existingSoftware[0]?.count ?? 0) > 0 ||
          (existingHardware[0]?.count ?? 0) > 0 ||
          (existingCompanies[0]?.count ?? 0) > 0 ||
          (existingCves[0]?.count ?? 0) > 0 ||
          (existingActors[0]?.count ?? 0) > 0;

        if (hasExistingEntities) {
          console.log(`${progress} ⏭️  Skipping "${article.title?.substring(0, 50)}..." (already has entities)`);
          skippedCount++;
          continue;
        }

        // Extract entities from article
        console.log(`${progress} 🔍 Processing: "${article.title?.substring(0, 80)}..."`);
        
        const extracted = await entityManager.extractEntitiesFromArticle(article);
        
        // Link extracted entities to article
        await entityManager.linkArticleToEntities(article.id, extracted);
        
        // Calculate threat severity score if this is a cybersecurity article
        if (article.isCybersecurity) {
          try {
            console.log(`    🎯 Calculating threat severity score...`);
            const severityAnalysis = await threatAnalyzer.calculateSeverityScore(article, extracted);
            
            // Update article with threat severity scores
            await db.update(globalArticles)
              .set({ 
                entitiesExtracted: true,
                threatSeverityScore: severityAnalysis.severityScore.toFixed(2),  // numeric(4,2) expects string like "99.99"
                threatLevel: severityAnalysis.threatLevel,
                threatMetadata: severityAnalysis.metadata
              })
              .where(sql`${globalArticles.id} = ${article.id}`);
            
            console.log(`    📊 Severity: ${severityAnalysis.severityScore.toFixed(1)}/100 (${severityAnalysis.threatLevel})`);
            severityScoresCalculated++;
          } catch (scoringError: any) {
            console.error(`    ⚠️  Failed to calculate severity score: ${scoringError.message}`);
            // Still mark entities as extracted even if scoring fails
            await db.update(globalArticles)
              .set({ entitiesExtracted: true })
              .where(sql`${globalArticles.id} = ${article.id}`);
          }
        } else {
          // Non-cybersecurity article - just mark entities as extracted
          await db.update(globalArticles)
            .set({ entitiesExtracted: true })
            .where(sql`${globalArticles.id} = ${article.id}`);
        }
        
        // Count extracted entities
        const entityCount = {
          software: extracted.software?.length || 0,
          hardware: extracted.hardware?.length || 0,
          companies: extracted.companies?.length || 0,
          cves: extracted.cves?.length || 0,
          threatActors: extracted.threatActors?.length || 0
        };
        
        const totalExtracted = Object.values(entityCount).reduce((a, b) => a + b, 0);
        
        if (totalExtracted > 0) {
          console.log(`    ✅ Extracted: ${entityCount.software} software, ${entityCount.hardware} hardware, ${entityCount.companies} companies, ${entityCount.cves} CVEs, ${entityCount.threatActors} threat actors`);
          
          // Update totals
          totalEntitiesExtracted.software += entityCount.software;
          totalEntitiesExtracted.hardware += entityCount.hardware;
          totalEntitiesExtracted.companies += entityCount.companies;
          totalEntitiesExtracted.cves += entityCount.cves;
          totalEntitiesExtracted.threatActors += entityCount.threatActors;
        } else {
          console.log(`    ⚠️  No entities found in article`);
        }
        
        processedCount++;
        
        // Rate limiting - pause every 10 articles to avoid overwhelming the API
        if (i > 0 && i % 10 === 0) {
          console.log(`\n💤 Pausing for 2 seconds (rate limiting)...\n`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (articleError: any) {
        console.error(`${progress} ❌ Error processing article ${article.id}: ${articleError.message}`);
        errorCount++;
        
        // If too many errors, stop processing
        if (errorCount > 20) {
          console.error('\n⚠️  Too many errors (>20), stopping processing');
          break;
        }
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('PROCESSING COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`  • Total articles checked: ${articles.length}`);
    console.log(`  • Articles processed: ${processedCount}`);
    console.log(`  • Articles skipped (already had entities): ${skippedCount}`);
    console.log(`  • Articles with errors: ${errorCount}`);
    console.log(`\n🎯 Threat Severity Scoring:`);
    console.log(`  • Severity scores calculated: ${severityScoresCalculated}`);
    console.log(`\n📦 Total Entities Extracted:`);
    console.log(`  • Software: ${totalEntitiesExtracted.software}`);
    console.log(`  • Hardware: ${totalEntitiesExtracted.hardware}`);
    console.log(`  • Companies: ${totalEntitiesExtracted.companies}`);
    console.log(`  • CVEs: ${totalEntitiesExtracted.cves}`);
    console.log(`  • Threat Actors: ${totalEntitiesExtracted.threatActors}`);
    console.log(`  • TOTAL: ${Object.values(totalEntitiesExtracted).reduce((a, b) => a + b, 0)}`);
    console.log(`\nCompleted at: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }
}

// Run the reprocessing
if (require.main === module) {
  console.log('Starting article reprocessing script...\n');
  
  reprocessArticlesEntities()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}