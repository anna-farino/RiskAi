/**
 * Test script to verify the empty href extraction fix
 * Tests that the system can now extract articles with empty href attributes
 */

import { scrapeArticleUrl } from './backend/services/scraping/index.ts';

async function testEmptyHrefFix() {
  console.log('Testing empty href extraction fix for Foorilla...');
  
  try {
    const result = await scrapeArticleUrl('https://foorilla.com/media/cybersecurity/', {
      context: 'cybersecurity',
      extractMethod: 'unified'
    });
    
    console.log('\n=== Extraction Results ===');
    console.log(`Found ${result.length} article links`);
    
    if (result.length > 0) {
      console.log('\n=== Sample Articles ===');
      result.slice(0, 10).forEach((link, index) => {
        console.log(`${index + 1}. "${link.text}"`);
        console.log(`   URL: ${link.href || 'EMPTY'}`);
        console.log(`   Data URL: ${link.dataUrl || 'NONE'}`);
        console.log(`   OnClick: ${link.onclick ? 'HAS HANDLER' : 'NONE'}`);
        console.log('');
      });
      
      // Check for articles with resolved URLs
      const articlesWithUrls = result.filter(link => link.href && link.href !== '');
      const articlesWithDataUrls = result.filter(link => link.dataUrl && link.dataUrl !== '');
      const articlesWithOnclick = result.filter(link => link.onclick && link.onclick !== '');
      
      console.log('\n=== URL Resolution Summary ===');
      console.log(`Articles with href: ${articlesWithUrls.length}`);
      console.log(`Articles with data-url: ${articlesWithDataUrls.length}`);
      console.log(`Articles with onclick: ${articlesWithOnclick.length}`);
      
      if (articlesWithUrls.length > 0) {
        console.log('\n✅ SUCCESS: Found articles with resolved URLs!');
        console.log('Sample resolved URLs:');
        articlesWithUrls.slice(0, 5).forEach(link => {
          console.log(`- ${link.text} -> ${link.href}`);
        });
      } else {
        console.log('\n⚠️  No articles with resolved URLs found');
        console.log('This suggests the URL resolution logic needs improvement');
      }
    } else {
      console.log('\n❌ No articles found - extraction failed');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testEmptyHrefFix();