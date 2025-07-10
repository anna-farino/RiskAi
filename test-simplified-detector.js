/**
 * Test the simplified structure detector system
 */

import { detectHtmlStructure } from './backend/services/scraping/structure-detector.js';

async function testSimplifiedDetector() {
  console.log('Testing simplified structure detector...');
  
  try {
    // Test HTML with clear structure
    const testHtml = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1 class="main-title">Article Title</h1>
          <div class="author-info">By John Doe</div>
          <time class="publish-date">2025-07-10</time>
          <div class="article-content">
            <p>This is the main content of the article.</p>
            <p>It has multiple paragraphs with substantial content.</p>
          </div>
        </body>
      </html>
    `;
    
    const testUrl = 'https://example.com/test-article';
    
    console.log('Testing structure detection...');
    const config = await detectHtmlStructure(testUrl, testHtml);
    
    console.log('✓ Structure detection completed');
    console.log('Detected selectors:');
    console.log(`- Title: "${config.titleSelector}"`);
    console.log(`- Content: "${config.contentSelector}"`);
    console.log(`- Author: "${config.authorSelector || 'not detected'}"`);
    console.log(`- Date: "${config.dateSelector || 'not detected'}"`);
    console.log(`- Confidence: ${config.confidence}`);
    
    // Test that it detects valid CSS selectors, not text content
    const isValidSelector = (selector) => {
      if (!selector) return true; // Optional selectors
      return !selector.startsWith('By ') && !selector.match(/\d{4}-\d{2}-\d{2}/) && selector.includes('.');
    };
    
    if (isValidSelector(config.titleSelector) && 
        isValidSelector(config.contentSelector) && 
        isValidSelector(config.authorSelector) && 
        isValidSelector(config.dateSelector)) {
      console.log('✓ All selectors are valid CSS selectors (not text content)');
      return true;
    } else {
      console.log('✗ Some selectors contain text content instead of CSS selectors');
      return false;
    }
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return false;
  }
}

testSimplifiedDetector().then(success => {
  console.log(`\nSimplified detector test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});