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

async function demoEntityExtraction() {
  console.log('='.repeat(80));
  console.log('DEMO: ENTITY EXTRACTION FROM CYBERSECURITY ARTICLES');
  console.log('='.repeat(80));
  console.log(`Processing 10 articles as a demonstration...\n`);

  const entityManager = new EntityManager();
  let processedCount = 0;
  let totalEntitiesExtracted = {
    software: 0,
    hardware: 0,
    companies: 0,
    cves: 0,
    threatActors: 0
  };

  try {
    // Fetch 10 recent cybersecurity articles
    console.log('📚 Fetching 10 recent cybersecurity articles...\n');
    const articles = await db
      .select()
      .from(globalArticles)
      .where(sql`${globalArticles.isCybersecurity} = true`)
      .orderBy(desc(globalArticles.scrapedAt))
      .limit(10);

    console.log(`Found ${articles.length} articles to demonstrate\n`);
    console.log('─'.repeat(80));

    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const progress = `[${i + 1}/${articles.length}]`;
      
      try {
        console.log(`\n${progress} Article: "${article.title?.substring(0, 70)}..."`);
        console.log(`    URL: ${article.url.substring(0, 60)}...`);
        
        // Extract entities from article
        const extracted = await entityManager.extractEntitiesFromArticle(article);
        
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
          console.log(`    ✅ Extracted ${totalExtracted} entities:`);
          
          if (entityCount.software > 0) {
            console.log(`       • Software (${entityCount.software}): ${extracted.software.slice(0, 3).map(s => s.name + (s.version ? ` v${s.version}` : '')).join(', ')}${entityCount.software > 3 ? '...' : ''}`);
          }
          if (entityCount.hardware > 0) {
            console.log(`       • Hardware (${entityCount.hardware}): ${extracted.hardware.slice(0, 3).map(h => h.name).join(', ')}${entityCount.hardware > 3 ? '...' : ''}`);
          }
          if (entityCount.companies > 0) {
            console.log(`       • Companies (${entityCount.companies}): ${extracted.companies.slice(0, 3).map(c => c.name).join(', ')}${entityCount.companies > 3 ? '...' : ''}`);
          }
          if (entityCount.cves > 0) {
            console.log(`       • CVEs (${entityCount.cves}): ${extracted.cves.slice(0, 3).map(c => c.id).join(', ')}${entityCount.cves > 3 ? '...' : ''}`);
          }
          if (entityCount.threatActors > 0) {
            console.log(`       • Threat Actors (${entityCount.threatActors}): ${extracted.threatActors.slice(0, 3).map(t => t.name).join(', ')}${entityCount.threatActors > 3 ? '...' : ''}`);
          }
          
          // Update totals
          totalEntitiesExtracted.software += entityCount.software;
          totalEntitiesExtracted.hardware += entityCount.hardware;
          totalEntitiesExtracted.companies += entityCount.companies;
          totalEntitiesExtracted.cves += entityCount.cves;
          totalEntitiesExtracted.threatActors += entityCount.threatActors;
        } else {
          console.log(`    ⚠️  No entities found in this article`);
        }
        
        processedCount++;
        
      } catch (articleError: any) {
        console.error(`${progress} ❌ Error: ${articleError.message}`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('DEMO COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n📊 Summary of Entity Extraction Demo:`);
    console.log(`  • Articles processed: ${processedCount}/${articles.length}`);
    console.log(`\n📦 Total Entities Extracted:`);
    console.log(`  • Software: ${totalEntitiesExtracted.software}`);
    console.log(`  • Hardware: ${totalEntitiesExtracted.hardware}`);
    console.log(`  • Companies: ${totalEntitiesExtracted.companies}`);
    console.log(`  • CVEs: ${totalEntitiesExtracted.cves}`);
    console.log(`  • Threat Actors: ${totalEntitiesExtracted.threatActors}`);
    console.log(`  • TOTAL: ${Object.values(totalEntitiesExtracted).reduce((a, b) => a + b, 0)}`);
    
    console.log(`\n💡 Note: The full reprocessing script can handle 500+ articles`);
    console.log(`   and will mark them as processed to avoid duplication.`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }
}

// Run the demo
if (require.main === module) {
  console.log('Starting entity extraction demo...\n');
  
  demoEntityExtraction()
    .then(() => {
      console.log('\n✅ Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error);
      process.exit(1);
    });
}