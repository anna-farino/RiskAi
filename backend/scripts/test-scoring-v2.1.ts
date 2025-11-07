/**
 * Test scoring changes (v2.1) on two specific articles
 */

import { db } from '../db/db';
import { globalArticles } from '../../shared/db/schema/global-tables';
import { 
  software, 
  hardware, 
  companies, 
  threatActors 
} from '../../shared/db/schema/threat-tracker/entities';
import {
  articleSoftware,
  articleHardware,
  articleCompanies,
  articleThreatActors,
} from '../../shared/db/schema/threat-tracker/entity-associations';
import { eq, inArray } from 'drizzle-orm';
import { ThreatAnalyzer } from '../services/threat-analysis';

const TEST_ARTICLE_IDS = [
  '172ea404-40eb-4592-94a7-4ad8f47e9cbe', // AI-Slop
  '96b69b8e-b96c-466c-b3b4-ee18ad46cb24'  // ClickFix
];

async function testScoringChanges() {
  console.log('\n🧪 Testing Scoring Changes (v2.0 → v2.1)\n');
  console.log('='.repeat(80));
  
  // Fetch articles
  const articles = await db.select()
    .from(globalArticles)
    .where(inArray(globalArticles.id, TEST_ARTICLE_IDS));
  
  if (articles.length === 0) {
    console.log('❌ No articles found');
    process.exit(1);
  }
  
  const analyzer = new ThreatAnalyzer();
  
  for (const article of articles) {
    console.log(`\n📄 Article: ${article.title?.substring(0, 60)}...`);
    console.log('-'.repeat(80));
    
    // Fetch entities
    const [softwareEntities, hardwareEntities, companyEntities, threatActorEntities] = await Promise.all([
      db.select({ software: software })
        .from(articleSoftware)
        .innerJoin(software, eq(articleSoftware.softwareId, software.id))
        .where(eq(articleSoftware.articleId, article.id)),
      db.select({ hardware: hardware })
        .from(articleHardware)
        .innerJoin(hardware, eq(articleHardware.hardwareId, hardware.id))
        .where(eq(articleHardware.articleId, article.id)),
      db.select({ company: companies })
        .from(articleCompanies)
        .innerJoin(companies, eq(articleCompanies.companyId, companies.id))
        .where(eq(articleCompanies.articleId, article.id)),
      db.select({ actor: threatActors })
        .from(articleThreatActors)
        .innerJoin(threatActors, eq(articleThreatActors.threatActorId, threatActors.id))
        .where(eq(articleThreatActors.articleId, article.id))
    ]);
    
    const entities = {
      software: softwareEntities.map(e => ({
        name: e.software.name || '',
        confidence: 0.8,
        specificity: 'specific' as const,
        context: ''
      })),
      hardware: hardwareEntities.map(e => ({
        name: e.hardware.name || '',
        confidence: 0.8,
        specificity: 'specific' as const,
        context: ''
      })),
      companies: companyEntities.map(e => ({
        name: e.company.name || '',
        type: 'mentioned' as const,
        confidence: 0.8,
        specificity: 'specific' as const,
        context: ''
      })),
      cves: [],
      threatActors: threatActorEntities.map(e => ({
        name: e.actor.name,
        confidence: 0.8,
        context: ''
      })),
      attackVectors: article.attackVectors || []
    };
    
    // Re-calculate with new logic
    const result = await analyzer.calculateSeverityScore(article as any, entities);
    
    console.log('\n📊 OLD SCORING (v2.0):');
    console.log(`   Score: ${article.threatSeverityScore}/100`);
    console.log(`   Level: ${article.threatLevel}`);
    const oldMeta = article.threatMetadata as any;
    if (oldMeta) {
      console.log(`   Flags: ${oldMeta.confidence_flags?.join(', ') || 'none'}`);
      console.log(`   Penalty: ${(oldMeta.confidence_penalty * 100).toFixed(0)}%`);
    }
    
    console.log('\n📊 NEW SCORING (v2.1):');
    console.log(`   Score: ${result.severityScore}/100`);
    console.log(`   Level: ${result.threatLevel}`);
    console.log(`   Flags: ${result.metadata.confidence_flags.join(', ') || 'none'}`);
    console.log(`   Penalty: ${(result.metadata.confidence_penalty * 100).toFixed(0)}%`);
    console.log(`   CVE Bonus: ${result.metadata.bonuses.cve_bonus > 0 ? '+10%' : 'none'}`);
    console.log(`   Actor Bonus: ${result.metadata.bonuses.threat_actor_bonus > 0 ? '+10%' : 'none'}`);
    
    console.log('\n🔍 ENTITY DETECTION:');
    console.log(`   Software: ${entities.software.length} (${entities.software.map(s => s.name).join(', ') || 'none'})`);
    console.log(`   Hardware: ${entities.hardware.length}`);
    console.log(`   Companies: ${entities.companies.length} (${entities.companies.map(c => c.name).join(', ') || 'none'})`);
    console.log(`   Attack Vectors: ${entities.attackVectors.length} (${entities.attackVectors.join(', ') || 'none'})`);
    console.log(`   CVEs: ${entities.cves.length}`);
    console.log(`   Threat Actors: ${entities.threatActors.length}`);
    
    const improvement = result.severityScore - parseFloat(article.threatSeverityScore || '0');
    console.log(`\n${improvement > 0 ? '📈' : '📉'} CHANGE: ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)} points`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test Complete!\n');
  process.exit(0);
}

testScoringChanges().catch(console.error);
