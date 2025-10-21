// Simple test script to extract entities from North Korean hackers article
import { extractArticleEntities } from './backend/services/openai';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const testUrl = 'https://thehackernews.com/2025/10/hackers-abuse-blockchain-smart.html';

async function testEntityExtraction() {
  console.log('='.repeat(80));
  console.log('TESTING ENTITY EXTRACTION');
  console.log('URL:', testUrl);
  console.log('='.repeat(80));
  
  try {
    // Fetch the article HTML
    console.log('\n📄 FETCHING ARTICLE...\n');
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('Fetched HTML length:', html.length, 'characters');
    
    // Extract text content from HTML (simple extraction)
    // Remove script and style tags
    let textContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    textContent = textContent.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    // Extract text from remaining HTML
    textContent = textContent.replace(/<[^>]+>/g, ' ');
    // Clean up whitespace
    textContent = textContent.replace(/\s+/g, ' ').trim();
    
    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';
    
    console.log('Article Title:', title);
    console.log('Text content length:', textContent.length, 'characters');
    console.log('\nFirst 500 characters of content:');
    console.log(textContent.substring(0, 500) + '...\n');
    
    // Extract entities using AI
    console.log('🤖 EXTRACTING ENTITIES WITH AI...\n');
    const extractedEntities = await extractArticleEntities({
      title: title,
      content: textContent.substring(0, 10000), // Limit content length for API
      url: testUrl
    });
    
    // Display extracted entities
    console.log('='.repeat(80));
    console.log('EXTRACTED ENTITIES');
    console.log('='.repeat(80));
    
    console.log('\n📦 SOFTWARE ENTITIES:', extractedEntities.software.length);
    if (extractedEntities.software.length > 0) {
      extractedEntities.software.forEach((sw, i) => {
        console.log(`  ${i + 1}. ${sw.name}`);
        console.log(`     Vendor: ${sw.vendor || 'Unknown'}`);
        console.log(`     Version: ${sw.version || 'N/A'}`);
        console.log(`     Confidence: ${sw.confidence}`);
      });
    } else {
      console.log('  (none found)');
    }
    
    console.log('\n🖥️ HARDWARE ENTITIES:', extractedEntities.hardware.length);
    if (extractedEntities.hardware.length > 0) {
      extractedEntities.hardware.forEach((hw, i) => {
        console.log(`  ${i + 1}. ${hw.name}`);
        console.log(`     Manufacturer: ${hw.manufacturer || 'Unknown'}`);
        console.log(`     Model: ${hw.model || 'N/A'}`);
        console.log(`     Confidence: ${hw.confidence}`);
      });
    } else {
      console.log('  (none found)');
    }
    
    console.log('\n🏢 COMPANY ENTITIES:', extractedEntities.companies.length);
    if (extractedEntities.companies.length > 0) {
      extractedEntities.companies.forEach((co, i) => {
        console.log(`  ${i + 1}. ${co.name}`);
        console.log(`     Type: ${co.type}`);
        console.log(`     Confidence: ${co.confidence}`);
      });
    } else {
      console.log('  (none found)');
    }
    
    console.log('\n🔴 CVE ENTITIES:', extractedEntities.cves.length);
    if (extractedEntities.cves.length > 0) {
      extractedEntities.cves.forEach((cve, i) => {
        console.log(`  ${i + 1}. ${cve.id}`);
        console.log(`     CVSS: ${cve.cvss || 'N/A'}`);
        console.log(`     Confidence: ${cve.confidence}`);
      });
    } else {
      console.log('  (none found)');
    }
    
    console.log('\n👥 THREAT ACTORS:', extractedEntities.threatActors.length);
    if (extractedEntities.threatActors.length > 0) {
      extractedEntities.threatActors.forEach((actor, i) => {
        console.log(`  ${i + 1}. ${actor.name}`);
        console.log(`     Type: ${actor.type}`);
        console.log(`     Aliases: ${actor.aliases?.join(', ') || 'None'}`);
        console.log(`     Confidence: ${actor.confidence}`);
      });
    } else {
      console.log('  (none found)');
    }
    
    console.log('\n⚔️ ATTACK VECTORS:', extractedEntities.attackVectors.length);
    if (extractedEntities.attackVectors.length > 0) {
      extractedEntities.attackVectors.forEach((vector, i) => {
        console.log(`  ${i + 1}. ${vector.name}`);
        console.log(`     Category: ${vector.category}`);
        console.log(`     Confidence: ${vector.confidence}`);
      });
    } else {
      console.log('  (none found)');
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
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
    console.log(`  Software: ${extractedEntities.software.length}`);
    console.log(`  Hardware: ${extractedEntities.hardware.length}`);
    console.log(`  Companies: ${extractedEntities.companies.length}`);
    console.log(`  CVEs: ${extractedEntities.cves.length}`);
    console.log(`  Threat Actors: ${extractedEntities.threatActors.length}`);
    console.log(`  Attack Vectors: ${extractedEntities.attackVectors.length}`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Run the test
testEntityExtraction();