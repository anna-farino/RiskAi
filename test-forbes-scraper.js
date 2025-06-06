// Test script to analyze Forbes.com structure
import puppeteer from 'puppeteer';

async function testForbesStructure() {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
    
    console.log('Testing Forbes news page...');
    await page.goto('https://www.forbes.com/news/', { waitUntil: 'networkidle2' });
    
    // Extract article links structure
    const articleData = await page.evaluate(() => {
      const articles = [];
      
      // Look for various article link patterns
      const selectors = [
        'a[href*="/sites/"]',
        'a[href*="/forbes/"]', 
        '.stream-item a',
        '.article-link',
        '.headline a',
        'h2 a, h3 a, h4 a',
        '[data-module="stream"] a'
      ];
      
      const allLinks = new Set();
      
      selectors.forEach(selector => {
        try {
          const links = document.querySelectorAll(selector);
          links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && (href.includes('/sites/') || href.includes('/forbes/'))) {
              allLinks.add(href);
            }
          });
        } catch (e) {
          console.log(`Error with selector ${selector}:`, e.message);
        }
      });
      
      // Convert to full URLs and analyze structure
      Array.from(allLinks).slice(0, 10).forEach(link => {
        const fullUrl = link.startsWith('http') ? link : `https://www.forbes.com${link}`;
        articles.push({
          url: fullUrl,
          text: link
        });
      });
      
      return {
        totalLinks: allLinks.size,
        sampleArticles: articles,
        pageTitle: document.title,
        hasReactRoot: !!document.querySelector('#__next, [data-reactroot]'),
        scripts: Array.from(document.querySelectorAll('script[src]')).slice(0, 5).map(s => s.src)
      };
    });
    
    console.log('Forbes structure analysis:', JSON.stringify(articleData, null, 2));
    
    // Test a specific article if we found any
    if (articleData.sampleArticles.length > 0) {
      const testUrl = articleData.sampleArticles[0].url;
      console.log(`\nTesting article extraction from: ${testUrl}`);
      
      await page.goto(testUrl, { waitUntil: 'networkidle2' });
      
      const articleStructure = await page.evaluate(() => {
        // Test various content selectors
        const contentSelectors = [
          '[data-module="ArticleBody"]',
          '.ArticleBody-articleBody', 
          '.fs-article',
          '.block-content',
          '.article-body',
          '.entry-content',
          'main article',
          '[role="main"] p'
        ];
        
        const results = {};
        
        contentSelectors.forEach(selector => {
          try {
            const element = document.querySelector(selector);
            if (element) {
              results[selector] = {
                found: true,
                textLength: element.textContent?.length || 0,
                hasText: !!element.textContent?.trim()
              };
            } else {
              results[selector] = { found: false };
            }
          } catch (e) {
            results[selector] = { error: e.message };
          }
        });
        
        // Get page metadata
        const metadata = {
          title: document.title,
          author: document.querySelector('[rel="author"], .contrib-link, .author-name')?.textContent?.trim(),
          publishDate: document.querySelector('time, .date, [datetime]')?.getAttribute('datetime') || 
                      document.querySelector('time, .date')?.textContent?.trim(),
          jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
            try { return JSON.parse(s.textContent); } catch { return null; }
          }).filter(Boolean)
        };
        
        return {
          contentSelectors: results,
          metadata,
          paragraphCount: document.querySelectorAll('p').length,
          hasPaywall: !!document.querySelector('.paywall, .premium-content, [data-paywall]')
        };
      });
      
      console.log('Article structure analysis:', JSON.stringify(articleStructure, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing Forbes:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testForbesStructure();