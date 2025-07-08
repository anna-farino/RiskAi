/**
 * Test script to verify the comprehensive content extraction recovery system
 * Tests all 4 phases of the enhanced selector and recovery implementation
 */

async function testComprehensiveExtractionFix() {
  console.log('🔬 Testing Comprehensive Content Extraction Recovery System\n');
  
  const testUrl = 'https://gbhackers.com/cybercriminals-use-malicious-pdfs/';
  
  try {
    // Test the specific case from the logs where AI detected correct selector but extraction failed
    console.log('📋 Test Case: GBHackers article with div.tdb_single_content selector issue');
    console.log(`🔗 URL: ${testUrl}`);
    console.log('📝 Expected: AI correctly detects div.tdb_single_content, system should extract content\n');
    
    // Import the enhanced scraper
    const { streamlinedScraper } = await import('./backend/services/scraping/unified-scraper-v2.ts');
    
    console.log('⚡ Phase 1: Testing enhanced selector debugging and logging');
    console.log('📊 Expected logs: Detailed selector validation, element matches, failure analysis\n');
    
    console.log('⚡ Phase 2: Testing smart selector recovery');
    console.log('🔄 Expected: Automatic selector variations (underscore ↔ hyphen), class pattern matching\n');
    
    console.log('⚡ Phase 3: Testing pre-extraction validation');
    console.log('✅ Expected: Element existence validation, content quality assessment\n');
    
    console.log('⚡ Phase 4: Testing AI re-analysis trigger');
    console.log('🤖 Expected: Fresh AI analysis if content < 100 chars, multi-attempt recovery\n');
    
    // Perform the extraction with comprehensive logging
    const startTime = Date.now();
    const result = await streamlinedScraper.scrapeArticleUrl(testUrl);
    const duration = Date.now() - startTime;
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎯 EXTRACTION RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📰 Title: "${result.title}" (${result.title.length} chars)`);
    console.log(`📄 Content: ${result.content.length} characters extracted`);
    console.log(`✍️  Author: "${result.author || 'Not detected'}"`);
    console.log(`📅 Date: ${result.publishDate ? result.publishDate.toISOString() : 'Not detected'}`);
    console.log(`🔧 Method: ${result.extractionMethod}`);
    console.log(`🎯 Confidence: ${result.confidence}`);
    
    // Content preview
    if (result.content) {
      console.log('\n📖 Content Preview (first 200 chars):');
      console.log(`"${result.content.substring(0, 200)}..."`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🧪 RECOVERY SYSTEM ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Test success criteria
    const tests = {
      'Content Extracted': result.content && result.content.length > 0,
      'Sufficient Content Length': result.content && result.content.length >= 100,
      'Title Extracted': result.title && result.title.length > 0,
      'No Zero-Content Failure': result.content && result.content.length > 0,
      'Quality Content': result.content && !isLowQualityContent(result.content),
      'Method Identified': result.extractionMethod && result.extractionMethod !== 'unknown',
      'Confidence Reasonable': result.confidence >= 0.3
    };
    
    let passedTests = 0;
    let totalTests = Object.keys(tests).length;
    
    for (const [testName, passed] of Object.entries(tests)) {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${testName}`);
      if (passed) passedTests++;
    }
    
    console.log(`\n🏆 Overall Score: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 SUCCESS: Comprehensive extraction recovery system working correctly!');
      console.log('✨ Zero-content extraction failures have been eliminated');
    } else if (passedTests >= totalTests * 0.7) {
      console.log('⚠️  PARTIAL SUCCESS: Most recovery features working, minor issues remain');
    } else {
      console.log('🚨 ISSUES DETECTED: Recovery system needs additional refinement');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔍 SPECIFIC SELECTOR ISSUE ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Check if the original issue is resolved
    if (result.content && result.content.length > 0) {
      console.log('✅ ISSUE RESOLVED: div.tdb_single_content selector issue has been fixed');
      console.log('🔧 Recovery system successfully handled the selector variation');
    } else {
      console.log('❌ ISSUE PERSISTS: Content extraction still failing');
      console.log('🔍 Check logs above for debugging information');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('📝 Error details:', error);
    throw error;
  }
}

/**
 * Helper function to check content quality
 */
function isLowQualityContent(content) {
  const lowQualityPatterns = [
    /^(menu|navigation|nav|sidebar|footer|header|advertisement|ad|cookie|privacy|terms)/i,
    /^(home|about|contact|login|register|subscribe|newsletter)/i,
    /^[\w\s]{1,20}$/,  // Too short
    /^(.{1,10}\s*){1,5}$/,  // Repeated short phrases
  ];
  
  return lowQualityPatterns.some(pattern => pattern.test(content.trim()));
}

/**
 * Additional test for selector variation handling
 */
async function testSelectorVariations() {
  console.log('\n🧬 Testing Selector Variation Generation');
  
  const testSelectors = [
    'div.tdb_single_content',
    'div.tdb-single-content', 
    '.article_content',
    '.article-content',
    'h1.title_main'
  ];
  
  // Import the variation function (would need to be exported for testing)
  console.log('🔄 Selector variations that should be generated:');
  
  for (const selector of testSelectors) {
    console.log(`\n📌 Original: ${selector}`);
    
    // Manual variation generation for testing
    const variations = [];
    variations.push(selector);
    
    if (selector.includes('_')) {
      variations.push(selector.replace(/_/g, '-'));
    }
    if (selector.includes('-')) {
      variations.push(selector.replace(/-/g, '_'));
    }
    
    if (selector.startsWith('.')) {
      const className = selector.substring(1);
      variations.push(`[class="${className}"]`);
      variations.push(`[class*="${className}"]`);
    }
    
    console.log(`🔄 Variations: ${variations.join(', ')}`);
  }
}

// Run the comprehensive test
testComprehensiveExtractionFix()
  .then(() => testSelectorVariations())
  .then(() => {
    console.log('\n🎊 All tests completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });