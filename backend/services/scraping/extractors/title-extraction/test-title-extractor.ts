/**
 * Test file for bulk title extractor - can be run manually to verify functionality
 */

import { extractTitleFromUrl, extractTitlesFromUrls, isValidUrl } from './bulk-title-extractor';

/**
 * Test function to verify title extraction works
 */
export async function testTitleExtraction() {
  console.log('🧪 Testing Bulk Title Extractor...\n');

  // Test URL validation
  console.log('1. Testing URL validation:');
  const testUrls = [
    'https://example.com',
    'example.com',
    'http://test.org',
    'invalid-url',
    'ftp://invalid.com'
  ];
  
  testUrls.forEach(url => {
    console.log(`   ${url} -> ${isValidUrl(url) ? '✅ Valid' : '❌ Invalid'}`);
  });

  // Test single URL extraction
  console.log('\n2. Testing single URL extraction:');
  try {
    const result = await extractTitleFromUrl('https://github.com');
    console.log(`   Result:`, {
      url: result.url,
      title: result.title,
      success: result.success,
      method: result.method,
      error: result.error
    });
  } catch (error: any) {
    console.log(`   Error: ${error.message}`);
  }

  // Test bulk extraction with multiple URLs
  console.log('\n3. Testing bulk extraction:');
  const bulkUrls = [
    'https://news.ycombinator.com',
    'https://stackoverflow.com',
    'invalid-url.com',
    'https://github.com'
  ];

  try {
    const results = await extractTitlesFromUrls(bulkUrls, { concurrency: 2 });
    results.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.url}`);
      console.log(`      Title: "${result.title}"`);
      console.log(`      Success: ${result.success ? '✅' : '❌'}, Method: ${result.method}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
      console.log('');
    });
  } catch (error: any) {
    console.log(`   Bulk extraction error: ${error.message}`);
  }

  console.log('✅ Title extraction test complete!\n');
}

// Export for potential manual testing
if (require.main === module) {
  testTitleExtraction().catch(console.error);
}