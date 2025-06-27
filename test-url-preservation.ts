/**
 * Test URL preservation in Threat Tracker scraping
 * Directly tests the OpenAI link extraction to verify URLs are preserved
 */

import { identifyArticleLinks } from './backend/apps/threat-tracker/services/openai.js';

async function testUrlPreservation() {
  console.log('Testing URL preservation in Threat Tracker...');
  
  // Simulate HTML with The Hacker News style URLs that were being modified
  const testHtml = `
    <div>
      <a href="https://thehackernews.com/expert-insights/2025/06/your-salesforce-data-isnt-as-safe-as.html">
        Your Salesforce Data Isn't As Safe As You Think
      </a>
      <a href="https://thehackernews.com/2025/06/new-cyber-threat-discovered.html">
        New Cyber Threat Discovered
      </a>
      <a href="https://thehackernews.com/expert-insights/2025/06/enterprise-security-analysis.html">
        Enterprise Security Analysis
      </a>
    </div>
  `;
  
  try {
    console.log('Extracting article URLs...');
    const urls = await identifyArticleLinks(testHtml);
    
    console.log(`Found ${urls.length} URLs:`);
    urls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
      
      // Check if URL contains the expected path structure
      if (url.includes('/expert-insights/')) {
        console.log('   ✅ URL preserved correctly - contains /expert-insights/');
      } else if (url.includes('thehackernews.com') && !url.includes('/expert-insights/')) {
        console.log('   ❌ URL modified - missing /expert-insights/');
      }
    });
    
  } catch (error) {
    console.error('Error testing URL preservation:', error);
  }
}

testUrlPreservation().catch(console.error);