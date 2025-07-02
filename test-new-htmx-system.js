/**
 * Test the new advanced HTMX extraction system with Foorilla
 */

import puppeteer from 'puppeteer';

// Mock the log function for testing
function log(message, type = "info") {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// Import the new HTMX extractor functions
import('./backend/services/scraping/extractors/htmx-extractor.js').then(async ({ extractLinksWithHTMX, detectHTMXElements, extractExternalLinksFromContent }) => {
  
  console.log('=== TESTING NEW HTMX EXTRACTION SYSTEM ===\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote'
    ]
  });

  const page = await browser.newPage();
  
  try {
    // Test URL: Foorilla cybersecurity page
    const testUrl = 'https://foorilla.com/media/cybersecurity/';
    
    console.log(`1. Navigating to: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Test 1: Basic HTMX detection
    console.log('\n2. Testing HTMX element detection...');
    const htmxElements = await detectHTMXElements(page);
    console.log(`Found ${htmxElements.length} HTMX elements`);
    
    // Show top 10 elements by priority
    console.log('\nTop 10 HTMX elements by priority:');
    htmxElements.slice(0, 10).forEach((el, i) => {
      console.log(`${i + 1}. ${el.elementType} (priority: ${el.priority}) - ${el.hxGet}`);
      console.log(`   Target: ${el.hxTarget}, Trigger: ${el.hxTrigger}`);
    });
    
    // Test 2: Basic external link extraction (before HTMX processing)
    console.log('\n3. Testing initial external link extraction...');
    const initialLinks = await extractExternalLinksFromContent(page, testUrl);
    console.log(`Found ${initialLinks.length} initial external links`);
    
    if (initialLinks.length > 0) {
      console.log('First 3 initial external links:');
      initialLinks.slice(0, 3).forEach((link, i) => {
        console.log(`${i + 1}. ${link}`);
      });
    }
    
    // Test 3: Advanced multi-level HTMX extraction
    console.log('\n4. Testing advanced multi-level HTMX extraction...');
    const startTime = Date.now();
    
    const htmxLinks = await extractLinksWithHTMX(page, testUrl, {
      maxElements: 20, // Limit for testing
      maxWaitTime: 2000, // Shorter wait for testing
      useMultiLevel: true
    });
    
    const endTime = Date.now();
    const extractionTime = (endTime - startTime) / 1000;
    
    console.log(`Advanced HTMX extraction completed in ${extractionTime}s`);
    console.log(`Found ${htmxLinks.length} external article links`);
    
    if (htmxLinks.length > 0) {
      console.log('\nFirst 10 external article links found:');
      htmxLinks.slice(0, 10).forEach((link, i) => {
        console.log(`${i + 1}. ${link}`);
      });
      
      // Analyze domains
      const domains = {};
      htmxLinks.forEach(link => {
        try {
          const domain = new URL(link).hostname;
          domains[domain] = (domains[domain] || 0) + 1;
        } catch (e) {
          // Skip invalid URLs
        }
      });
      
      console.log('\nArticle sources by domain:');
      Object.entries(domains).forEach(([domain, count]) => {
        console.log(`  ${domain}: ${count} articles`);
      });
    }
    
    // Test 4: Compare with simple extraction
    console.log('\n5. Testing simple extraction for comparison...');
    const simpleLinks = await extractLinksWithHTMX(page, testUrl, {
      maxElements: 20,
      maxWaitTime: 2000,
      useMultiLevel: false // Simple extraction
    });
    
    console.log(`Simple extraction found ${simpleLinks.length} links`);
    
    // Final comparison
    console.log('\n=== EXTRACTION COMPARISON ===');
    console.log(`Initial external links: ${initialLinks.length}`);
    console.log(`Simple HTMX extraction: ${simpleLinks.length}`);
    console.log(`Advanced multi-level extraction: ${htmxLinks.length}`);
    console.log(`Improvement factor: ${htmxLinks.length / Math.max(initialLinks.length, 1)}x`);
    
    if (htmxLinks.length > 20) {
      console.log('✅ SUCCESS: Advanced HTMX extraction found substantial article links');
    } else if (htmxLinks.length > initialLinks.length) {
      console.log('✅ PARTIAL SUCCESS: Improvement over initial extraction');
    } else {
      console.log('❌ NEEDS IMPROVEMENT: No significant improvement detected');
    }
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await browser.close();
  }
  
}).catch(error => {
  console.error('Failed to import HTMX extractor:', error);
  process.exit(1);
});