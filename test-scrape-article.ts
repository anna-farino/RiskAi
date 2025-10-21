// Test script to scrape a specific article and extract entities
import { StreamlinedUnifiedScraper } from './backend/services/scraping/scrapers/main-scraper';
import { extractArticleEntities } from './backend/services/openai';
import { analyzeCybersecurity } from './backend/services/openai';
import { ThreatAnalyzer } from './backend/services/threat-analyzer';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const testUrl = 'https://thehackernews.com/2025/10/north-korean-hackers-combine-beavertail.html';

async function testArticleScraping() {
  console.log('='.repeat(80));
  console.log('SCRAPING ARTICLE:', testUrl);
  console.log('='.repeat(80));
  
  try {
    // Step 1: Scrape the article
    console.log('\n📄 SCRAPING ARTICLE CONTENT...\n');
    const scraper = new StreamlinedUnifiedScraper();
    const articleContent = await scraper.scrapeArticleUrl(testUrl);
    
    console.log('Title:', articleContent.title);
    console.log('Author:', articleContent.author || 'Unknown');
    console.log('Publish Date:', articleContent.publishDate || 'Unknown');
    console.log('Content Length:', articleContent.content.length, 'characters');
    console.log('\nFirst 300 characters of content:');
    console.log(articleContent.content.substring(0, 300) + '...\n');
    
    // Step 2: Check if it's a cybersecurity article
    console.log('🔍 ANALYZING CYBERSECURITY RELEVANCE...\n');
    const cybersecurityAnalysis = await analyzeCybersecurity({
      title: articleContent.title || '',
      content: articleContent.content
    });
    console.log('Is Cybersecurity Article:', cybersecurityAnalysis?.isCybersecurity ? 'YES' : 'NO');
    
    if (cybersecurityAnalysis?.isCybersecurity) {
      // Step 3: Extract entities
      console.log('\n🤖 EXTRACTING ENTITIES WITH AI...\n');
      const extractedEntities = await extractArticleEntities({
        title: articleContent.title || '',
        content: articleContent.content,
        url: testUrl
      });
      
      // Display extracted entities
      console.log('📦 SOFTWARE ENTITIES:', extractedEntities.software.length);
      extractedEntities.software.forEach((sw, i) => {
        console.log(`  ${i + 1}. ${sw.name}`);
        console.log(`     Vendor: ${sw.vendor || 'Unknown'}`);
        console.log(`     Version: ${sw.version || 'N/A'}`);
        console.log(`     Confidence: ${sw.confidence}`);
        console.log(`     Context: "${sw.context?.substring(0, 80)}..."`);
      });
      
      console.log('\n🖥️ HARDWARE ENTITIES:', extractedEntities.hardware.length);
      extractedEntities.hardware.forEach((hw, i) => {
        console.log(`  ${i + 1}. ${hw.name}`);
        console.log(`     Manufacturer: ${hw.manufacturer || 'Unknown'}`);
        console.log(`     Model: ${hw.model || 'N/A'}`);
        console.log(`     Confidence: ${hw.confidence}`);
        console.log(`     Context: "${hw.context?.substring(0, 80)}..."`);
      });
      
      console.log('\n🏢 COMPANY ENTITIES:', extractedEntities.companies.length);
      extractedEntities.companies.forEach((co, i) => {
        console.log(`  ${i + 1}. ${co.name}`);
        console.log(`     Type: ${co.type}`);
        console.log(`     Confidence: ${co.confidence}`);
        console.log(`     Context: "${co.context?.substring(0, 80)}..."`);
      });
      
      console.log('\n🔴 CVE ENTITIES:', extractedEntities.cves.length);
      extractedEntities.cves.forEach((cve, i) => {
        console.log(`  ${i + 1}. ${cve.id}`);
        console.log(`     CVSS: ${cve.cvss || 'N/A'}`);
        console.log(`     Confidence: ${cve.confidence}`);
        console.log(`     Context: "${cve.context?.substring(0, 80)}..."`);
      });
      
      console.log('\n👥 THREAT ACTORS:', extractedEntities.threatActors.length);
      extractedEntities.threatActors.forEach((actor, i) => {
        console.log(`  ${i + 1}. ${actor.name}`);
        console.log(`     Type: ${actor.type}`);
        console.log(`     Aliases: ${actor.aliases?.join(', ') || 'None'}`);
        console.log(`     Confidence: ${actor.confidence}`);
        console.log(`     Context: "${actor.context?.substring(0, 80)}..."`);
      });
      
      console.log('\n⚔️ ATTACK VECTORS:', extractedEntities.attackVectors.length);
      extractedEntities.attackVectors.forEach((vector, i) => {
        console.log(`  ${i + 1}. ${vector.name}`);
        console.log(`     Category: ${vector.category}`);
        console.log(`     Confidence: ${vector.confidence}`);
        console.log(`     Context: "${vector.context?.substring(0, 80)}..."`);
      });
      
      // Step 4: Calculate threat severity
      console.log('\n⚠️ THREAT SEVERITY ANALYSIS...\n');
      const threatAnalyzer = new ThreatAnalyzer();
      const severityResult = await threatAnalyzer.calculateSeverityScore(
        {
          title: articleContent.title || '',
          content: articleContent.content,
          metadata: {}
        },
        extractedEntities
      );
      
      console.log('Threat Severity Score:', severityResult.score);
      console.log('Threat Level:', severityResult.level);
      console.log('Factors:');
      Object.entries(severityResult.factors).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value}`);
      });
      
      // Summary
      console.log('\n' + '='.repeat(80));
      console.log('EXTRACTION SUMMARY');
      console.log('='.repeat(80));
      console.log('Total Entities Extracted:', 
        extractedEntities.software.length + 
        extractedEntities.hardware.length + 
        extractedEntities.companies.length + 
        extractedEntities.cves.length + 
        extractedEntities.threatActors.length + 
        extractedEntities.attackVectors.length
      );
      console.log('\nEntity Breakdown:');
      console.log(`  - Software: ${extractedEntities.software.length}`);
      console.log(`  - Hardware: ${extractedEntities.hardware.length}`);
      console.log(`  - Companies: ${extractedEntities.companies.length}`);
      console.log(`  - CVEs: ${extractedEntities.cves.length}`);
      console.log(`  - Threat Actors: ${extractedEntities.threatActors.length}`);
      console.log(`  - Attack Vectors: ${extractedEntities.attackVectors.length}`);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Run the test
testArticleScraping();