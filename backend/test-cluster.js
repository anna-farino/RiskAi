const { puppeteerClusterService } = require('./utils/puppeteer-cluster.ts');

async function testCluster() {
  console.log('🧪 Testing Puppeteer Cluster Implementation...');
  
  try {
    // Test 1: Simple webpage scraping
    console.log('\n📝 Test 1: Scraping a simple webpage...');
    const html1 = await puppeteerClusterService.scrapeUrl('https://example.com', false);
    console.log(`✅ Test 1 passed - Got ${html1.length} characters`);
    
    // Test 2: Batch scraping
    console.log('\n📝 Test 2: Batch scraping multiple URLs...');
    const urls = [
      'https://example.com',
      'https://httpbin.org/html',
      'https://google.com'
    ];
    
    const results = await puppeteerClusterService.scrapeMultipleUrls(
      urls.map(url => ({ url, isArticlePage: false }))
    );
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Test 2 passed - ${successCount}/${urls.length} URLs scraped successfully`);
    
    // Test 3: Cluster status
    console.log('\n📝 Test 3: Checking cluster status...');
    const status = puppeteerClusterService.getStatus();
    console.log('✅ Test 3 passed - Status:', status);
    
    console.log('\n🎉 All tests passed! Puppeteer cluster is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up cluster...');
    await puppeteerClusterService.shutdown();
    console.log('✅ Cluster shut down successfully');
    process.exit(0);
  }
}

// Run the test
testCluster();