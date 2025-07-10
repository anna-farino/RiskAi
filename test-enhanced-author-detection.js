import { scrapeArticleContent } from './backend/services/scraping/index.js';
import cheerio from 'cheerio';

async function testEnhancedAuthorDetection() {
  console.log('Testing enhanced author detection for reinsurancene.ws...\n');
  
  const url = 'https://www.reinsurancene.ws/dovetailing-prospective-retrospective-solutions-the-best-use-of-legacy-jass-augment-risk/';
  
  try {
    // Test the scraping system
    console.log('1. Testing full scraping system...');
    const result = await scrapeArticleContent(url);
    
    console.log('\n=== SCRAPING RESULTS ===');
    console.log(`Title: ${result.title}`);
    console.log(`Author: ${result.author || 'NOT FOUND'}`);
    console.log(`Date: ${result.publishDate}`);
    console.log(`Content length: ${result.content?.length || 0} chars`);
    console.log(`Extraction method: ${result.extractionMethod}`);
    
    // Also test the fallback selectors directly
    console.log('\n2. Testing fallback selectors directly...');
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Test new fallback selectors
    const fallbackSelectors = [
      '[rel*="author"]',
      '.date a[rel*="author"]',
      'p.date a',
      '.article-meta a',
      'a[href*="/author/"]',
    ];
    
    console.log('\n=== FALLBACK SELECTOR RESULTS ===');
    for (const selector of fallbackSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`\nSelector "${selector}" found ${elements.length} element(s):`);
        elements.each((i, el) => {
          if (i < 3) {  // Show first 3 matches
            const text = $(el).text().trim();
            const href = $(el).attr('href') || '';
            const rel = $(el).attr('rel') || '';
            console.log(`  - Text: "${text}", href: "${href}", rel: "${rel}"`);
          }
        });
      }
    }
    
    // Check meta tags
    console.log('\n=== META TAGS ===');
    const authorMeta = $('meta[name="author"]').attr('content');
    if (authorMeta) {
      console.log(`meta[name="author"]: "${authorMeta}"`);
    }
    
    // Check for author within date paragraph
    console.log('\n=== DATE PARAGRAPH ANALYSIS ===');
    const dateParagraphs = $('p.date');
    console.log(`Found ${dateParagraphs.length} date paragraph(s)`);
    dateParagraphs.each((i, el) => {
      const text = $(el).text();
      console.log(`\nDate paragraph ${i + 1}: "${text.substring(0, 100)}..."`);
      
      // Look for author patterns
      const authorMatch = text.match(/Author:\s*(.+?)(?:\s*-|$)/i);
      if (authorMatch) {
        console.log(`  -> Found author pattern: "${authorMatch[1]}"`);
      }
      
      // Check links within
      const links = $(el).find('a');
      console.log(`  -> Contains ${links.length} link(s)`);
      links.each((j, link) => {
        const linkText = $(link).text().trim();
        const linkRel = $(link).attr('rel') || '';
        console.log(`     Link ${j + 1}: text="${linkText}", rel="${linkRel}"`);
      });
    });
    
  } catch (error) {
    console.error('Error during test:', error.message);
    console.error(error.stack);
  }
}

testEnhancedAuthorDetection().catch(console.error);