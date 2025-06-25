/**
 * Test script to verify the OpenAI API fix in content extraction
 */

import { extractArticleContent } from './backend/services/scraping/extractors/content-extractor.js';

async function testOpenAIFix() {
  console.log('=== Testing OpenAI API Fix ===');
  
  try {
    // Test with a simple article URL
    const testUrl = 'https://example.com/test-article';
    const testConfig = {
      titleSelector: 'h1',
      contentSelector: '.content',
      authorSelector: '.author',
      dateSelector: '.date',
      confidence: 0.8
    };
    
    console.log('1. Checking if OpenAI API key is available...');
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    console.log(`   OpenAI API Key: ${hasApiKey ? 'Present' : 'Missing'}`);
    
    if (!hasApiKey) {
      console.log('   ❌ OpenAI API key not found - this explains the fallback behavior');
      return;
    }
    
    console.log('2. Testing content extraction with mock HTML...');
    
    // Create a simple HTML structure for testing
    const testHtml = `
      <html>
        <head><title>Test Article</title></head>
        <body>
          <h1>Test Article Title</h1>
          <div class="author">By Test Author</div>
          <div class="date">2025-06-25</div>
          <div class="content">
            <p>This is the first paragraph of the test article content.</p>
            <p>This is the second paragraph with more detailed information.</p>
            <p>This is the third paragraph concluding the article.</p>
          </div>
        </body>
      </html>
    `;
    

    
    console.log('3. Testing extractArticleContent with sourceUrl parameter...');
    const result = await extractArticleContent(testHtml, testConfig, testUrl);
    
    console.log('4. Extraction results:');
    console.log(`   Title: "${result.title}" (${result.title.length} chars)`);
    console.log(`   Content: "${result.content.substring(0, 100)}..." (${result.content.length} chars)`);
    console.log(`   Author: ${result.author || 'Not found'}`);
    console.log(`   Method: ${result.extractionMethod}`);
    console.log(`   Confidence: ${result.confidence}`);
    
    // Check if AI extraction was attempted
    if (result.extractionMethod.includes('ai')) {
      console.log('   ✅ AI extraction successful!');
    } else {
      console.log('   ⚠️  AI extraction not used - fell back to traditional methods');
      console.log('   This could indicate an issue with the AI extraction logic');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testOpenAIFix().catch(console.error);