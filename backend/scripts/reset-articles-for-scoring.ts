import { db } from '../db/db';
import { globalArticles } from '../../shared/db/schema/global-tables';
import { sql } from 'drizzle-orm';

async function resetArticlesForScoring() {
  console.log('='.repeat(80));
  console.log('RESETTING ARTICLES FOR THREAT SEVERITY SCORING');
  console.log('='.repeat(80));
  console.log(`\nThis will reset the entitiesExtracted flag for articles that don't have threat scores.\n`);

  try {
    // Count articles with entities extracted but no threat scores
    const articlesWithoutScores = await db
      .select({ count: sql<number>`count(*)` })
      .from(globalArticles)
      .where(sql`${globalArticles.entitiesExtracted} = true 
        AND ${globalArticles.isCybersecurity} = true 
        AND ${globalArticles.threatSeverityScore} IS NULL`);

    const count = articlesWithoutScores[0]?.count || 0;
    console.log(`📊 Found ${count} cybersecurity articles with entities extracted but no threat scores`);

    if (count > 0) {
      // Reset these articles so they can be reprocessed
      const result = await db
        .update(globalArticles)
        .set({ entitiesExtracted: false })
        .where(sql`${globalArticles.entitiesExtracted} = true 
          AND ${globalArticles.isCybersecurity} = true 
          AND ${globalArticles.threatSeverityScore} IS NULL`);
      
      console.log(`✅ Reset ${count} articles for reprocessing`);
      console.log(`\n💡 Now run the reprocess-articles-entities.ts script to extract entities AND calculate scores`);
    } else {
      console.log(`\n✅ All cybersecurity articles with extracted entities have threat scores!`);
      
      // Check for articles that need processing
      const articlesToProcess = await db
        .select({ count: sql<number>`count(*)` })
        .from(globalArticles)
        .where(sql`${globalArticles.entitiesExtracted} = false 
          AND ${globalArticles.isCybersecurity} = true`);
      
      const toProcessCount = articlesToProcess[0]?.count || 0;
      if (toProcessCount > 0) {
        console.log(`\n📦 There are ${toProcessCount} cybersecurity articles that need entity extraction and scoring`);
      }
    }

    // Show current status
    console.log('\n' + '='.repeat(80));
    console.log('CURRENT DATABASE STATUS');
    console.log('='.repeat(80));
    
    const stats = await db
      .select({
        total_cyber: sql<number>`count(*) filter (where ${globalArticles.isCybersecurity} = true)`,
        entities_extracted: sql<number>`count(*) filter (where ${globalArticles.entitiesExtracted} = true and ${globalArticles.isCybersecurity} = true)`,
        has_scores: sql<number>`count(*) filter (where ${globalArticles.threatSeverityScore} IS NOT NULL)`,
        critical: sql<number>`count(*) filter (where ${globalArticles.threatLevel} = 'critical')`,
        high: sql<number>`count(*) filter (where ${globalArticles.threatLevel} = 'high')`,
        medium: sql<number>`count(*) filter (where ${globalArticles.threatLevel} = 'medium')`,
        low: sql<number>`count(*) filter (where ${globalArticles.threatLevel} = 'low')`
      })
      .from(globalArticles);

    const stat = stats[0];
    console.log(`\n📊 Cybersecurity Articles:`);
    console.log(`  • Total: ${stat.total_cyber}`);
    console.log(`  • With entities extracted: ${stat.entities_extracted}`);
    console.log(`  • With threat scores: ${stat.has_scores}`);
    
    if (stat.has_scores > 0) {
      console.log(`\n🎯 Threat Level Distribution:`);
      console.log(`  • Critical: ${stat.critical} articles`);
      console.log(`  • High: ${stat.high} articles`);
      console.log(`  • Medium: ${stat.medium} articles`);
      console.log(`  • Low: ${stat.low} articles`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// Run the reset
if (require.main === module) {
  console.log('Starting article reset script...\n');
  
  resetArticlesForScoring()
    .then(() => {
      console.log('\n✅ Reset completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}