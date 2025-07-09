/**
 * Debug article link extraction from loaded HTMX content
 */

import puppeteer from 'puppeteer';

async function debugArticleLinkExtraction() {
  console.log('🔍 Debugging article link extraction from HTMX content...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto('https://foorilla.com/media/cybersecurity/', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Load HTMX content and analyze structure
    const analysis = await page.evaluate(async () => {
      const baseUrl = 'https://foorilla.com';
      const currentUrl = 'https://foorilla.com/media/cybersecurity/';
      
      // Load the main content endpoint
      const response = await fetch(`${baseUrl}/media/items/`, {
        headers: {
          'HX-Request': 'true',
          'HX-Current-URL': currentUrl,
          'Accept': 'text/html, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Screen': 'D'
        }
      });
      
      const html = await response.text();
      console.log(`Loaded ${html.length} characters from /media/items/`);
      
      // Create container and analyze structure
      const container = document.createElement('div');
      container.innerHTML = html;
      
      // Test different link selectors
      const selectors = [
        'a[href*="/media/items/"]',     // Internal article links
        'a[href^="/media/"]',           // All media links  
        'a[href^="http"]',              // External links
        'a.stretched-link',             // Bootstrap stretched links
        'a[href*="article"]',           // Article pattern links
        'a[href*="news"]',              // News pattern links
        'a',                            // All links
        '[data-url]',                   // Data URL attributes
        '[hx-get]',                     // HTMX get elements
        '.article',                     // Article elements
        '[class*="article"]',           // Classes containing "article"
        '.card a',                      // Card links
        '.list-item a'                  // List item links
      ];
      
      const results = {};
      selectors.forEach(selector => {
        try {
          const elements = container.querySelectorAll(selector);
          results[selector] = {
            count: elements.length,
            samples: Array.from(elements).slice(0, 5).map(el => ({
              tag: el.tagName,
              href: el.getAttribute('href'),
              text: el.textContent?.trim().substring(0, 100),
              classes: el.className,
              id: el.id,
              dataUrl: el.getAttribute('data-url'),
              hxGet: el.getAttribute('hx-get')
            }))
          };
        } catch (e) {
          results[selector] = { error: e.message };
        }
      });
      
      // Also check raw HTML structure
      const htmlStructure = {
        totalLength: html.length,
        containsLinks: html.includes('<a '),
        containsHrefs: html.includes('href='),
        containsDataUrls: html.includes('data-url'),
        containsHxGet: html.includes('hx-get'),
        containsArticleText: html.toLowerCase().includes('article'),
        containsCyberText: html.toLowerCase().includes('cyber'),
        htmlPreview: html.substring(0, 1000) + '...'
      };
      
      return { results, htmlStructure };
    });
    
    console.log('\n📊 HTML Structure Analysis:');
    console.log(`Total length: ${analysis.htmlStructure.totalLength}`);
    console.log(`Contains <a> tags: ${analysis.htmlStructure.containsLinks}`);
    console.log(`Contains href attributes: ${analysis.htmlStructure.containsHrefs}`);
    console.log(`Contains data-url: ${analysis.htmlStructure.containsDataUrls}`);
    console.log(`Contains hx-get: ${analysis.htmlStructure.containsHxGet}`);
    console.log(`Contains "article": ${analysis.htmlStructure.containsArticleText}`);
    console.log(`Contains "cyber": ${analysis.htmlStructure.containsCyberText}`);
    
    console.log('\n🔗 Link Extraction Results:');
    Object.entries(analysis.results).forEach(([selector, data]) => {
      if (data.error) {
        console.log(`${selector}: ERROR - ${data.error}`);
      } else {
        console.log(`${selector}: ${data.count} elements`);
        if (data.count > 0 && data.samples) {
          data.samples.forEach((sample, i) => {
            console.log(`  ${i + 1}. ${sample.tag} href="${sample.href}" text="${sample.text}"`);
            if (sample.dataUrl) console.log(`      data-url="${sample.dataUrl}"`);
            if (sample.hxGet) console.log(`      hx-get="${sample.hxGet}"`);
          });
        }
      }
      console.log('');
    });
    
    // Show HTML preview to understand structure
    console.log('📄 HTML Preview (first 1000 chars):');
    console.log(analysis.htmlStructure.htmlPreview);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugArticleLinkExtraction().catch(console.error);