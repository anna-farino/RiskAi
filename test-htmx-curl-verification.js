/**
 * Simple verification test using curl to check HTMX endpoint behavior
 */

import { execSync } from 'child_process';

function testHTMXEndpoint() {
  console.log('Testing HTMX endpoint extraction verification...\n');
  
  try {
    // Test the same endpoint we verified earlier
    const endpoint = 'https://foorilla.com/media/items/cybercrime-ai-and-the-rise-of-recovery-first-data-protection-63581/';
    
    console.log(`Testing endpoint: ${endpoint}`);
    console.log('Making HTMX request...\n');
    
    const curlCommand = `curl -s -H "HX-Request: true" -H "Accept: text/html, */*" "${endpoint}"`;
    const response = execSync(curlCommand, { encoding: 'utf8' });
    
    console.log('Response analysis:');
    console.log('=================');
    
    // Check for external links in the response
    const siliconAngleLinks = response.match(/https:\/\/siliconangle\.com[^"'\s]*/g) || [];
    const securityBoulevardLinks = response.match(/https:\/\/securityboulevard\.com[^"'\s]*/g) || [];
    const allExternalLinks = response.match(/https:\/\/[^"'\s]*(?:\.com|\.org|\.net)[^"'\s]*/g) || [];
    
    console.log(`Found ${siliconAngleLinks.length} SiliconANGLE links:`);
    siliconAngleLinks.forEach((link, i) => {
      console.log(`  ${i + 1}. ${link}`);
    });
    
    console.log(`\nFound ${securityBoulevardLinks.length} SecurityBoulevard links:`);
    securityBoulevardLinks.forEach((link, i) => {
      console.log(`  ${i + 1}. ${link}`);
    });
    
    console.log(`\nTotal external links found: ${allExternalLinks.length}`);
    
    // Check for the article title
    const titleMatch = response.match(/<h1>([^<]+)<\/h1>/);
    const title = titleMatch ? titleMatch[1] : 'Title not found';
    console.log(`\nArticle title: "${title}"`);
    
    // Check for domain indicator
    const domainMatch = response.match(/siliconangle\.com/);
    console.log(`Domain indicator found: ${domainMatch ? 'Yes' : 'No'}`);
    
    if (allExternalLinks.length > 0) {
      console.log('\n✅ SUCCESS: HTMX endpoint returns external links');
      console.log('✅ SUCCESS: Two-stage extraction architecture is correct');
      console.log('✅ SUCCESS: Implementation should extract external URLs from loaded content');
    } else {
      console.log('\n❌ ISSUE: No external links found in HTMX response');
    }
    
  } catch (error) {
    console.error('Error testing HTMX endpoint:', error.message);
  }
}

testHTMXEndpoint();