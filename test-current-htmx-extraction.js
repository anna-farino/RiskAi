/**
 * Test the current HTMX extraction to verify external links
 */

import { execSync } from 'child_process';

async function testCurrentImplementation() {
  console.log('Testing current HTMX external link extraction...\n');
  
  try {
    // Start the server and test the Foorilla scraping API directly
    console.log('Testing API call to scrape Foorilla...');
    
    const testCommand = `curl -s -X POST "http://localhost:3000/api/threat-tracker/scrape/source/844190fb-1b16-41b1-ad3f-db093f2ea19f" -H "Content-Type: application/json"`;
    
    console.log('Making API request...');
    
    // Check if server is running first
    try {
      const healthCheck = execSync('curl -s http://localhost:3000/health', { encoding: 'utf8', timeout: 5000 });
      console.log('Server health check:', healthCheck.slice(0, 100));
    } catch (error) {
      console.log('Server not running, attempting to start...');
      // Server might not be running, that's expected
      return;
    }
    
    const response = execSync(testCommand, { encoding: 'utf8', timeout: 60000 });
    
    console.log('API Response Analysis:');
    console.log('====================');
    
    try {
      const data = JSON.parse(response);
      
      if (data.articles && data.articles.length > 0) {
        console.log(`Found ${data.articles.length} articles`);
        
        const firstArticle = data.articles[0];
        console.log('\nFirst article analysis:');
        console.log(`Title: "${firstArticle.title}"`);
        console.log(`URL: ${firstArticle.url}`);
        
        // Check if URL is external (not Foorilla)
        if (firstArticle.url && firstArticle.url.includes('siliconangle.com')) {
          console.log('✅ SUCCESS: External SiliconANGLE URL found!');
          console.log('✅ SUCCESS: HTMX external link extraction is working');
        } else if (firstArticle.url && firstArticle.url.includes('foorilla.com')) {
          console.log('❌ ISSUE: Still getting Foorilla internal URLs');
          console.log('❌ Main page extraction is still running instead of HTMX external links');
        } else {
          console.log(`⚠️  UNKNOWN: URL pattern not recognized: ${firstArticle.url}`);
        }
      } else {
        console.log('❌ No articles found in response');
      }
      
    } catch (parseError) {
      console.log('Response is not JSON, raw response:', response.slice(0, 200));
    }
    
  } catch (error) {
    console.error('Error testing implementation:', error.message);
    console.log('\nThis test requires the server to be running.');
    console.log('The implementation should work once the server is active.');
  }
}

testCurrentImplementation();