/**
 * Test script to verify the production fix for TypeScript syntax errors
 */

async function testProductionFix() {
  try {
    console.log('Testing production scraping system...');
    
    // Test the unified scraper API endpoint
    const response = await fetch('http://localhost:5000/api/threat-tracker/scrape-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceUrl: 'https://foorilla.com/media/cybersecurity/',
        forceRefresh: true
      })
    });
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log('\n✅ Production Test Results:');
    console.log('==========================');
    console.log(`📊 Links found: ${result.links?.length || 0}`);
    console.log(`⏱️  Processing time: ${result.processingTime || 'N/A'}`);
    console.log(`🔧 Method used: ${result.method || 'N/A'}`);
    
    if (result.links && result.links.length > 0) {
      console.log('\nSample extracted articles:');
      result.links.slice(0, 5).forEach((link, i) => {
        console.log(`${i + 1}. ${link.text}`);
        console.log(`   URL: ${link.href}`);
        console.log(`   Source: ${link.sourceDomain || 'NONE'}`);
        console.log('');
      });
    }
    
    if (result.error) {
      console.log(`❌ Error encountered: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testProductionFix();