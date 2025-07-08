/**
 * Direct test of enhanced HTMX extraction functionality
 */

async function testFoorillaExtraction() {
  console.log('🔍 Testing enhanced HTMX extraction...');
  
  try {
    // First, let's test the backend scraping API directly
    const baseUrl = 'http://localhost:5000';
    
    // Test scraping Foorilla with the enhanced system
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://foorilla.com/media/cybersecurity/',
        context: 'cybersecurity threat intelligence articles'
      })
    });
    
    if (!response.ok) {
      console.error('❌ Scraping API not available - server may not be running');
      return;
    }
    
    const result = await response.json();
    
    console.log('\n📊 Enhanced HTMX Extraction Results:');
    console.log(`🔗 Links found: ${result.links?.length || 0}`);
    console.log(`📄 Content extracted: ${result.content ? 'Yes' : 'No'}`);
    console.log(`⏱️  Processing time: ${result.processingTime || 'N/A'}`);
    
    if (result.links && result.links.length >= 15) {
      console.log('✅ SUCCESS: Extracted 15+ articles as expected!');
    } else if (result.links && result.links.length >= 10) {
      console.log('⚠️  PARTIAL: Extracted 10+ articles (improvement needed)');
    } else {
      console.log('❌ ISSUE: Still extracting fewer than 10 articles');
    }
    
    if (result.links && result.links.length > 0) {
      console.log('\n🔍 Sample extracted links:');
      result.links.slice(0, 5).forEach((link, i) => {
        console.log(`${i + 1}. ${link}`);
      });
    }
    
    // Test summary
    console.log('\n🎯 Test Summary:');
    console.log(`Expected: 15+ articles from HTMX site`);
    console.log(`Actual: ${result.links?.length || 0} articles`);
    console.log(`Status: ${(result.links?.length || 0) >= 15 ? 'PASSED' : 'NEEDS IMPROVEMENT'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Suggestions:');
    console.log('1. Check if the backend server is running');
    console.log('2. Verify the enhanced HTMX extraction is deployed');
    console.log('3. Check network connectivity to test site');
  }
}

testFoorillaExtraction().catch(console.error);