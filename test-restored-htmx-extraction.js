/**
 * Test script to verify the restored three-step HTMX extraction process
 * This tests the enhanced system that follows intermediate URLs to find external articles
 */

import puppeteer from 'puppeteer';
import { createPage } from './backend/services/scraping/core/browser-manager.js';
import { extractLinksFromPage } from './backend/services/scraping/extractors/link-extraction/puppeteer-link-handler.js';

async function testRestoredHTMXExtraction() {
  console.log('🔍 Testing Restored Three-Step HTMX Extraction Process');
  console.log('====================================================');
  
  let browser;
  let page;
  
  try {
    // Use our browser manager to create a properly configured page
    const browserInfo = await createPage();
    browser = browserInfo.browser;
    page = browserInfo.page;
    
    // Test with Foorilla cybersecurity page that requires the three-step process
    const testUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`\n📄 Testing URL: ${testUrl}`);
    
    const startTime = Date.now();
    
    // Navigate to the test page
    await page.goto(testUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log('✅ Successfully loaded page');
    
    // Test our restored three-step extraction process
    console.log('\n🔄 Running three-step HTMX extraction...');
    
    const extractedLinks = await extractLinksFromPage(page, testUrl, {
      aiContext: 'cybersecurity threats and security incidents',
      maxLinks: 50,
      minimumTextLength: 10
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n📊 Results:`);
    console.log(`   - Total extraction time: ${duration}ms`);
    console.log(`   - Links found: ${extractedLinks.length}`);
    console.log(`   - Sample links:`);
    
    // Show the first 10 links with their details
    extractedLinks.slice(0, 10).forEach((link, index) => {
      console.log(`     ${index + 1}. ${link.text}`);
      console.log(`        URL: ${link.href}`);
      console.log(`        Source: ${link.intermediateSource || 'direct'}`);
      console.log('');
    });
    
    // Analyze the results
    console.log(`\n🔍 Analysis:`);
    
    // Check for external URLs (should be the goal of our three-step process)
    const externalLinks = extractedLinks.filter(link => {
      try {
        const linkUrl = new URL(link.href);
        const baseUrl = new URL(testUrl);
        return linkUrl.hostname !== baseUrl.hostname;
      } catch (e) {
        return false;
      }
    });
    
    console.log(`   - External URLs found: ${externalLinks.length}/${extractedLinks.length}`);
    
    // Check for known news domains
    const knownDomains = [
      'techcrunch.com', 'reuters.com', 'bloomberg.com', 'thehackernews.com',
      'krebsonsecurity.com', 'darkreading.com', 'securityweek.com',
      'cybersecuritydive.com', 'threatpost.com', 'therecord.media',
      'bleepingcomputer.com', 'infosecurity-magazine.com'
    ];
    
    const knownDomainLinks = extractedLinks.filter(link => {
      try {
        const hostname = new URL(link.href).hostname.toLowerCase();
        return knownDomains.some(domain => hostname.includes(domain));
      } catch (e) {
        return false;
      }
    });
    
    console.log(`   - Known news domain links: ${knownDomainLinks.length}/${extractedLinks.length}`);
    
    // Check for cybersecurity-related content
    const cybersecurityKeywords = [
      'cyber', 'security', 'breach', 'hack', 'attack', 'threat', 'vulnerability',
      'malware', 'ransomware', 'phishing', 'exploit', 'zero-day', 'incident'
    ];
    
    const cybersecurityLinks = extractedLinks.filter(link => {
      const text = link.text.toLowerCase();
      const url = link.href.toLowerCase();
      return cybersecurityKeywords.some(keyword => 
        text.includes(keyword) || url.includes(keyword)
      );
    });
    
    console.log(`   - Cybersecurity-related links: ${cybersecurityLinks.length}/${extractedLinks.length}`);
    
    // Check for intermediate source tracking
    const intermediateSourceLinks = extractedLinks.filter(link => 
      link.intermediateSource && link.intermediateSource !== testUrl
    );
    
    console.log(`   - Links found via intermediate URLs: ${intermediateSourceLinks.length}/${extractedLinks.length}`);
    
    // Success criteria
    console.log(`\n✅ Test Results:`);
    
    if (extractedLinks.length >= 10) {
      console.log(`   ✅ SUCCESS: Found sufficient links (${extractedLinks.length} >= 10)`);
    } else {
      console.log(`   ❌ ISSUE: Found insufficient links (${extractedLinks.length} < 10)`);
    }
    
    if (externalLinks.length > 0) {
      console.log(`   ✅ SUCCESS: Found external URLs (${externalLinks.length} found)`);
    } else {
      console.log(`   ❌ ISSUE: No external URLs found`);
    }
    
    if (knownDomainLinks.length > 0) {
      console.log(`   ✅ SUCCESS: Found known news domain links (${knownDomainLinks.length} found)`);
    } else {
      console.log(`   ⚠️  WARNING: No known news domain links found`);
    }
    
    if (cybersecurityLinks.length > 0) {
      console.log(`   ✅ SUCCESS: Found cybersecurity-related content (${cybersecurityLinks.length} found)`);
    } else {
      console.log(`   ⚠️  WARNING: No cybersecurity-related content found`);
    }
    
    if (intermediateSourceLinks.length > 0) {
      console.log(`   ✅ SUCCESS: Three-step extraction working (${intermediateSourceLinks.length} via intermediate URLs)`);
    } else {
      console.log(`   ⚠️  INFO: No intermediate URL tracking (may be direct extraction)`);
    }
    
    // Overall assessment
    const isSuccessful = extractedLinks.length >= 10 && externalLinks.length > 0;
    
    console.log(`\n${isSuccessful ? '🎉' : '❌'} OVERALL: ${isSuccessful ? 'SUCCESS' : 'NEEDS IMPROVEMENT'}`);
    
    if (isSuccessful) {
      console.log('The restored three-step HTMX extraction process is working correctly!');
    } else {
      console.log('The extraction process needs further improvements.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testRestoredHTMXExtraction().catch(console.error);