/**
 * Debug script to examine Google News HTML content and identify redirect mechanism
 */

import { scrapeWithHTTP } from './backend/services/scraping/scrapers/http-scraper';

async function debugGoogleNewsContent() {
  console.log('🔍 Debugging Google News HTML Content\n');
  
  const googleNewsUrl = 'https://news.google.com/read/CBMi0gFBVV85cUxNaGhXRXN1VkRiWU5lV3FYc0NuWmMzelBJb0g0OF9RQ2dqOEFaRkdVSnNFTV9TemFYMF9yR0g1eWZXZVlvRUM3S2o3RDdoVENoX2NQNk0wT081Xy0zckxoMTc1Zk02WWhDd0RZeVhLQjhWSkhhR2NGcjNrZ3FUcVd0S19VMmpLUmRIT1FaVTBfNWNBRTFyLXhRR3Z5SGZVUElnWU1uc2M0dWtfbG16TVg0ZGE2eGdoSndMNFh0akZsYWN1aDk5NWNyOG9FdEp2QXZNTlE?hl=en-US&gl=US&ceid=US%3Aen';
  
  try {
    const result = await scrapeWithHTTP(googleNewsUrl, { timeout: 10000 });
    
    console.log('📋 Basic Info:');
    console.log(`Status Code: ${result.statusCode}`);
    console.log(`Content Length: ${result.html.length}`);
    console.log(`Final URL: ${result.finalUrl}`);
    console.log(`Has Redirects: ${result.redirectInfo?.hasRedirects || false}`);
    
    console.log('\n🔍 Searching for redirect patterns in HTML...');
    
    // Search for various redirect patterns
    const redirectPatterns = [
      { name: 'window.location.href', pattern: /window\.location\.href\s*=\s*["']([^"']+)["']/gi },
      { name: 'window.location.replace', pattern: /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/gi },
      { name: 'window.location assignment', pattern: /window\.location\s*=\s*["']([^"']+)["']/gi },
      { name: 'location.href', pattern: /location\.href\s*=\s*["']([^"']+)["']/gi },
      { name: 'document.location', pattern: /document\.location\s*=\s*["']([^"']+)["']/gi },
      { name: 'url: pattern', pattern: /url\s*:\s*["']([^"']+)["']/gi },
      { name: 'meta refresh', pattern: /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);\s*url=([^"']+)["']/gi },
      { name: 'JavaScript redirect (generic)', pattern: /(?:location|href).*?=.*?["']([^"']*https?:\/\/[^"']+)["']/gi },
      { name: 'Google News redirect', pattern: /(?:url|href|location).*?["']([^"']*https?:\/\/[^"']*\/[^"']+)["']/gi }
    ];
    
    let foundRedirects = false;
    
    for (const { name, pattern } of redirectPatterns) {
      const matches = [...result.html.matchAll(pattern)];
      if (matches.length > 0) {
        console.log(`\n✅ Found ${name} patterns:`);
        matches.slice(0, 3).forEach((match, i) => {
          console.log(`  ${i + 1}. ${match[1] || match[2] || match[0]}`);
        });
        if (matches.length > 3) {
          console.log(`  ... and ${matches.length - 3} more`);
        }
        foundRedirects = true;
      }
    }
    
    if (!foundRedirects) {
      console.log('❌ No redirect patterns found in HTML');
    }
    
    console.log('\n🔍 Searching for script tags...');
    const scriptMatches = [...result.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    console.log(`Found ${scriptMatches.length} script tags`);
    
    if (scriptMatches.length > 0) {
      console.log('\n📝 Script content preview:');
      scriptMatches.slice(0, 3).forEach((match, i) => {
        const content = match[1].substring(0, 200);
        console.log(`Script ${i + 1}: ${content}...`);
        
        // Look for redirects in script content
        const scriptRedirects = [
          /(?:location|href).*?=.*?["']([^"']*https?:\/\/[^"']+)["']/gi,
          /window\.location\.href\s*=\s*["']([^"']+)["']/gi,
          /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/gi
        ];
        
        for (const pattern of scriptRedirects) {
          const scriptMatches = [...match[1].matchAll(pattern)];
          if (scriptMatches.length > 0) {
            console.log(`  🎯 Found redirect in script: ${scriptMatches[0][1]}`);
          }
        }
      });
    }
    
    console.log('\n🔍 HTML Head Content:');
    const headMatch = result.html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      console.log(headMatch[1].substring(0, 500) + '...');
    }
    
    console.log('\n🔍 HTML Body Start:');
    const bodyMatch = result.html.match(/<body[^>]*>([\s\S]{0,500})/i);
    if (bodyMatch) {
      console.log(bodyMatch[1] + '...');
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

debugGoogleNewsContent().catch(console.error);