import { db } from '../db/db';
import { globalArticles } from '../../shared/db/schema/global-tables';
import { desc, sql } from 'drizzle-orm';
import { EntityManager } from '../services/entity-manager';
import { ThreatAnalyzer } from '../services/threat-analysis';

async function demoThreatScoring() {
  console.log('='.repeat(80));
  console.log('DEMO: ENTITY EXTRACTION + THREAT SEVERITY SCORING');
  console.log('='.repeat(80));
  console.log(`Processing 5 recent cybersecurity articles...\n`);

  const entityManager = new EntityManager();
  const threatAnalyzer = new ThreatAnalyzer();
  
  const severityDistribution = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  try {
    // Fetch 5 recent cybersecurity articles
    console.log('📚 Fetching 5 recent cybersecurity articles...\n');
    const articles = await db
      .select()
      .from(globalArticles)
      .where(sql`${globalArticles.isCybersecurity} = true`)
      .orderBy(desc(globalArticles.scrapedAt))
      .limit(5);

    console.log(`Found ${articles.length} articles to demonstrate\n`);
    console.log('─'.repeat(80));

    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const progress = `[${i + 1}/${articles.length}]`;
      
      try {
        console.log(`\n${progress} Article: "${article.title?.substring(0, 70)}..."`);
        console.log(`    Source: ${new URL(article.url).hostname}`);
        
        // Extract entities from article
        console.log(`    📦 Extracting entities...`);
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
            console.log(`       • ${entityCount.software} Software: ${extracted.software.slice(0, 2).map(s => s.name + (s.version ? ` v${s.version}` : '')).join(', ')}${entityCount.software > 2 ? '...' : ''}`);
          }
          if (entityCount.hardware > 0) {
            console.log(`       • ${entityCount.hardware} Hardware: ${extracted.hardware.slice(0, 2).map(h => h.name).join(', ')}${entityCount.hardware > 2 ? '...' : ''}`);
          }
          if (entityCount.companies > 0) {
            console.log(`       • ${entityCount.companies} Companies: ${extracted.companies.slice(0, 2).map(c => c.name).join(', ')}${entityCount.companies > 2 ? '...' : ''}`);
          }
          if (entityCount.cves > 0) {
            console.log(`       • ${entityCount.cves} CVEs: ${extracted.cves.slice(0, 2).map(c => c.id).join(', ')}${entityCount.cves > 2 ? '...' : ''}`);
          }
          if (entityCount.threatActors > 0) {
            console.log(`       • ${entityCount.threatActors} Threat Actors: ${extracted.threatActors.slice(0, 2).map(t => t.name).join(', ')}${entityCount.threatActors > 2 ? '...' : ''}`);
          }
        } else {
          console.log(`    ⚠️  No entities found in this article`);
        }
        
        // Calculate threat severity score
        console.log(`    🎯 Calculating threat severity...`);
        const severityAnalysis = await threatAnalyzer.calculateSeverityScore(article, extracted);
        
        console.log(`    📊 THREAT SEVERITY: ${severityAnalysis.severityScore.toFixed(1)}/100 (${severityAnalysis.threatLevel.toUpperCase()})`);
        
        // Show scoring breakdown for interesting articles
        if (severityAnalysis.severityScore > 50) {
          const components = severityAnalysis.metadata?.severity_components;
          if (components) {
            console.log(`       Scoring breakdown:`);
            console.log(`       • CVSS Severity: ${(components.cvss_severity * 10).toFixed(0)}/100`);
            console.log(`       • Exploitability: ${(components.exploitability * 10).toFixed(0)}/100`);
            console.log(`       • Impact: ${(components.impact * 10).toFixed(0)}/100`);
            console.log(`       • Attack Vector: ${(components.attack_vector * 10).toFixed(0)}/100`);
            if (components.threat_actor_use > 0) {
              console.log(`       • Threat Actor Use: ${(components.threat_actor_use * 10).toFixed(0)}/100`);
            }
          }
        }
        
        // Track distribution
        severityDistribution[severityAnalysis.threatLevel as keyof typeof severityDistribution]++;
        
      } catch (articleError: any) {
        console.error(`${progress} ❌ Error: ${articleError.message}`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('DEMO COMPLETE');
    console.log('='.repeat(80));
    
    console.log(`\n🎯 Threat Severity Distribution:`);
    console.log(`  • Critical: ${severityDistribution.critical} articles`);
    console.log(`  • High: ${severityDistribution.high} articles`);
    console.log(`  • Medium: ${severityDistribution.medium} articles`);
    console.log(`  • Low: ${severityDistribution.low} articles`);
    
    console.log(`\n💡 Key Features Demonstrated:`);
    console.log(`  ✓ Entity extraction (software, hardware, companies, CVEs, threat actors)`);
    console.log(`  ✓ Threat severity scoring (0-100 scale)`);
    console.log(`  ✓ Threat level classification (low/medium/high/critical)`);
    console.log(`  ✓ Detailed scoring breakdown for high-severity threats`);
    
    console.log(`\n📝 Notes:`);
    console.log(`  • Severity scores are user-independent (universal scoring)`);
    console.log(`  • Based on CVSS, exploitability, impact, attack vectors, etc.`);
    console.log(`  • Stored in database for efficient retrieval`);
    console.log(`  • The full reprocessing script handles 100+ articles at once`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }
}

// Run the demo
if (require.main === module) {
  console.log('Starting threat scoring demo...\n');
  
  demoThreatScoring()
    .then(() => {
      console.log('\n✅ Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error);
      process.exit(1);
    });
}