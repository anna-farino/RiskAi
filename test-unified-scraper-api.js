/**
 * Test the unified scraper API directly to see logs and debug the HTMX extraction
 */

async function testUnifiedScraperAPI() {
  console.log('🔄 Testing unified scraper API with Foorilla cybersecurity URL...');
  
  try {
    const response = await fetch('http://localhost:5000/api/unified-scraper/scrape-source', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': 'test-token' // Basic CSRF bypass for testing
      },
      body: JSON.stringify({
        url: 'https://foorilla.com/media/cybersecurity/',
        options: {
          aiContext: 'cybersecurity threats and security incidents',
          appType: 'threat-tracker',
          forceExtraction: true
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ API Response received:');
      console.log(`Links found: ${result.links?.length || 0}`);
      console.log(`Method used: ${result.method || 'unknown'}`);
      console.log(`Processing time: ${result.processingTime || 'unknown'}`);
      
      if (result.links && result.links.length > 0) {
        console.log('\n📄 Links found:');
        result.links.slice(0, 10).forEach((link, index) => {
          console.log(`${index + 1}. ${link.url}`);
          console.log(`   Text: "${link.text?.substring(0, 60)}..."`);
          console.log(`   Domain: ${link.domain || 'unknown'}`);
          console.log('');
        });
      } else {
        console.log('❌ No links found in response');
      }
      
      if (result.error) {
        console.log(`⚠️  Error in response: ${result.error}`);
      }
      
    } else {
      const errorText = await response.text();
      console.log(`❌ API Error ${response.status}: ${errorText}`);
    }
    
  } catch (error) {
    console.log(`💥 Request failed: ${error.message}`);
  }
}

// Run the test
testUnifiedScraperAPI();