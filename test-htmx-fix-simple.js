/**
 * Simple test to verify the restored three-step HTMX extraction process
 * Tests via the unified scraper to verify it's working end-to-end
 */

import { streamlinedScraper } from './backend/services/scraping/unified-scraper-v2.js';

async function testHTMXFixSimple() {
  console.log('🔍 Testing Restored HTMX Three-Step Extraction');
  console.log('==============================================');
  
  try {
    // Test with Foorilla cybersecurity page
    const testUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`\n📄 Testing URL: ${testUrl}`);
    
    const startTime = Date.now();
    
    // Use the unified scraper which should now use our restored three-step process
    const results = await streamlinedScraper.scrapeSourceUrl(testUrl, {
      aiContext: 'cybersecurity threats and security incidents',
      maxLinks: 30
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n📊 Results:`);
    console.log(`   - Total extraction time: ${duration}ms`);
    console.log(`   - Links found: ${results.length}`);
    
    if (results.length > 0) {
      console.log(`\n📋 Sample links found:`);
      results.slice(0, 8).forEach((link, index) => {
        try {
          const linkUrl = new URL(link);
          const isExternal = linkUrl.hostname !== 'foorilla.com';
          console.log(`   ${index + 1}. ${isExternal ? '🔗' : '📄'} ${link}`);
        } catch (e) {
          console.log(`   ${index + 1}. ❓ ${link}`);
        }
      });
    }
    
    // Analyze results
    console.log(`\n🔍 Analysis:`);
    
    // Count external URLs
    const externalLinks = results.filter(link => {
      try {
        const linkUrl = new URL(link);
        return linkUrl.hostname !== 'foorilla.com';
      } catch (e) {
        return false;
      }
    });
    
    console.log(`   - External URLs: ${externalLinks.length}/${results.length}`);
    
    // Check for known cybersecurity domains
    const cybersecurityDomains = [
      'thehackernews.com', 'krebsonsecurity.com', 'darkreading.com', 
      'securityweek.com', 'threatpost.com', 'therecord.media',
      'bleepingcomputer.com', 'cybersecuritydive.com'
    ];
    
    const cybersecurityLinks = results.filter(link => {
      try {
        const hostname = new URL(link).hostname.toLowerCase();
        return cybersecurityDomains.some(domain => hostname.includes(domain));
      } catch (e) {
        return false;
      }
    });
    
    console.log(`   - Cybersecurity domain links: ${cybersecurityLinks.length}/${results.length}`);
    
    // Success criteria
    console.log(`\n✅ Test Results:`);
    
    const hasEnoughLinks = results.length >= 5;
    const hasExternalLinks = externalLinks.length > 0;
    const hasCybersecurityLinks = cybersecurityLinks.length > 0;
    
    if (hasEnoughLinks) {
      console.log(`   ✅ Sufficient links found (${results.length} >= 5)`);
    } else {
      console.log(`   ❌ Insufficient links found (${results.length} < 5)`);
    }
    
    if (hasExternalLinks) {
      console.log(`   ✅ External links found (${externalLinks.length} external URLs)`);
    } else {
      console.log(`   ❌ No external links found`);
    }
    
    if (hasCybersecurityLinks) {
      console.log(`   ✅ Cybersecurity content found (${cybersecurityLinks.length} relevant links)`);
    } else {
      console.log(`   ⚠️  No cybersecurity domain links found`);
    }
    
    // Overall assessment
    const isSuccessful = hasEnoughLinks && hasExternalLinks;
    
    console.log(`\n${isSuccessful ? '🎉' : '❌'} OVERALL: ${isSuccessful ? 'SUCCESS' : 'NEEDS IMPROVEMENT'}`);
    
    if (isSuccessful) {
      console.log('The three-step HTMX extraction process appears to be working!');
      console.log('We are now finding external article URLs instead of just internal navigation.');
    } else {
      console.log('The extraction process may need further refinements.');
    }
    
    // Compare with expected behavior
    if (results.length > 50) {
      console.log('\n📈 This is much better than the previous 0 external URLs!');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testHTMXFixSimple().catch(console.error);