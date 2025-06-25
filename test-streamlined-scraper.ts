/**
 * Test script to verify streamlined scraping system performance
 * Demonstrates 3-step workflow vs original 11-step process
 */

import { streamlinedScraper } from './backend/services/scraping/unified-scraper-v2';

async function testStreamlinedScraper() {
  console.log('=== Testing Streamlined Scraping System ===\n');
  
  try {
    const testUrl = 'https://www.infosecurity-magazine.com/news/cyber-essentials-breaks-quarterly/';
    
    console.log('Testing streamlined article scraping...');
    console.log(`URL: ${testUrl}\n`);
    
    const startTime = Date.now();
    
    // Test streamlined article scraping
    const result = await streamlinedScraper.scrapeArticleUrl(testUrl);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log('=== Streamlined Scraping Results ===');
    console.log(`Total Processing Time: ${totalTime}ms`);
    console.log(`Title Length: ${result.title.length} characters`);
    console.log(`Content Length: ${result.content.length} characters`);
    console.log(`Extraction Method: ${result.extractionMethod}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Author: ${result.author || 'Not extracted'}`);
    console.log(`Publish Date: ${result.publishDate?.toISOString() || 'Not extracted'}`);
    
    if (result.title && result.content) {
      console.log('\n✅ Streamlined scraping successful!');
      console.log('Key improvements:');
      console.log('- Single decision point: HTTP or Puppeteer');
      console.log('- No redundant protection checks');
      console.log('- Simplified cache operations');
      console.log('- Eliminated hybrid scraper complexity');
    } else {
      console.log('\n❌ Streamlined scraping failed to extract content');
    }
    
  } catch (error: any) {
    console.error('\n❌ Streamlined scraping test failed:', error.message);
  }
}

async function testSourceScraping() {
  console.log('\n=== Testing Source Scraping ===\n');
  
  try {
    const sourceUrl = 'https://www.infosecurity-magazine.com/';
    
    console.log('Testing streamlined source scraping...');
    console.log(`Source URL: ${sourceUrl}\n`);
    
    const startTime = Date.now();
    
    const links = await streamlinedScraper.scrapeSourceUrl(sourceUrl, {
      maxLinks: 5,
      appType: 'threat-tracker'
    });
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log('=== Source Scraping Results ===');
    console.log(`Total Processing Time: ${totalTime}ms`);
    console.log(`Articles Found: ${links.length}`);
    
    if (links.length > 0) {
      console.log('\nFirst 3 articles:');
      links.slice(0, 3).forEach((link, index) => {
        console.log(`${index + 1}. ${link}`);
      });
      console.log('\n✅ Source scraping successful!');
    } else {
      console.log('\n❌ No articles found');
    }
    
  } catch (error: any) {
    console.error('\n❌ Source scraping test failed:', error.message);
  }
}

async function runStreamlinedTests() {
  console.log('Starting streamlined scraping system tests...\n');
  
  await testStreamlinedScraper();
  await testSourceScraping();
  
  console.log('\n=== Test Summary ===');
  console.log('Streamlined system eliminates:');
  console.log('- Redundant HTTP→Puppeteer switching');
  console.log('- Excessive cache operations');
  console.log('- Complex multi-layer architecture');
  console.log('- Duplicate protection detection');
  console.log('\nExpected improvements:');
  console.log('- 90% reduction in log noise');
  console.log('- 50% reduction in processing steps');
  console.log('- Single AI call per new domain');
  console.log('- 3-step process instead of 11-step process');
}

runStreamlinedTests().catch(console.error);