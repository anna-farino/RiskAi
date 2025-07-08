/**
 * Simple test to analyze Foorilla link extraction issue
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

async function testFoorillaLinkExtraction() {
  console.log('Testing Foorilla link extraction...');
  
  try {
    // Fetch the page
    const response = await fetch('https://foorilla.com/media/cybersecurity/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    console.log(`Retrieved ${html.length} characters of HTML`);
    
    // Parse with Cheerio
    const $ = cheerio.load(html);
    
    // Analyze all links
    const allLinks = [];
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      const parentClass = $(element).parent().attr('class') || '';
      
      if (href) {
        allLinks.push({
          href,
          text,
          textLength: text.length,
          parentClass
        });
      }
    });
    
    console.log(`\nTotal links found: ${allLinks.length}`);
    
    // Filter by current logic (20+ chars)
    const longTextLinks = allLinks.filter(link => link.text.length >= 20);
    console.log(`Links with 20+ chars text: ${longTextLinks.length}`);
    
    // Filter by relaxed logic (5+ chars)
    const shortTextLinks = allLinks.filter(link => link.text.length >= 5);
    console.log(`Links with 5+ chars text: ${shortTextLinks.length}`);
    
    // Look for article patterns
    const articlePatterns = allLinks.filter(link => 
      link.href.includes('/media/') ||
      link.href.includes('/article/') ||
      link.href.includes('/news/') ||
      link.href.includes('/blog/') ||
      link.href.match(/\d{4}\/\d{2}\//) ||
      (link.text.length > 10 && !link.href.includes('#'))
    );
    
    console.log(`Links matching article patterns: ${articlePatterns.length}`);
    
    console.log('\nSample article-like links:');
    articlePatterns.slice(0, 10).forEach((link, i) => {
      console.log(`${i+1}. "${link.text}" (${link.textLength} chars)`);
      console.log(`   URL: ${link.href}`);
      console.log(`   Parent: ${link.parentClass}`);
      console.log('');
    });
    
    // Check for specific patterns that might be missed
    console.log('\nAll unique href patterns:');
    const hrefPatterns = new Set();
    allLinks.forEach(link => {
      if (link.href.startsWith('/') || link.href.includes('foorilla.com')) {
        const pattern = link.href.replace(/\d+/g, '[NUM]').replace(/\/+$/, '');
        hrefPatterns.add(pattern);
      }
    });
    
    Array.from(hrefPatterns).slice(0, 20).forEach(pattern => {
      console.log(`  ${pattern}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFoorillaLinkExtraction();